"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, Clock, AlertCircle } from "lucide-react";
import { Order } from "@/hooks/use-orders";
import { format, isToday, parse, isBefore, addHours } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface TodayDashboardProps {
    pickupOrders: Order[];
    deliveryOrders: Order[];
}

export function TodayDashboard({ pickupOrders, deliveryOrders }: TodayDashboardProps) {
    const todayPickups = pickupOrders.filter(o => o.pickupInfo?.date && isToday(new Date(o.pickupInfo.date)));
    const todayDeliveries = deliveryOrders.filter(o => o.deliveryInfo?.date && isToday(new Date(o.deliveryInfo.date)));

    const pendingPickups = todayPickups.filter(o => o.status === 'processing');
    const pendingDeliveries = todayDeliveries.filter(o => o.status === 'processing');

    const urgentItems = [...todayPickups, ...todayDeliveries]
        .filter(o => o.status === 'processing')
        .sort((a, b) => {
            const timeA = (a.pickupInfo?.time || a.deliveryInfo?.time || '23:59');
            const timeB = (b.pickupInfo?.time || b.deliveryInfo?.time || '23:59');
            return timeA.localeCompare(timeB);
        })
        .slice(0, 3);

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-blue-50/50 border-blue-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-blue-800">오늘의 픽업</CardTitle>
                    <Package className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-blue-900">{pendingPickups.length}<span className="text-sm font-medium ml-1">건 대기 중</span></div>
                    <p className="text-xs text-blue-600/70 mt-1">전체 {todayPickups.length}건 중 {todayPickups.length - pendingPickups.length}건 완료</p>
                </CardContent>
            </Card>

            <Card className="bg-purple-50/50 border-purple-100">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-purple-800">오늘의 배송</CardTitle>
                    <Truck className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black text-purple-900">{pendingDeliveries.length}<span className="text-sm font-medium ml-1">건 대기 중</span></div>
                    <p className="text-xs text-purple-600/70 mt-1">전체 {todayDeliveries.length}건 중 {todayDeliveries.length - pendingDeliveries.length}건 완료</p>
                </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-100 col-span-1 md:col-span-2 lg:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-orange-800">우선 처리 항목</CardTitle>
                    <Clock className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent className="p-0 px-6 pb-4">
                    {urgentItems.length > 0 ? (
                        <div className="space-y-2">
                            {urgentItems.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-orange-100 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="h-5 px-1 bg-orange-100 text-orange-700 border-none text-[10px]">
                                            {item.pickupInfo ? '픽업' : '배송'}
                                        </Badge>
                                        <span className="font-bold">{item.pickupInfo?.time || item.deliveryInfo?.time}</span>
                                        <span className="text-slate-500 truncate max-w-[80px]">{item.orderer.name} 님</span>
                                    </div>
                                    <AlertCircle className="h-3 w-3 text-orange-400" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-[68px] flex items-center justify-center text-xs text-slate-400">
                            현재 우선 처리할 항목이 없습니다.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
