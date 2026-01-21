"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type { BranchFormValues } from '@/app/dashboard/branches/components/branch-form';

export interface DeliveryFee {
  district: string;
  fee: number;
}

export interface Surcharges {
  mediumItem?: number;
  largeItem?: number;
  express?: number;
}

export interface Branch extends BranchFormValues {
  id: string;
  deliveryFees?: DeliveryFee[];
  surcharges?: Surcharges;
}

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('branches')
        .select('*');

      if (error) throw error;

      const branchesData = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        address: row.address,
        phone: row.phone,
        manager: row.manager,
        businessNumber: row.business_number,
        employeeCount: row.employee_count,
        deliveryFees: row.delivery_fees,
        surcharges: row.surcharges,
        account: row.account
      } as Branch));

      branchesData.sort((a, b) => {
        if (a.type === '본사') return -1;
        if (b.type === '본사') return 1;
        return a.name.localeCompare(b.name);
      });

      setBranches(branchesData);
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const addBranch = async (branch: BranchFormValues) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('branches')
        .insert([{
          id: Buffer.from(branch.name).toString('base64').substring(0, 20), // 임시 ID 생성 로직 (또는 UUID)
          name: branch.name,
          type: branch.type,
          address: branch.address,
          phone: branch.phone,
          manager: branch.manager,
          business_number: branch.businessNumber,
          employee_count: branch.employeeCount,
          account: branch.account
        }]);

      if (error) throw error;

      toast({
        title: '성공',
        description: '새 지점이 성공적으로 추가되었습니다.',
      });
      await fetchBranches();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 추가 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBranch = async (branchId: string, branch: BranchFormValues) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('branches')
        .update({
          name: branch.name,
          type: branch.type,
          address: branch.address,
          phone: branch.phone,
          manager: branch.manager,
          business_number: branch.businessNumber,
          employee_count: branch.employeeCount,
          account: branch.account
        })
        .eq('id', branchId);

      if (error) throw error;

      toast({
        title: '성공',
        description: '지점 정보가 성공적으로 수정되었습니다.',
      });
      await fetchBranches();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 정보 수정 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteBranch = async (branchId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchId);

      if (error) throw error;

      toast({
        title: '성공',
        description: '지점이 성공적으로 삭제되었습니다.',
      });
      await fetchBranches();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 삭제 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  return { branches, loading, addBranch, updateBranch, deleteBranch, fetchBranches };
}

