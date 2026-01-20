"use client";

import React, { useMemo } from "react";
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday
} from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Order } from "@/hooks/use-orders";

interface CalendarViewProps {
    orders: Order[];
    onDateClick: (date: Date) => void;
    currentDate: Date;
    onCurrentDateChange: (date: Date) => void;
}

export function CalendarView({ orders, onDateClick, currentDate, onCurrentDateChange }: CalendarViewProps) {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const ordersByDate = useMemo(() => {
        const map: Record<string, { pickups: number, deliveries: number }> = {};

        orders.forEach(order => {
            let dateKey = '';
            if (order.receiptType === 'pickup_reservation') {
                dateKey = order.pickupInfo?.date || '';
            } else if (order.receiptType === 'delivery_reservation') {
                dateKey = order.deliveryInfo?.date || '';
            }

            if (dateKey) {
                if (!map[dateKey]) map[dateKey] = { pickups: 0, deliveries: 0 };
                if (order.receiptType === 'pickup_reservation') map[dateKey].pickups++;
                else map[dateKey].deliveries++;
            }
        });

        return map;
    }, [orders]);

    const handlePrevMonth = () => onCurrentDateChange(subMonths(currentDate, 1));
    const handleNextMonth = () => onCurrentDateChange(addMonths(currentDate, 1));
    const handleToday = () => onCurrentDateChange(new Date());

    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-bold text-slate-800">
                    {format(currentDate, "yyyy년 M월", { locale: ko })}
                </h2>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday} className="h-8">오늘</Button>
                    <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 rounded-none border-r">
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-none">
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Weekdays */}
            <div className="grid grid-cols-7 bg-slate-50 border-b">
                {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                    <div key={day} className={cn(
                        "py-2 text-center text-xs font-semibold",
                        i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"
                    )}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-7 divide-x divide-y border-b border-r">
                {calendarDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayData = ordersByDate[dateKey];
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isCurrentDay = isToday(day);

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => onDateClick(day)}
                            className={cn(
                                "min-h-[100px] p-2 cursor-pointer transition-colors hover:bg-slate-50",
                                !isCurrentMonth && "bg-slate-50/50 text-slate-400",
                                isCurrentMonth && "bg-white"
                            )}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full",
                                    isCurrentDay && "bg-blue-600 text-white",
                                    !isCurrentDay && format(day, "e") === "1" && "text-red-500",
                                    !isCurrentDay && format(day, "e") === "7" && "text-blue-500"
                                )}>
                                    {format(day, "d")}
                                </span>
                                {dayData && (
                                    <div className="flex flex-col gap-0.5 items-end">
                                        {dayData.pickups > 0 && (
                                            <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-100">
                                                <Package className="w-2.5 h-2.5" />
                                                <span>{dayData.pickups}</span>
                                            </div>
                                        )}
                                        {dayData.deliveries > 0 && (
                                            <div className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full border border-blue-100">
                                                <Truck className="w-2.5 h-2.5" />
                                                <span>{dayData.deliveries}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Preview items if any (short limited list) */}
                            <div className="space-y-1 mt-1 opacity-60">
                                {/* Could show 1-2 customer names here if space permits */}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
