"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type {
  ExpenseRequest,
  Budget,
  MaterialRequest,
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS
} from '@/types';

export interface ReportFilter {
  dateFrom: Date;
  dateTo: Date;
  branchIds?: string[];
  departmentIds?: string[];
  categories?: ExpenseCategory[];
  userIds?: string[];
}

export interface ExpenseReport {
  summary: {
    totalAmount: number;
    totalCount: number;
    averageAmount: number;
    approvalRate: number;
    topCategory: string;
    topBranch: string;
  };
  categoryBreakdown: {
    category: ExpenseCategory;
    categoryName: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  branchBreakdown: {
    branchId: string;
    branchName: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  monthlyTrend: {
    month: string;
    amount: number;
    count: number;
    approved: number;
    rejected: number;
  }[];
  topExpenses: ExpenseRequest[];
}

export interface BudgetReport {
  summary: {
    totalBudgets: number;
    totalAllocated: number;
    totalUsed: number;
    totalRemaining: number;
    averageUsage: number;
    overBudgetCount: number;
  };
  categoryPerformance: {
    category: ExpenseCategory;
    categoryName: string;
    allocated: number;
    used: number;
    remaining: number;
    usage: number;
    efficiency: 'excellent' | 'good' | 'fair' | 'poor';
  }[];
  branchPerformance: {
    branchId: string;
    branchName: string;
    allocated: number;
    used: number;
    remaining: number;
    usage: number;
  }[];
  budgetAlerts: {
    budgetId: string;
    budgetName: string;
    usage: number;
    severity: 'high' | 'medium' | 'low';
    message: string;
  }[];
}

export interface PurchaseReport {
  summary: {
    totalRequests: number;
    totalAmount: number;
    completionRate: number;
    averageProcessingTime: number;
    urgentRequests: number;
  };
  materialBreakdown: {
    materialId: string;
    materialName: string;
    requestCount: number;
    totalQuantity: number;
    totalAmount: number;
  }[];
  branchActivity: {
    branchId: string;
    branchName: string;
    requestCount: number;
    totalAmount: number;
    completionRate: number;
  }[];
  statusDistribution: {
    status: string;
    count: number;
    percentage: number;
  }[];
}

export interface ConsolidatedReport {
  period: {
    from: Date;
    to: Date;
  };
  overview: {
    totalExpenses: number;
    totalBudget: number;
    budgetUtilization: number;
    purchaseRequests: number;
    costSavings: number;
  };
  expenseReport: ExpenseReport;
  budgetReport: BudgetReport;
  purchaseReport: PurchaseReport;
  recommendations: {
    type: 'budget_adjustment' | 'cost_reduction' | 'process_improvement';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    estimatedImpact: number;
  }[];
}

export function useReports() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateExpenseReport = useCallback(async (filter: ReportFilter): Promise<ExpenseReport> => {
    try {
      setLoading(true);
      let query = supabase.from('expense_requests')
        .select('*')
        .gte('created_at', filter.dateFrom.toISOString())
        .lte('created_at', filter.dateTo.toISOString())
        .order('created_at', { ascending: false });

      if (filter.branchIds?.length) query = query.in('branch_id', filter.branchIds);

      const { data, error } = await query;
      if (error) throw error;

      let expenses = (data || []).map(row => ({
        id: row.id,
        branchId: row.branch_id,
        branchName: row.branch_name,
        totalAmount: row.total_amount,
        status: row.status,
        items: row.items || [],
        createdAt: row.created_at,
        // ... map other fields if needed for topExpenses
      })) as any[];

      if (filter.categories?.length) {
        expenses = expenses.filter(e =>
          e.items.some((item: any) => filter.categories!.includes(item.category))
        );
      }

      const totalAmount = expenses.reduce((sum, e) => sum + Number(e.totalAmount), 0);
      const totalCount = expenses.length;
      const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
      const approvedCount = expenses.filter(e => e.status === 'approved' || e.status === 'paid').length;
      const approvalRate = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;

      const categoryData = expenses.reduce((acc, expense) => {
        expense.items.forEach((item: any) => {
          if (!acc[item.category]) {
            acc[item.category] = { amount: 0, count: 0 };
          }
          acc[item.category].amount += Number(item.amount);
          acc[item.category].count += 1;
        });
        return acc;
      }, {} as Record<string, { amount: number; count: number }>);

      const categoryBreakdown = Object.entries(categoryData).map(([category, data]) => ({
        category: category as ExpenseCategory,
        categoryName: EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] || category,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      })).sort((a, b) => b.amount - a.amount);

      const branchData = expenses.reduce((acc, expense) => {
        if (!acc[expense.branchId]) {
          acc[expense.branchId] = { branchName: expense.branchName, amount: 0, count: 0 };
        }
        acc[expense.branchId].amount += Number(expense.totalAmount);
        acc[expense.branchId].count += 1;
        return acc;
      }, {} as Record<string, { branchName: string; amount: number; count: number }>);

      const branchBreakdown = Object.entries(branchData).map(([branchId, data]) => ({
        branchId,
        branchName: data.branchName,
        amount: data.amount,
        count: data.count,
        percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0
      })).sort((a, b) => b.amount - a.amount);

      const monthlyData = expenses.reduce((acc, expense) => {
        const date = new Date(expense.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[monthKey]) {
          acc[monthKey] = { amount: 0, count: 0, approved: 0, rejected: 0 };
        }
        acc[monthKey].amount += Number(expense.totalAmount);
        acc[monthKey].count += 1;
        if (expense.status === 'approved' || expense.status === 'paid') {
          acc[monthKey].approved += 1;
        } else if (expense.status === 'rejected') {
          acc[monthKey].rejected += 1;
        }
        return acc;
      }, {} as Record<string, any>);

      const monthlyTrend = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data as any
      })).sort((a, b) => a.month.localeCompare(b.month));

