
"use client";

import React, { useMemo } from "react";
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Order } from "@/hooks/use-orders";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

interface DeliveryStatsChartProps {
    orders: Order[];
}

export function DeliveryStatsChart({ orders }: DeliveryStatsChartProps) {
    const chartData = useMemo(() => {
        const monthlyMap = new Map<string, { month: string, rawDate: string, revenue: number, cost: number, profit: number }>();

        // 배송 정보가 있고 최소한 배송 날짜가 있는 주문만 집계
        // status가 canceled가 아닌 것만 집계 (completed, processing 등)
        const targetOrders = orders.filter(o =>
            (o.status === 'completed' || o.status === 'processing') &&
            !!o.deliveryInfo?.date &&
            o.receiptType === 'delivery_reservation'
        );

        targetOrders.forEach(order => {
            const dateStr = order.deliveryInfo?.date;
            if (!dateStr) return;

            const date = parseISO(dateStr);
            const monthKey = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'M월', { locale: ko });

            if (!monthlyMap.has(monthKey)) {
                monthlyMap.set(monthKey, {
                    month: monthLabel,
                    rawDate: monthKey,
                    revenue: 0,
                    cost: 0,
                    profit: 0
                });
            }

            const stats = monthlyMap.get(monthKey)!;

            // 고객이 지불한 배송비
            const revenue = order.summary?.deliveryFee || 0;

            // 실제 배송 지출 (카드 + 현금)
            const cost = (order.actualDeliveryCost || 0) + (order.actualDeliveryCostCash || 0);

            // 순수익 (계산된 값이 있으면 사용, 없으면 직접 계산)
            const profit = order.deliveryProfit ?? (revenue - cost);

            stats.revenue += revenue;
            stats.cost += cost;
            stats.profit += profit;
        });

        return Array.from(monthlyMap.values())
            .sort((a, b) => a.rawDate.localeCompare(b.rawDate));
    }, [orders]);

    // 요약 데이터 계산
    const summary = useMemo(() => {
        return chartData.reduce((acc, curr) => ({
            revenue: acc.revenue + curr.revenue,
            cost: acc.cost + curr.cost,
            profit: acc.profit + curr.profit
        }), { revenue: 0, cost: 0, profit: 0 });
    }, [chartData]);

    if (chartData.length === 0) {
        return (
            <Card className="w-full h-[400px] flex flex-col items-center justify-center text-muted-foreground bg-slate-50 border-dashed">
                <div className="p-4 rounded-full bg-white shadow-sm mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                </div>
                <p className="font-medium">집계할 배송 데이터가 없습니다</p>
                <p className="text-sm text-slate-400 mt-1">배송 주문이 완료되고 배송비가 입력되면 차트가 표시됩니다.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="w-full border shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-2 border-b bg-slate-50/40">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-800">월별 배송 수익 분석</CardTitle>
                            <CardDescription className="text-slate-500">배송 매출 vs 실제 비용 지출 추이</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {/* Optional: Add Filter/Download buttons here */}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                    tickFormatter={(value) => `₩${(value / 10000).toLocaleString()}만`}
                                    dx={-10}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(value: number) => [`₩${value.toLocaleString()}`, ""]}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: 'none',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                        padding: '12px 16px'
                                    }}
                                    itemStyle={{ padding: 0 }}
                                    labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="circle"
                                />
                                <Bar
                                    name="고객 배송비 (수입)"
                                    dataKey="revenue"
                                    fill="url(#colorRevenue)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={20}
                                />
                                <Bar
                                    name="실제 배송비 (지출)"
                                    dataKey="cost"
                                    fill="url(#colorCost)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={20}
                                />
                                <Line
                                    name="순수익"
                                    type="monotone"
                                    dataKey="profit"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-indigo-600 font-semibold text-xs uppercase tracking-wider">총 고객 배송비</CardDescription>
                        <CardTitle className="text-2xl font-bold text-slate-800">
                            ₩{summary.revenue.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-slate-400">전체 기간 누적 수입</div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-rose-600 font-semibold text-xs uppercase tracking-wider">총 실제 지출</CardDescription>
                        <CardTitle className="text-2xl font-bold text-slate-800">
                            ₩{summary.cost.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-slate-400">전체 기간 누적 지출</div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-600 font-semibold text-xs uppercase tracking-wider">총 배송 순수익</CardDescription>
                        <CardTitle className="text-2xl font-bold text-emerald-700">
                            ₩{summary.profit.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${summary.profit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                {summary.revenue > 0 ? ((summary.profit / summary.revenue) * 100).toFixed(1) : 0}% 마진
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
