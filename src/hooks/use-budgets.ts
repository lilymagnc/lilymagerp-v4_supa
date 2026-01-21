"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type {
  Budget,
  ExpenseCategory,
  calculateBudgetUsage,
  getBudgetStatus
} from '@/types/expense';

export interface CreateBudgetData {
  name: string;
  category: ExpenseCategory;
  fiscalYear: number;
  fiscalMonth?: number;
  allocatedAmount: number;
  branchId?: string;
  branchName?: string;
  departmentId?: string;
  departmentName?: string;
  approvalLimits: {
    manager?: number;
    director?: number;
    executive?: number;
  };
}

export interface BudgetStats {
  totalBudgets: number;
  totalAllocated: number;
  totalUsed: number;
  totalRemaining: number;
  averageUsage: number;
  overBudgetCount: number;
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BudgetStats>({
    totalBudgets: 0,
    totalAllocated: 0,
    totalUsed: 0,
    totalRemaining: 0,
    averageUsage: 0,
    overBudgetCount: 0
  });
  const { toast } = useToast();

  const mapRowToBudget = (row: any): Budget => ({
    id: row.id,
    name: row.name,
    category: row.category,
    fiscalYear: row.fiscal_year,
    fiscalMonth: row.fiscal_month,
    allocatedAmount: row.allocated_amount,
    usedAmount: row.used_amount,
    remainingAmount: row.remaining_amount,
    branchId: row.branch_id,
    branchName: row.branch_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    approvalLimits: row.approval_limits,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchBudgets = useCallback(async (filters?: {
    fiscalYear?: number;
    category?: ExpenseCategory;
    branchId?: string;
    isActive?: boolean;
  }) => {
    try {
      setLoading(true);
      let query = supabase.from('budgets').select('*').order('created_at', { ascending: false });

      if (filters?.fiscalYear) query = query.eq('fiscal_year', filters.fiscalYear);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
      if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive);

      const { data, error } = await query;
      if (error) throw error;

      const budgetData = (data || []).map(mapRowToBudget);
      setBudgets(budgetData);

      // 통계 계산
      const totalBudgets = budgetData.length;
      const totalAllocated = budgetData.reduce((sum, budget) => sum + Number(budget.allocatedAmount), 0);
      const totalUsed = budgetData.reduce((sum, budget) => sum + Number(budget.usedAmount), 0);
      const totalRemaining = budgetData.reduce((sum, budget) => sum + Number(budget.remainingAmount), 0);
      const averageUsage = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
      const overBudgetCount = budgetData.filter(budget => budget.usedAmount > budget.allocatedAmount).length;

      setStats({
        totalBudgets,
        totalAllocated,
        totalUsed,
        totalRemaining,
        averageUsage,
        overBudgetCount
      });
    } catch (error) {
      console.error('Error fetching budgets:', error);
      toast({ variant: 'destructive', title: '오류', description: '예산 목록을 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createBudget = useCallback(async (data: CreateBudgetData) => {
    try {
      const id = crypto.randomUUID();
      const payload = {
        id,
        name: data.name,
        category: data.category,
        fiscal_year: data.fiscalYear,
        fiscal_month: data.fiscalMonth,
        allocated_amount: data.allocatedAmount,
        used_amount: 0,
        remaining_amount: data.allocatedAmount,
        branch_id: data.branchId,
        branch_name: data.branchName,
        department_id: data.departmentId,
        department_name: data.departmentName,
        approval_limits: data.approvalLimits,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('budgets').insert([payload]);
      if (error) throw error;

      toast({ title: '예산 생성 완료', description: '새 예산이 성공적으로 생성되었습니다.' });
      await fetchBudgets();
      return id;
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({ variant: 'destructive', title: '예산 생성 실패', description: '오류가 발생했습니다.' });
      throw error;
    }
  }, [toast, fetchBudgets]);

  const updateBudget = useCallback(async (budgetId: string, data: Partial<CreateBudgetData>) => {
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };

      if (data.name) payload.name = data.name;
      if (data.category) payload.category = data.category;
      if (data.fiscalYear) payload.fiscal_year = data.fiscalYear;
      if (data.fiscalMonth) payload.fiscal_month = data.fiscalMonth;
      if (data.branchId) payload.branch_id = data.branchId;
      if (data.branchName) payload.branch_name = data.branchName;
      if (data.departmentId) payload.department_id = data.departmentId;
      if (data.departmentName) payload.department_name = data.departmentName;
      if (data.approvalLimits) payload.approval_limits = data.approvalLimits;

      if (data.allocatedAmount !== undefined) {
        payload.allocated_amount = data.allocatedAmount;
        const budget = budgets.find(b => b.id === budgetId);
        if (budget) {
          payload.remaining_amount = data.allocatedAmount - budget.usedAmount;
        }
      }

      const { error } = await supabase.from('budgets').update(payload).eq('id', budgetId);
      if (error) throw error;

      toast({ title: '예산 수정 완료', description: '예산이 성공적으로 수정되었습니다.' });
      await fetchBudgets();
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({ variant: 'destructive', title: '예산 수정 실패', description: '오류가 발생했습니다.' });
    }
  }, [toast, fetchBudgets, budgets]);

  const deleteBudget = useCallback(async (budgetId: string) => {
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', budgetId);
      if (error) throw error;
      toast({ title: '예산 삭제 완료', description: '예산이 삭제되었습니다.' });
      await fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({ variant: 'destructive', title: '예산 삭제 실패', description: '오류가 발생했습니다.' });
    }
  }, [toast, fetchBudgets]);

  const updateBudgetUsage = useCallback(async (
    budgetId: string,
    usageAmount: number,
    operation: 'add' | 'subtract' = 'add'
  ) => {
    try {
      // In Supabase, we use a single query to update with atomicity if possible, 
      // but standard usage update usually involves checking current.
      // We can use a RPC or just a transaction-like update if we had it, 
      // but for now we'll do fetch then update.
      const { data: budget, error: fetchError } = await supabase.from('budgets').select('*').eq('id', budgetId).single();
      if (fetchError) throw fetchError;

      const newUsedAmount = operation === 'add'
        ? Number(budget.used_amount) + usageAmount
        : Number(budget.used_amount) - usageAmount;

      const newRemainingAmount = Number(budget.allocated_amount) - newUsedAmount;

      const { error: updateError } = await supabase.from('budgets').update({
        used_amount: Math.max(0, newUsedAmount),
        remaining_amount: newRemainingAmount,
        updated_at: new Date().toISOString()
      }).eq('id', budgetId);

      if (updateError) throw updateError;
      await fetchBudgets();
    } catch (error) {
      console.error('Error updating budget usage:', error);
      toast({ variant: 'destructive', title: '예산 사용량 업데이트 실패', description: '오류가 발생했습니다.' });
    }
  }, [toast, fetchBudgets]);

  const toggleBudgetStatus = useCallback(async (budgetId: string, isActive: boolean) => {
    try {
      const { error } = await supabase.from('budgets').update({
        is_active: isActive,
        updated_at: new Date().toISOString()
      }).eq('id', budgetId);
      if (error) throw error;
      toast({ title: `예산 ${isActive ? '활성화' : '비활성화'} 완료` });
      await fetchBudgets();
    } catch (error) {
      console.error('Error toggling budget status:', error);
      toast({ variant: 'destructive', title: '예산 상태 변경 실패' });
    }
  }, [toast, fetchBudgets]);

  const checkBudgetAlerts = useCallback(async () => {
    // This uses local state budgets
    const alerts = budgets
      .filter(budget => budget.isActive)
      .map(budget => {
        const usage = (Number(budget.usedAmount) / Number(budget.allocatedAmount)) * 100;
        return {
          budget,
          usage,
          isOverBudget: budget.usedAmount > budget.allocatedAmount,
          isNearLimit: usage >= 80 && usage < 100
        };
      })
      .filter(alert => alert.isOverBudget || alert.isNearLimit);
    return alerts;
  }, [budgets]);

  const getBudgetExpenses = useCallback(async (budgetId: string) => {
    try {
      const budget = budgets.find(b => b.id === budgetId);
      if (!budget) return [];

      let query = supabase.from('expense_requests')
        .select('*')
        .eq('status', 'paid') // Usually settled expenses
        .eq('fiscal_year', budget.fiscalYear);

      if (budget.branchId) query = query.eq('branch_id', budget.branchId);
      if (budget.fiscalMonth) query = query.eq('fiscal_month', budget.fiscalMonth);

      const { data, error } = await query;
      if (error) throw error;

      // Filter by category in items JSONB
      return (data || []).filter((expense: any) =>
        expense.items.some((item: any) => item.category === budget.category)
      );
    } catch (error) {
      console.error('Error fetching budget expenses:', error);
      return [];
    }
  }, [budgets]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  return {
    budgets, loading, stats, fetchBudgets, createBudget, updateBudget, deleteBudget, updateBudgetUsage, toggleBudgetStatus, checkBudgetAlerts, getBudgetExpenses
  };
}
