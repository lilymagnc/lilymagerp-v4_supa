"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface DeliveryFeeData {
  id: string;
  branchId: string;
  branchName: string;
  district: string;
  fee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useDeliveryFees() {
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const mapRowToFee = useCallback((row: any): DeliveryFeeData => ({
    id: row.id,
    branchId: row.branch_id,
    branchName: row.branch_name,
    district: row.district,
    fee: Number(row.fee),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }), []);

  const fetchDeliveryFees = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('delivery_fees')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;
      setDeliveryFees((data || []).map(mapRowToFee));
    } catch (error) {
      console.error("Error fetching delivery fees:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, mapRowToFee]);

  const getDeliveryFeesByBranch = useCallback((branchId: string) => {
    return deliveryFees.filter(fee => fee.branchId === branchId);
  }, [deliveryFees]);

  const updateDeliveryFee = async (feeId: string, updates: Partial<DeliveryFeeData>) => {
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };
      if (updates.district) payload.district = updates.district;
      if (updates.fee !== undefined) payload.fee = updates.fee;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;
      if (updates.branchId) payload.branch_id = updates.branchId;
      if (updates.branchName) payload.branch_name = updates.branchName;

      const { error } = await supabase.from('delivery_fees').update(payload).eq('id', feeId);
      if (error) throw error;

      toast({
        title: '성공',
        description: '배송비가 성공적으로 수정되었습니다.',
      });
      await fetchDeliveryFees();
    } catch (error) {
      console.error("Error updating delivery fee:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 수정 중 오류가 발생했습니다.',
      });
    }
  };

  const initializeDeliveryFees = async (branches: any[]) => {
    try {
      const payloads: any[] = [];
      branches.forEach(branch => {
        if (branch.deliveryFees) {
          branch.deliveryFees.forEach((fee: any) => {
            payloads.push({
              id: crypto.randomUUID(),
              branch_id: branch.id,
              branch_name: branch.name,
              district: fee.district,
              fee: fee.fee,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          });
        }
      });

      if (payloads.length > 0) {
        const { error } = await supabase.from('delivery_fees').insert(payloads);
        if (error) throw error;
      }

      await fetchDeliveryFees();
      toast({
        title: '성공',
        description: '배송비 데이터가 초기화되었습니다.',
      });
    } catch (error) {
      console.error("Error initializing delivery fees:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 초기화 중 오류가 발생했습니다.',
      });
    }
  };

  useEffect(() => {
    fetchDeliveryFees();
  }, [fetchDeliveryFees]);

  return {
    deliveryFees,
    loading,
    getDeliveryFeesByBranch,
    updateDeliveryFee,
    initializeDeliveryFees,
    refetch: fetchDeliveryFees
  };
}
