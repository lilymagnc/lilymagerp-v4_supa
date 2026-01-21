"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { DiscountSettings, BranchDiscountSettings, GlobalDiscountSettings, DiscountRate } from '@/types/discount';

const DEFAULT_DISCOUNT_RATES: DiscountRate[] = [
  { rate: 5, label: "5%", isActive: true },
  { rate: 10, label: "10%", isActive: true },
  { rate: 15, label: "15%", isActive: true },
  { rate: 20, label: "20%", isActive: true },
  { rate: 25, label: "25%", isActive: true },
  { rate: 30, label: "30%", isActive: true },
  { rate: 35, label: "35%", isActive: true },
  { rate: 40, label: "40%", isActive: true },
  { rate: 45, label: "45%", isActive: true },
  { rate: 50, label: "50%", isActive: true },
];

export function useDiscountSettings() {
  const [discountSettings, setDiscountSettings] = useState<DiscountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDiscountSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase.from('discount_settings').select('data').eq('id', 'settings').maybeSingle();

      if (error) throw error;
      if (data) {
        setDiscountSettings(data.data as DiscountSettings);
      } else {
        const defaultSettings: DiscountSettings = {
          globalSettings: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            allowDuplicateDiscount: false,
            allowPointAccumulation: true,
            minOrderAmount: 10000,
          },
          branchSettings: {},
        };
        await supabase.from('discount_settings').insert([{ id: 'settings', data: defaultSettings }]);
        setDiscountSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching discount settings:', error);
      setError('할인 설정을 불러오는 중 오류가 발생했습니다.');
      toast({
        variant: 'destructive',
        title: '오류',
        description: '할인 설정을 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      const { error } = await supabase.from('discount_settings').update({ data: updatedSettings }).eq('id', 'settings');
      if (error) throw error;
      setDiscountSettings(updatedSettings);
      toast({ title: '성공', description: '전역 설정이 업데이트되었습니다.' });
    } catch (error) {
      console.error('Error updating global settings:', error);
      toast({ variant: 'destructive', title: '오류', description: '설정 업데이트 중 오류가 발생했습니다.' });
    }
  }, [discountSettings, toast]);

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
      const { error } = await supabase.from('discount_settings').update({ data: updatedSettings }).eq('id', 'settings');
      if (error) throw error;
      setDiscountSettings(updatedSettings);
      toast({ title: '성공', description: '지점 설정이 저장되었습니다.' });
    } catch (error) {
      console.error('Error updating branch settings:', error);
      toast({ variant: 'destructive', title: '오류', description: '설정 업데이트 중 오류가 발생했습니다.' });
    }
  }, [discountSettings, toast]);

  const canApplyDiscount = useCallback((branchId: string, orderTotal: number) => {
    if (!discountSettings) return false;
    const branchSettings = discountSettings.branchSettings[branchId];
    const globalSettings = discountSettings.globalSettings;
    if (!branchSettings?.isActive) return false;
    const now = new Date();
    const startDate = new Date(globalSettings.startDate);
    const endDate = new Date(globalSettings.endDate);
    if (now < startDate || now > endDate) return false;
    const minAmount = branchSettings.minOrderAmount || globalSettings.minOrderAmount;
    if (orderTotal < minAmount) return false;
    return true;
  }, [discountSettings]);

  const getActiveDiscountRates = useCallback((branchId: string) => {
    if (!discountSettings) return [];
    const branchSettings = discountSettings.branchSettings[branchId];
    if (!branchSettings?.isActive) return [];
    return branchSettings.discountRates.filter(rate => rate.isActive);
  }, [discountSettings]);

  useEffect(() => {
    fetchDiscountSettings();
  }, [fetchDiscountSettings]);

  return {
    discountSettings, loading, error, fetchDiscountSettings, updateGlobalSettings, updateBranchSettings, canApplyDiscount, getActiveDiscountRates,
  };
}
