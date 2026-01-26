"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { DiscountSettings, GlobalDiscountSettings, BranchDiscountSettings, DiscountRate } from '@/types/discount';
import { useToast } from '@/hooks/use-toast';

interface DiscountContextType {
    discountSettings: DiscountSettings | null;
    loading: boolean;
    error: string | null;
    refreshSettings: () => Promise<void>;
    updateGlobalSettings: (settings: Partial<GlobalDiscountSettings>) => Promise<void>;
    updateBranchSettings: (branchId: string, settings: Partial<BranchDiscountSettings>) => Promise<void>;
    canApplyDiscount: (branchId: string, orderTotal: number) => boolean;
    getActiveDiscountRates: (branchId: string) => DiscountRate[];
}

const DiscountContext = createContext<DiscountContextType | undefined>(undefined);

export function DiscountProvider({ children }: { children: ReactNode }) {
    const [discountSettings, setDiscountSettings] = useState<DiscountSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();

    const fetchDiscountSettings = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const { data, error } = await supabase
                .from('discount_settings')
                .select('data')
                .eq('id', 'settings')
                .maybeSingle();

            if (error) throw error;

            if (data) {
                // Supabase might return data as a string if using raw SQL view, or object.
                // Assuming it's already an object because of SDK.
                setDiscountSettings(data.data as DiscountSettings);
            } else {
                console.log("No discount settings found, creating default...");
                // Initialize default settings if not found
                const defaultSettings: DiscountSettings = {
                    globalSettings: {
                        startDate: new Date(),
                        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
                        allowDuplicateDiscount: false,
                        allowPointAccumulation: true,
                        minOrderAmount: 10000,
                    },
                    branchSettings: {},
                };

                // Try to insert defaults
                const { error: insertError } = await supabase
                    .from('discount_settings')
                    .insert([{ id: 'settings', data: defaultSettings }]);

                if (insertError) {
                    // If insert fails (race condition), try fetching again
                    console.warn("Insert failed during default creation, retrying fetch...", insertError);
                    const { data: retryData, error: retryError } = await supabase
                        .from('discount_settings')
                        .select('data')
                        .eq('id', 'settings')
                        .maybeSingle(); // Changed from single() to maybeSingle() for safety

                    if (retryError) throw retryError;

                    if (retryData) {
                        setDiscountSettings(retryData.data as DiscountSettings);
                    } else {
                        throw new Error("Failed to initialize discount settings");
                    }
                } else {
                    setDiscountSettings(defaultSettings);
                }
            }
        } catch (err: any) {
            console.error('Error fetching discount settings:', err);
            if (typeof err === 'object') {
                console.error('Error details:', JSON.stringify(err, null, 2));
                console.error('Error message:', err?.message);
                console.error('Error code:', err?.code);
            }

            // Fallback to defaults in memory so the app doesn't break
            setDiscountSettings({
                globalSettings: {
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    allowDuplicateDiscount: false,
                    allowPointAccumulation: true,
                    minOrderAmount: 10000,
                },
                branchSettings: {},
            });

            // Only set error if it's not a recoverable state for the UI, 
            // but here we recovered with defaults, so maybe just toast?
            // setError(err.message || '할인 설정을 불러오는 중 오류가 발생했습니다.'); 
            // We'll keep error null to let UI render defaults, but toast the issue.
            toast({
                variant: 'destructive',
                title: '설정 로드 주의',
                description: '할인 설정을 불러오지 못해 기본값으로 표시합니다. (저장이 안 될 수 있습니다)',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch only once on mount
    useEffect(() => {
        fetchDiscountSettings();
    }, [fetchDiscountSettings]);

    const updateGlobalSettings = useCallback(async (settings: Partial<GlobalDiscountSettings>) => {
        if (!discountSettings) return;

        try {
            const updatedSettings = {
                ...discountSettings,
                globalSettings: {
                    ...discountSettings.globalSettings,
                    ...settings,
                },
            };

            const { error } = await supabase
                .from('discount_settings')
                .update({ data: updatedSettings, updated_at: new Date() })
                .eq('id', 'settings');

            if (error) throw error;

            setDiscountSettings(updatedSettings);
        } catch (err: any) {
            console.error('Error updating global settings:', err);
            throw err;
        }
    }, [discountSettings]);

    const updateBranchSettings = useCallback(async (branchId: string, settings: Partial<BranchDiscountSettings>) => {
        if (!discountSettings) return;

        try {
            const updatedSettings = {
                ...discountSettings,
                branchSettings: {
                    ...discountSettings.branchSettings,
                    [branchId]: {
                        ...discountSettings.branchSettings[branchId],
                        ...settings,
                        updatedAt: new Date(),
                    },
                },
            };

            const { error } = await supabase
                .from('discount_settings')
                .update({ data: updatedSettings, updated_at: new Date() })
                .eq('id', 'settings');

            if (error) throw error;

            setDiscountSettings(updatedSettings);
        } catch (err: any) {
            console.error('Error updating branch settings:', err);
            throw err;
        }
    }, [discountSettings]);

    // Helper functions
    const canApplyDiscount = useCallback((branchId: string, orderTotal: number): boolean => {
        if (!discountSettings) return false;

        const globalSettings = discountSettings.globalSettings;
        const branchSettings = discountSettings.branchSettings[branchId];

        // 1. Check if branch settings exist and are active
        if (!branchSettings?.isActive) return false;

        // 2. Check date range (Global)
        const now = new Date();
        const startDate = new Date(globalSettings.startDate);
        const endDate = new Date(globalSettings.endDate);

        if (now < startDate || now > endDate) return false;

        // 3. Check minimum order amount (Branch override or Global default)
        const minAmount = branchSettings.minOrderAmount ?? globalSettings.minOrderAmount;
        if (orderTotal < minAmount) return false;

        return true;
    }, [discountSettings]);

    const getActiveDiscountRates = useCallback((branchId: string): DiscountRate[] => {
        if (!discountSettings) return [];

        const branchSettings = discountSettings.branchSettings[branchId];
        if (!branchSettings?.isActive) return [];

        return branchSettings.discountRates?.filter(rate => rate.isActive) || [];
    }, [discountSettings]);

    return (
        <DiscountContext.Provider value={{
            discountSettings,
            loading,
            error,
            refreshSettings: fetchDiscountSettings,
            updateGlobalSettings,
            updateBranchSettings,
            canApplyDiscount,
            getActiveDiscountRates
        }}>
            {children}
        </DiscountContext.Provider>
    );
}

export function useDiscountContext() {
    const context = useContext(DiscountContext);
    if (context === undefined) {
        throw new Error('useDiscountContext must be used within a DiscountProvider');
    }
    return context;
}
