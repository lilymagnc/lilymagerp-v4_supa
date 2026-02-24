"use client";

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface BranchLedgerData {
    branchName: string;
    revenue: number; // 총 매출
    variableCost: number; // 변동비 (재료비, 소모품 등)
    fixedCost: number; // 고정비 (임대료, 관리비, 공과금 등)
    laborCost: number; // 인건비 (급여명세서 net_pay + total_deductions = gross_pay)
    netProfit: number; // 순이익
}

export function useBranchLedger(selectedMonth: string) {
    const [ledgerData, setLedgerData] = useState<BranchLedgerData[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchLedger = useCallback(async () => {
        if (!selectedMonth) return;
        setLoading(true);

        try {
            // 1. Calculate Start and End dates for the selected month
            const [yearStr, monthStr] = selectedMonth.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59, 999);

            const startIso = startDate.toISOString();
            const endIso = endDate.toISOString();

            // Maps to hold aggregated data by branch
            const branchMap = new Map<string, BranchLedgerData>();

            const getOrInitBranch = (branchName: string) => {
                if (!branchMap.has(branchName)) {
                    branchMap.set(branchName, {
                        branchName,
                        revenue: 0,
                        variableCost: 0,
                        fixedCost: 0,
                        laborCost: 0,
                        netProfit: 0,
                    });
                }
                return branchMap.get(branchName)!;
            };

            // 2. Fetch Revenue from Orders
            // Only include orders that are not canceled
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('branch_name, summary, status')
                .gte('order_date', startIso)
                .lte('order_date', endIso);

            if (ordersError) throw ordersError;

            (orders || []).forEach(order => {
                if (order.status !== 'canceled') {
                    const branch = getOrInitBranch(order.branch_name || '미지정');
                    const total = order.summary?.total || 0;
                    branch.revenue += total;
                }
            });

            // 3. Fetch Variable and Fixed Costs from simple_expenses
            const { data: expenses, error: expensesError } = await supabase
                .from('simple_expenses')
                .select('branch_name, amount, category, sub_category')
                .gte('expense_date', startIso)
                .lte('expense_date', endIso);

            if (expensesError) throw expensesError;

            (expenses || []).forEach(exp => {
                const branch = getOrInitBranch(exp.branch_name || '미지정');
                const amount = Number(exp.amount || 0);

                // Exclude manual simple_expenses labor costs if they exist to prevent double-counting
                if (exp.sub_category === 'labor') {
                    // Do nothing, we will calculate labor from salary_statements
                    return;
                }

                // Define fixed costs as 'fixed_cost' and 'utility'. The rest are variable.
                if (exp.category === 'fixed_cost' || exp.category === 'utility') {
                    branch.fixedCost += amount;
                } else {
                    branch.variableCost += amount;
                }
            });

            // 4. Fetch Labor Costs from salary_statements
            const { data: salaryStmts, error: salaryError } = await supabase
                .from('salary_statements')
                .select('branch_name, gross_pay, status')
                .eq('payment_year_month', selectedMonth);

            if (salaryError) throw salaryError;

            (salaryStmts || []).forEach(salary => {
                // Only include confirmed salaries or all? Typically we should include all or only confirmed. Let's include confirmed.
                if (salary.status === 'confirmed') {
                    const branch = getOrInitBranch(salary.branch_name || '미지정');
                    const grossPay = Number(salary.gross_pay || 0);
                    branch.laborCost += grossPay;
                }
            });

            // 5. Calculate Net Profit
            const finalData: BranchLedgerData[] = [];
            branchMap.forEach(branch => {
                branch.netProfit = branch.revenue - (branch.variableCost + branch.fixedCost + branch.laborCost);
                finalData.push(branch);
            });

            // Sort alphabetically by branchName
            finalData.sort((a, b) => a.branchName.localeCompare(b.branchName));
            setLedgerData(finalData);

        } catch (error: any) {
            console.error("Error fetching ledger data:", error);
            toast({ variant: 'destructive', title: '조회 실패', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, toast]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger]);

    return {
        ledgerData,
        loading,
        refresh: fetchLedger
    };
}
