"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCircle, Phone } from "lucide-react";
import { Order } from "@/hooks/use-orders";

interface PickupTableProps {
    orders: Order[];
    onComplete: (orderId: string) => void;
    onRowClick: (order: Order) => void;
    formatDateTime: (date: string, time: string) => string;
    getStatusBadge: (status: string) => React.ReactNode;
}

export function PickupTable({
    orders,
    onComplete,
    onRowClick,
    formatDateTime,
    getStatusBadge
}: PickupTableProps) {
    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>픽업 예약 주문이 없습니다.</p>
                <p className="text-sm">주문 접수에서 '픽업예약'으로 주문을 생성하면 여기에 표시됩니다.</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[100px]">주문번호</TableHead>
                            <TableHead>주문자</TableHead>
                            <TableHead>픽업자</TableHead>
                            <TableHead>픽업 예정일시</TableHead>
                            <TableHead>연락처</TableHead>
                            <TableHead>지점</TableHead>
                            <TableHead>상태</TableHead>
                            <TableHead>금액</TableHead>
                            <TableHead className="text-center">작업</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow
                                key={order.id}
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onRowClick(order)}
                            >
                                <TableCell className="font-mono text-xs text-blue-600 font-medium">
                                    {order.id.slice(0, 8)}
                                </TableCell>
                                <TableCell className="font-medium">{order.orderer.name}</TableCell>
                                <TableCell>{order.pickupInfo?.pickerName || '-'}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                                        {formatDateTime(order.pickupInfo?.date || '', order.pickupInfo?.time || '')}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                                        {order.pickupInfo?.pickerContact || '-'}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{order.branchName}</span>
                                        {order.transferInfo?.isTransferred && (
                                            <Badge variant="outline" className="w-fit text-[10px] h-4 px-1 mt-0.5 border-orange-200 text-orange-600">
                                                이관: {order.transferInfo.processBranchName}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(order.status)}</TableCell>
                                <TableCell className="font-semibold">₩{order.summary.total.toLocaleString()}</TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    {order.status === 'processing' ? (
                                        <Button
                                            size="sm"
                                            onClick={() => onComplete(order.id)}
                                            className="bg-green-600 hover:bg-green-700 h-8 px-3"
                                        >
                                            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                                            픽업 완료
                                        </Button>
                                    ) : (
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none">완료됨</Badge>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
                {orders.map((order) => (
                    <div
                        key={order.id}
                        className="p-4 border rounded-xl bg-white shadow-sm active:bg-slate-50 relative"
                        onClick={() => onRowClick(order)}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <span className="text-[10px] text-slate-400 font-mono">#{order.id.slice(0, 8)}</span>
                                <h4 className="font-bold text-lg">{order.orderer.name} <span className="text-sm font-normal text-slate-500">님</span></h4>
                            </div>
                            <div>{getStatusBadge(order.status)}</div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600 mb-4">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{formatDateTime(order.pickupInfo?.date || '', order.pickupInfo?.time || '')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span>{order.pickupInfo?.pickerContact || '-'} ({order.pickupInfo?.pickerName || '픽업자 미지정'})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-slate-400" />
                                <span>{order.branchName} 지점</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                            <span className="font-bold text-blue-600">₩{order.summary.total.toLocaleString()}</span>
                            {order.status === 'processing' && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onComplete(order.id);
                                    }}
                                >
                                    <CheckCircle className="w-4 h-4 mr-1.5" />
                                    완료 처리
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