      const topExpensesResult = expenses
        .sort((a, b) => Number(b.totalAmount) - Number(a.totalAmount))
        .slice(0, 10);

      const topCategory = categoryBreakdown[0]?.categoryName || '';
      const topBranch = branchBreakdown[0]?.branchName || '';

      return {
        summary: { totalAmount, totalCount, averageAmount, approvalRate, topCategory, topBranch },
        categoryBreakdown,
        branchBreakdown,
        monthlyTrend,
        topExpenses: topExpensesResult
      };
    } catch (error) {
      console.error('Error generating expense report:', error);
      toast({ variant: 'destructive', title: '리포트 생성 실패', description: '오류가 발생했습니다.' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const generateBudgetReport = useCallback(async (filter: ReportFilter): Promise<BudgetReport> => {
    try {
      setLoading(true);
      let query = supabase.from('budgets').select('*').eq('is_active', true);
      if (filter.branchIds?.length) query = query.in('branch_id', filter.branchIds);

      const { data, error } = await query;
      if (error) throw error;

      let budgets = (data || []).map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        allocatedAmount: Number(row.allocated_amount),
        usedAmount: Number(row.used_amount),
        remainingAmount: Number(row.remaining_amount),
        branchId: row.branch_id,
        branchName: row.branch_name
      }));

      const totalBudgets = budgets.length;
      const totalAllocated = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
      const totalUsed = budgets.reduce((sum, b) => sum + b.usedAmount, 0);
      const totalRemaining = budgets.reduce((sum, b) => sum + b.remainingAmount, 0);
      const averageUsage = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
      const overBudgetCount = budgets.filter(b => b.usedAmount > b.allocatedAmount).length;

      const categoryData = budgets.reduce((acc, budget) => {
        if (!acc[budget.category]) {
          acc[budget.category] = { allocated: 0, used: 0, remaining: 0, count: 0 };
        }
        acc[budget.category].allocated += budget.allocatedAmount;
        acc[budget.category].used += budget.usedAmount;
        acc[budget.category].remaining += budget.remainingAmount;
        acc[budget.category].count += 1;
        return acc;
      }, {} as Record<string, any>);

      const categoryPerformance = Object.entries(categoryData).map(([category, data]) => {
        const usage = data.allocated > 0 ? (data.used / data.allocated) * 100 : 0;
        let efficiency: 'excellent' | 'good' | 'fair' | 'poor';
        if (usage >= 80 && usage <= 100) efficiency = 'excellent';
        else if (usage >= 60 && usage < 120) efficiency = 'good';
        else if (usage >= 40 && usage < 140) efficiency = 'fair';
        else efficiency = 'poor';
        return {
          category: category as ExpenseCategory,
          categoryName: EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] || category,
          allocated: data.allocated,
          used: data.used,
          remaining: data.remaining,
          usage,
          efficiency
        };
      }).sort((a, b) => b.allocated - a.allocated);

      const branchData = budgets.reduce((acc, budget) => {
        const branchKey = budget.branchId || 'headquarters';
        const branchName = budget.branchName || '본사';
        if (!acc[branchKey]) {
          acc[branchKey] = { branchName, allocated: 0, used: 0, remaining: 0 };
        }
        acc[branchKey].allocated += budget.allocatedAmount;
        acc[branchKey].used += budget.usedAmount;
        acc[branchKey].remaining += budget.remainingAmount;
        return acc;
      }, {} as Record<string, any>);

      const branchPerformance = Object.entries(branchData).map(([branchId, data]) => ({
        branchId,
        branchName: data.branchName,
        allocated: data.allocated,
        used: data.used,
        remaining: data.remaining,
        usage: data.allocated > 0 ? (data.used / data.allocated) * 100 : 0
      })).sort((a, b) => b.allocated - a.allocated);

      const budgetAlerts = budgets.map(budget => {
        const usage = budget.allocatedAmount > 0 ? (budget.usedAmount / budget.allocatedAmount) * 100 : 0;
        let severity: 'high' | 'medium' | 'low';
        let message: string;
        if (usage >= 100) {
          severity = 'high';
          message = `예산을 ${(usage - 100).toFixed(1)}% 초과했습니다.`;
        } else if (usage >= 80) {
          severity = usage >= 90 ? 'high' : 'medium';
          message = `예산 사용률이 ${usage.toFixed(1)}%에 도달했습니다.`;
        } else return null;
        return { budgetId: budget.id, budgetName: budget.name, usage, severity, message };
      }).filter(alert => alert !== null) as any[];

      return {
        summary: { totalBudgets, totalAllocated, totalUsed, totalRemaining, averageUsage, overBudgetCount },
        categoryPerformance,
        branchPerformance,
        budgetAlerts
      };
    } catch (error) {
      console.error('Error generating budget report:', error);
      toast({ variant: 'destructive', title: '리포트 생성 실패', description: '오류가 발생했습니다.' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const generateConsolidatedReport = useCallback(async (filter: ReportFilter): Promise<ConsolidatedReport> => {
    try {
      setLoading(true);
      const [expenseReport, budgetReport] = await Promise.all([
        generateExpenseReport(filter),
        generateBudgetReport(filter)
      ]);

      const { data: purchasesData, error: purchaseError } = await supabase.from('material_requests')
        .select('*')
        .gte('created_at', filter.dateFrom.toISOString())
        .lte('created_at', filter.dateTo.toISOString());

      if (purchaseError) throw purchaseError;
      const purchases = (purchasesData || []).map(row => ({
        status: row.status,
        requestedItems: row.requested_items || []
      }));

      const purchaseReport: PurchaseReport = {
        summary: {
          totalRequests: purchases.length,
          totalAmount: purchases.reduce((sum, p) =>
            sum + p.requestedItems.reduce((itemSum: number, item: any) =>
              itemSum + (Number(item.requestedQuantity) * Number(item.estimatedPrice)), 0
            ), 0
          ),
          completionRate: purchases.length > 0 ?
            (purchases.filter(p => p.status === 'completed').length / purchases.length) * 100 : 0,
          averageProcessingTime: 0,
          urgentRequests: purchases.filter(p =>
            p.requestedItems.some((item: any) => item.urgency === 'urgent')
          ).length
        },
        materialBreakdown: [],
        branchActivity: [],
        statusDistribution: []
      };

      const overview = {
        totalExpenses: expenseReport.summary.totalAmount,
        totalBudget: budgetReport.summary.totalAllocated,
        budgetUtilization: budgetReport.summary.averageUsage,
        purchaseRequests: purchaseReport.summary.totalRequests,
        costSavings: 0
      };

      const recommendations: any[] = [];
      if (budgetReport.summary.overBudgetCount > 0) {
        recommendations.push({
          type: 'budget_adjustment',
          title: '예산 조정 필요',
          description: `${budgetReport.summary.overBudgetCount}개 예산이 초과되었습니다.`,
          priority: 'high',
          estimatedImpact: budgetReport.summary.overBudgetCount * 100000
        });
      }

      return {
        period: { from: filter.dateFrom, to: filter.dateTo },
        overview,
        expenseReport,
        budgetReport,
        purchaseReport,
        recommendations
      };
    } catch (error) {
      console.error('Error generating consolidated report:', error);
      toast({ variant: 'destructive', title: '통합 리포트 생성 실패', description: '오류가 발생했습니다.' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [generateExpenseReport, generateBudgetReport, toast]);

  const exportToCSV = useCallback((data: any[], filename: string) => {
    try {
      if (data.length === 0) return;
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        }).join(','))
      ].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: '내보내기 완료', description: `${filename}.csv 파일이 다운로드되었습니다.` });
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      toast({ variant: 'destructive', title: '내보내기 실패', description: '오류가 발생했습니다.' });
    }
  }, [toast]);

  return { loading, generateExpenseReport, generateBudgetReport, generateConsolidatedReport, exportToCSV };
}
