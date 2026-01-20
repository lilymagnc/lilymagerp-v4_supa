"use client";
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  // 예산 목록 조회
  const fetchBudgets = useCallback(async (filters?: {
    fiscalYear?: number;
    category?: ExpenseCategory;
    branchId?: string;
    isActive?: boolean;
  }) => {
    try {
      setLoading(true);
      let budgetQuery = query(
        collection(db, 'budgets'),
        orderBy('createdAt', 'desc')
      );
      if (filters?.fiscalYear) {
        budgetQuery = query(budgetQuery, where('fiscalYear', '==', filters.fiscalYear));
      }
      if (filters?.category) {
        budgetQuery = query(budgetQuery, where('category', '==', filters.category));
      }
      if (filters?.branchId) {
        budgetQuery = query(budgetQuery, where('branchId', '==', filters.branchId));
      }
      if (filters?.isActive !== undefined) {
        budgetQuery = query(budgetQuery, where('isActive', '==', filters.isActive));
      }
      const snapshot = await getDocs(budgetQuery);
      const budgetData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Budget[];
      setBudgets(budgetData);
      // 통계 계산
      const totalBudgets = budgetData.length;
      const totalAllocated = budgetData.reduce((sum, budget) => sum + budget.allocatedAmount, 0);
      const totalUsed = budgetData.reduce((sum, budget) => sum + budget.usedAmount, 0);
      const totalRemaining = budgetData.reduce((sum, budget) => sum + budget.remainingAmount, 0);
      const averageUsage = totalBudgets > 0 ? (totalUsed / totalAllocated) * 100 : 0;
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
      toast({
        variant: 'destructive',
        title: '오류',
        description: '예산 목록을 불러오는 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  // 예산 생성
  const createBudget = useCallback(async (data: CreateBudgetData) => {
    try {
      const budget: Omit<Budget, 'id'> = {
        ...data,
        usedAmount: 0,
        remainingAmount: data.allocatedAmount,
        isActive: true,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      const docRef = await addDoc(collection(db, 'budgets'), budget);
      toast({
        title: '예산 생성 완료',
        description: '새 예산이 성공적으로 생성되었습니다.'
      });
      await fetchBudgets();
      return docRef.id;
    } catch (error) {
      console.error('Error creating budget:', error);
      toast({
        variant: 'destructive',
        title: '예산 생성 실패',
        description: '예산 생성 중 오류가 발생했습니다.'
      });
      throw error;
    }
  }, [toast, fetchBudgets]);
  // 예산 수정
  const updateBudget = useCallback(async (
    budgetId: string, 
    data: Partial<CreateBudgetData>
  ) => {
    try {
      const docRef = doc(db, 'budgets', budgetId);
      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp()
      };
      // 할당 금액이 변경된 경우 잔여 금액 재계산
      if (data.allocatedAmount !== undefined) {
        const budget = budgets.find(b => b.id === budgetId);
        if (budget) {
          updateData.remainingAmount = data.allocatedAmount - budget.usedAmount;
        }
      }
      await updateDoc(docRef, updateData);
      toast({
        title: '예산 수정 완료',
        description: '예산이 성공적으로 수정되었습니다.'
      });
      await fetchBudgets();
    } catch (error) {
      console.error('Error updating budget:', error);
      toast({
        variant: 'destructive',
        title: '예산 수정 실패',
        description: '예산 수정 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchBudgets, budgets]);
  // 예산 삭제
  const deleteBudget = useCallback(async (budgetId: string) => {
    try {
      await deleteDoc(doc(db, 'budgets', budgetId));
      toast({
        title: '예산 삭제 완료',
        description: '예산이 삭제되었습니다.'
      });
      await fetchBudgets();
    } catch (error) {
      console.error('Error deleting budget:', error);
      toast({
        variant: 'destructive',
        title: '예산 삭제 실패',
        description: '예산 삭제 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchBudgets]);
  // 예산 사용량 업데이트
  const updateBudgetUsage = useCallback(async (
    budgetId: string,
    usageAmount: number,
    operation: 'add' | 'subtract' = 'add'
  ) => {
    try {
      await runTransaction(db, async (transaction) => {
        const budgetRef = doc(db, 'budgets', budgetId);
        const budgetDoc = await transaction.get(budgetRef);
        if (!budgetDoc.exists()) {
          throw new Error('예산을 찾을 수 없습니다.');
        }
        const budget = budgetDoc.data() as Budget;
        const newUsedAmount = operation === 'add' 
          ? budget.usedAmount + usageAmount
          : budget.usedAmount - usageAmount;
        const newRemainingAmount = budget.allocatedAmount - newUsedAmount;
        transaction.update(budgetRef, {
          usedAmount: Math.max(0, newUsedAmount),
          remainingAmount: newRemainingAmount,
          updatedAt: serverTimestamp()
        });
      });
      await fetchBudgets();
    } catch (error) {
      console.error('Error updating budget usage:', error);
      toast({
        variant: 'destructive',
        title: '예산 사용량 업데이트 실패',
        description: '예산 사용량 업데이트 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchBudgets]);
  // 예산 활성화/비활성화
  const toggleBudgetStatus = useCallback(async (budgetId: string, isActive: boolean) => {
    try {
      const docRef = doc(db, 'budgets', budgetId);
      await updateDoc(docRef, {
        isActive,
        updatedAt: serverTimestamp()
      });
      toast({
        title: `예산 ${isActive ? '활성화' : '비활성화'} 완료`,
        description: `예산이 ${isActive ? '활성화' : '비활성화'}되었습니다.`
      });
      await fetchBudgets();
    } catch (error) {
      console.error('Error toggling budget status:', error);
      toast({
        variant: 'destructive',
        title: '예산 상태 변경 실패',
        description: '예산 상태 변경 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchBudgets]);
  // 예산 초과 알림 확인
  const checkBudgetAlerts = useCallback(async () => {
    const alerts = budgets
      .filter(budget => budget.isActive)
      .map(budget => {
        const usage = calculateBudgetUsage(budget);
        const status = getBudgetStatus(budget);
        return {
          budget,
          usage,
          status,
          isOverBudget: budget.usedAmount > budget.allocatedAmount,
          isNearLimit: usage >= 80 && usage < 100
        };
      })
      .filter(alert => alert.isOverBudget || alert.isNearLimit);
    return alerts;
  }, [budgets]);
  // 예산별 지출 내역 조회
  const getBudgetExpenses = useCallback(async (budgetId: string) => {
    try {
      const budget = budgets.find(b => b.id === budgetId);
      if (!budget) return [];
      // 해당 예산 카테고리의 비용 신청들을 조회
      const expensesQuery = query(
        collection(db, 'expenseRequests'),
        where('fiscalYear', '==', budget.fiscalYear),
        where('status', 'in', ['approved', 'paid'])
      );
      const snapshot = await getDocs(expensesQuery);
      const expenses = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((expense: any) => {
          // 예산 조건에 맞는 비용만 필터링
          const categoryMatch = expense.items.some((item: any) => item.category === budget.category);
          const branchMatch = !budget.branchId || expense.branchId === budget.branchId;
          const monthMatch = !budget.fiscalMonth || expense.fiscalMonth === budget.fiscalMonth;
          return categoryMatch && branchMatch && monthMatch;
        });
      return expenses;
    } catch (error) {
      console.error('Error fetching budget expenses:', error);
      return [];
    }
  }, [budgets]);
  // 초기 데이터 로드
  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);
  return {
    budgets,
    loading,
    stats,
    fetchBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
    updateBudgetUsage,
    toggleBudgetStatus,
    checkBudgetAlerts,
    getBudgetExpenses
  };
}
