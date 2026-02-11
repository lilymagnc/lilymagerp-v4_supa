
"use client";

import React, { useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Order } from "@/hooks/use-orders";
import { format, parseISO, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";

interface DeliveryStatsChartProps {
    orders: Order[];
}

export function DeliveryStatsChart({ orders }: DeliveryStatsChartProps) {
    const chartData = useMemo(() => {
        const monthlyMap = new Map<string, { month: string, revenue: number, cost: number, profit: number }>();

        // 배송 완료된 주문만 집계
        orders.filter(o => o.status === 'completed' && o.deliveryInfo).forEach(order => {
            const dateStr = order.deliveryInfo?.date;
            if (!dateStr) return;

            const date = parseISO(dateStr);
            const monthStr = format(date, 'yyyy-MM');
            const monthLabel = format(date, 'M월', { locale: ko });

            const stats = monthlyMap.get(monthStr) || { month: monthLabel, revenue: 0, cost: 0, profit: 0 };

            const revenue = order.summary?.deliveryFee || 0;
            const cost = (order.actualDeliveryCost || 0) + (order.actualDeliveryCostCash || 0);
            const profit = order.deliveryProfit || (revenue - cost);

            stats.revenue += revenue;
            stats.cost += cost;
            stats.profit += profit;

            monthlyMap.set(monthStr, stats);
        });

        return Array.from(monthlyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([_, data]) => data);
    }, [orders]);

    if (chartData.length === 0) {
        return (
            <Card className="w-full">
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    집계할 데이터가 없습니다. (배송 완료 및 비용 입력 필요)
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid gap-6">
            <Card className="w-full border-none shadow-sm bg-white">
                <CardHeader>
                    <CardTitle className="text-lg">월별 배송 수익 분석</CardTitle>
                    <CardDescription>고객 수취 배송비 vs 실제 지출 비용 대비 수익 트렌드</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#64748b' }}
                                    tickFormatter={(value) => `₩${(value / 10000).toLocaleString()}만`}
                                />
                                <Tooltip
                                    formatter={(value: number) => `₩${value.toLocaleString()}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar name="고객 배송비" dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar name="실제 지출" dataKey="cost" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                <LineChart data={chartData}>
                                    <Line name="수익" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                                </LineChart>
                                <Bar name="순이익" dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-blue-600 font-medium">총 고객 배송비</CardDescription>
                        <CardTitle className="text-2xl font-bold">₩{chartData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-red-50/50 border-red-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-red-600 font-medium">총 실제 지출</CardDescription>
                        <CardTitle className="text-2xl font-bold">₩{chartData.reduce((sum, d) => sum + d.cost, 0).toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-emerald-50/50 border-emerald-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-emerald-600 font-medium">총 배송 수익</CardDescription>
                        <CardTitle className="text-2xl font-bold text-emerald-700">₩{chartData.reduce((sum, d) => sum + d.profit, 0).toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}
