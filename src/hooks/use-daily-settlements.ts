"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { DailySettlementRecord } from '@/types/daily-settlement';

export function useDailySettlements() {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const getSettlement = useCallback(async (branchId: string, date: string): Promise<DailySettlementRecord | null> => {
        // Table doesn't exist in Supabase yet - settlements work without saved records
        return null;

        /* Disabled until table is created
        if (!branchId || !date) return null;
        setLoading(true);
        try {
            // Check if table exists first to prevent 404 errors in console
            const { data, error } = await supabase.from('daily_settlements')
                .select('*')
                .eq('branch_id', branchId)
                .eq('date', date)
                .maybeSingle();

            // Silently handle table not found error (PGRST205)
            if (error && error.code === 'PGRST205') {
                return null;
            }

            if (error) throw error;
            if (data) {
                return {
                    id: data.id,
                    branchId: data.branch_id,
                    branchName: data.branch_name,
                    date: data.date,
                    status: data.status,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    ...data.settlement_data
                } as DailySettlementRecord;
            }
            return null;
        } catch (error) {
            // Silently handle missing table - not critical for viewing settlements
            return null;
        } finally {
            setLoading(false);
        }
        */
    }, []);

    const saveSettlement = useCallback(async (data: Partial<DailySettlementRecord>) => {
        if (!data.branchId || !data.date) return false;
        setLoading(true);
        try {
            const { branchId, branchName, date, status, ...settlement_data } = data;
            const id = `${branchId}_${date}`;

            const payload = {
                id,
                branch_id: branchId,
                branch_name: branchName,
                date: date,
                status: status || 'completed',
                settlement_data: settlement_data,
                updated_at: new Date().toISOString()
            };

            const { data: existing } = await supabase.from('daily_settlements').select('created_at').eq('id', id).maybeSingle();
            if (!existing) {
                (payload as any).created_at = new Date().toISOString();
            }

            const { error } = await supabase.from('daily_settlements').upsert([payload]);
            if (error) throw error;

            toast({
                title: "정산 완료",
                description: `${data.date} 정산 정보가 저장되었습니다.`,
            });
            return true;
        } catch (error) {
            console.error('Error saving daily settlement:', error);
            toast({
                variant: "destructive",
                title: "저장 실패",
                description: "정산 정보 저장 중 오류가 발생했습니다.",
            });
            return false;
        } finally {
            setLoading(false);
        }
    }, [toast]);

    return {
        loading, getSettlement, saveSettlement
    };
}
