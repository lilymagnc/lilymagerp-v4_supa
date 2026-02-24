"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { formatCurrency, FixedCostSubCategory, UtilitySubCategory, FIXED_COST_SUB_CATEGORY_LABELS, UTILITY_SUB_CATEGORY_LABELS } from '@/types/simple-expense';
import { Trash2, Calendar, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface FixedCostHistoryProps {
    branchId: string;
    refreshTrigger: number;
}

export function FixedCostHistory({ branchId, refreshTrigger }: FixedCostHistoryProps) {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const fetchHistory = useCallback(async () => {
        if (!branchId || !selectedMonth) return;
        setLoading(true);
        try {
            const [year, month] = selectedMonth.split('-');
            const startDate = new Date(Number(year), Number(month) - 1, 1).toISOString();
            const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59, 999).toISOString();

            const { data, error } = await supabase
                .from('simple_expenses')
                .select('*')
                .eq('branch_id', branchId)
                .in('category', ['fixed_cost', 'utility'])
                .gte('expense_date', startDate)
                .lte('expense_date', endDate)
                .order('expense_date', { ascending: false });

            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '조회 실패', description: '고정비 내역을 불러오는데 실패했습니다.' });
        } finally {
            setLoading(false);
        }
    }, [branchId, selectedMonth, toast]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory, refreshTrigger]);

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 회계장부에서도 자동 제외됩니다.')) return;
        try {
            const { error } = await supabase.from('simple_expenses').delete().eq('id', id);
            if (error) throw error;
            toast({ title: '삭제 완료', description: '선택한 고정비가 삭제되었습니다.' });
            fetchHistory();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '삭제 실패' });
        }
    };

    const totalAmount = history.reduce((sum, item) => sum + Number(item.amount), 0);

    return (
        <Card className="mt-6 border-2 border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50">
                <CardTitle className="flex justify-between items-center text-lg">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-indigo-600" />
                        월별 고정비 입력 내역 및 조회
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium mr-2">귀속 연월:</span>
                        <div className="flex items-center border rounded-md">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const [y, m] = selectedMonth.split('-');
                                    let d = new Date(Number(y), Number(m) - 2);
                                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                }}
                            >-</Button>
                            <span className="font-bold px-4">{selectedMonth}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const [y, m] = selectedMonth.split('-');
                                    let d = new Date(Number(y), Number(m));
                                    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                }}
                            >+</Button>
                        </div>
                        <Button variant="outline" size="icon" onClick={fetchHistory} disabled={loading} className="ml-2">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="border rounded-lg mb-6 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-100">
                                <TableHead className="font-semibold">결제(입력) 날짜</TableHead>
                                <TableHead className="font-semibold">항목명</TableHead>
                                <TableHead className="font-semibold">분류</TableHead>
                                <TableHead className="text-right font-semibold">금액</TableHead>
                                <TableHead className="w-[80px] text-center font-semibold">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground bg-white">
                                        해당 월에 입력된 고정비가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((item) => (
                                    <TableRow key={item.id} className="bg-white">
                                        <TableCell>{new Date(item.expense_date).toISOString().split('T')[0]}</TableCell>
                                        <TableCell className="font-medium text-slate-800">{item.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                                                {item.category === 'fixed_cost'
                                                    ? FIXED_COST_SUB_CATEGORY_LABELS[item.sub_category as FixedCostSubCategory] || item.sub_category
                                                    : UTILITY_SUB_CATEGORY_LABELS[item.sub_category as UtilitySubCategory] || item.sub_category}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-red-600">
                                            - {formatCurrency(item.amount)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} className="hover:bg-red-50 hover:text-red-600">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center shadow-inner border border-slate-200">
                    <span className="font-bold text-slate-700 text-lg">해당 월 고정비 총액 (회계 반영분)</span>
                    <span className="text-2xl font-black text-red-600">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
