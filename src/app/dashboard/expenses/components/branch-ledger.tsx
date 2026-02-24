"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useBranchLedger } from '@/hooks/use-branch-ledger';
import { formatCurrency } from '@/types/simple-expense';
import { RefreshCw, TrendingUp, TrendingDown, Calendar as CalendarIcon } from 'lucide-react';

export function BranchLedger() {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    const { ledgerData, loading, refresh } = useBranchLedger(selectedMonth);

    return (
        <div className="space-y-6">
            {/* Top Filter Selection */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    통합 손익계산서
                </h2>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium mr-2">조회 연월:</span>
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
                        <span className="px-4 font-bold">{selectedMonth}</span>
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
                    <Button variant="outline" size="icon" onClick={() => refresh()}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 text-muted-foreground">로딩 중...</div>
            ) : ledgerData.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 border rounded-lg text-muted-foreground">
                    해당 월에는 기록된 매출이나 지출이 없습니다.
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {ledgerData.map((branch, idx) => (
                        <Card key={idx} className="overflow-hidden border-2 shadow-sm transition-all hover:shadow-md">
                            <div className={`h-2 ${branch.netProfit >= 0 ? 'bg-blue-600' : 'bg-red-500'}`} />
                            <CardHeader className="bg-slate-50/50 pb-4">
                                <CardTitle className="flex justify-between items-center text-lg">
                                    <span>🏢 {branch.branchName}</span>
                                    {branch.netProfit >= 0 ? (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                            <TrendingUp className="mr-1 h-3 w-3" /> 흑자
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                            <TrendingDown className="mr-1 h-3 w-3" /> 적자
                                        </Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">

                                <div className="flex justify-between items-center border-b pb-2">
                                    <span className="text-sm font-bold text-gray-700">총 매출 (Revenue)</span>
                                    <span className="font-bold text-blue-700 text-lg">{formatCurrency(branch.revenue)}</span>
                                </div>

                                <div className="space-y-2 text-sm text-gray-600 border-b pb-4">
                                    <div className="flex justify-between">
                                        <span>변동비 (사입/소모품 등)</span>
                                        <span className="font-medium text-red-600">- {formatCurrency(branch.variableCost)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>고정비 (임대료/공과금 등)</span>
                                        <span className="font-medium text-red-600">- {formatCurrency(branch.fixedCost)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span>인건비 (급여 지급 총액)</span>
                                        <span className="font-medium text-red-600">- {formatCurrency(branch.laborCost)}</span>
                                    </div>
                                </div>

                                <div className="bg-slate-100 rounded-lg p-3 flex justify-between items-center mt-2 shadow-inner">
                                    <span className="font-bold text-slate-800">매장 순이익 (Net Profit)</span>
                                    <span className={`text-xl font-black ${branch.netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                                        {formatCurrency(branch.netProfit)}
                                    </span>
                                </div>

                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

// Helper: minimal Badge component wrapper since it might not be imported if unused
import { Badge } from '@/components/ui/badge';
