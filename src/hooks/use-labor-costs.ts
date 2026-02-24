"use client";
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface EmployeeFinancial {
    id?: string;
    employee_id: string;
    employment_type: string; // '정규직', '프리랜서', '아르바이트'
    salary_type: string; // '월급', '시급'
    base_salary: number;
    bank_name: string;
    account_number: string;
}

export interface SalaryStatement {
    id?: string;
    employee_id: string;
    branch_name: string;
    payment_year_month: string;
    employment_type: string;
    base_pay: number;
    overtime_pay: number;
    meal_allowance: number;
    custom_allowance_name: string;
    custom_allowance: number;
    gross_pay: number;
    national_pension: number;
    health_insurance: number;
    long_term_care: number;
    employment_insurance: number;
    income_tax: number;
    local_income_tax: number;
    freelancer_tax: number;
    total_deductions: number;
    net_pay: number;
    status: string; // 'draft', 'confirmed'
}

export function useLaborCosts(selectedMonth: string) {
    const [employees, setEmployees] = useState<any[]>([]);
    const [financials, setFinancials] = useState<Record<string, EmployeeFinancial>>({});
    const [statements, setStatements] = useState<Record<string, SalaryStatement>>({});
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. 직원 정보 모두 가져오기
            const { data: empData, error: empError } = await supabase.from('employees').select('*').order('name');
            if (empError) throw empError;

            setEmployees(empData || []);

            // 2. 금융 정보 가져오기
            const { data: finData, error: finError } = await supabase.from('employee_financials').select('*');
            if (finError) throw finError;

            const finMap: Record<string, EmployeeFinancial> = {};
            (finData || []).forEach(f => {
                finMap[f.employee_id] = f;
            });
            setFinancials(finMap);

            // 3. 해당 월의 정산 내역 가져오기
            if (selectedMonth) {
                const { data: stmtData, error: stmtError } = await supabase
                    .from('salary_statements')
                    .select('*')
                    .eq('payment_year_month', selectedMonth);
                if (stmtError) throw stmtError;

                const stmtMap: Record<string, SalaryStatement> = {};
                (stmtData || []).forEach(s => {
                    stmtMap[s.employee_id] = s;
                });
                setStatements(stmtMap);
            }
        } catch (error: any) {
            console.error("Error fetching labor costs:", error);
            toast({ variant: 'destructive', title: '조회 실패', description: error.message });
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 금융 정보 저장
    const saveFinancial = async (data: EmployeeFinancial) => {
        try {
            const payload = {
                employee_id: data.employee_id,
                employment_type: data.employment_type,
                salary_type: data.salary_type,
                base_salary: data.base_salary,
                bank_name: data.bank_name || '',
                account_number: data.account_number || '',
            };

            if (data.id) {
                await supabase.from('employee_financials').update(payload).eq('id', data.id);
            } else {
                await supabase.from('employee_financials').insert([payload]);
            }
            toast({ title: '성공', description: '직원 계약/계좌 정보가 저장되었습니다.' });
            await fetchData();
        } catch (error: any) {
            console.error('Save financial error:', error);
            toast({ variant: 'destructive', title: '저장 실패', description: error.message });
            throw error;
        }
    };

    // 월 정산 저장
    const saveStatement = async (data: SalaryStatement) => {
        try {
            if (data.id) {
                await supabase.from('salary_statements').update(data).eq('id', data.id);
            } else {
                await supabase.from('salary_statements').insert([data]);
            }
            toast({ title: '성공', description: '급여 정산 내역이 저장되었습니다.' });
            await fetchData();
        } catch (error: any) {
            console.error('Save statement error:', error);
            toast({ variant: 'destructive', title: '저장 실패', description: error.message });
            throw error;
        }
    };

    return {
        employees,
        financials,
        statements,
        loading,
        refresh: fetchData,
        saveFinancial,
        saveStatement
    };
}
