"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckCircle, Phone, MapPin, X, Truck } from "lucide-react";
import { Order } from "@/hooks/use-orders";
import { DeliveryPhotoUpload } from "@/components/delivery-photo-upload";

interface DeliveryTableProps {
    orders: Order[];
    onComplete: (orderId: string, photoUrl?: string) => void;
    onDeletePhoto: (orderId: string, photoUrl: string) => void;
    onEditDriver: (order: Order) => void;
    onRowClick: (order: Order) => void;
    formatDateTime: (date: string, time: string) => string;
    getStatusBadge: (status: string) => React.ReactNode;
}

export function DeliveryTable({
    orders,
    onComplete,
    onDeletePhoto,
    onEditDriver,
    onRowClick,
    formatDateTime,
    getStatusBadge
}: DeliveryTableProps) {
    if (orders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <p>배송 예약 주문이 없습니다.</p>
                <p className="text-sm">주문 접수에서 '배송예약'으로 주문을 생성하면 여기에 표시됩니다.</p>
            </div>
        );
    }

    return (
        <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 text-xs">
                            <TableHead>주문번호</TableHead>
                            <TableHead>주문자</TableHead>
                            <TableHead>수령자</TableHead>
                            <TableHead>예정일시</TableHead>
                            <TableHead>배송지</TableHead>
                            <TableHead>배송기사</TableHead>
                            <TableHead>배송비/익</TableHead>
                            <TableHead>지점</TableHead>
                            <TableHead>상태</TableHead>
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
                                <TableCell className="font-mono text-[10px] text-blue-600">
                                    {order.id.slice(0, 8)}
                                </TableCell>
                                <TableCell className="text-sm font-medium">{order.orderer.name}</TableCell>
                                <TableCell className="text-sm">{order.deliveryInfo?.recipientName || '-'}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                        <CalendarIcon className="w-3 h-3 text-slate-400" />
                                        {formatDateTime(order.deliveryInfo?.date || '', order.deliveryInfo?.time || '')}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 max-w-[150px]">
                                        <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                        <span className="truncate text-[11px]" title={order.deliveryInfo?.address}>
                                            {order.deliveryInfo?.address || '-'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <div className="space-y-0.5 text-[10px]">
                                        <div className="text-slate-500 font-medium">{order.deliveryInfo?.driverAffiliation || '소속 미정'}</div>
                                        <div className="font-bold">{order.deliveryInfo?.driverName || '기사 미정'}</div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onEditDriver(order)}
                                            className="h-6 px-1.5 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                            정보 수정
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {order.actualDeliveryCost ? (
                                        <div className="text-[11px]">
                                            <div className="font-bold">₩{order.actualDeliveryCost.toLocaleString()}</div>
                                            {order.deliveryProfit !== undefined && (
                                                <div className={`font-medium ${order.deliveryProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {order.deliveryProfit >= 0 ? '+' : ''}₩{order.deliveryProfit.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-slate-400 text-[10px]">미입력</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col text-[11px]">
                                        <span className="font-medium">{order.branchName}</span>
                                        {order.transferInfo?.isTransferred && (
                                            <Badge variant="outline" className="w-fit text-[9px] h-3.5 px-1 mt-0.5 border-orange-200 text-orange-600">
                                                {order.transferInfo.processBranchName}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(order.status)}</TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    {order.status === 'processing' ? (
                                        <div className="flex flex-col gap-1.5 items-center">
                                            <DeliveryPhotoUpload
                                                orderId={order.id}
                                                currentPhotoUrl={order.deliveryInfo?.completionPhotoUrl}
                                                onPhotoUploaded={(photoUrl) => onComplete(order.id, photoUrl)}
                                                onPhotoRemoved={() => { }}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onComplete(order.id)}
                                                className="h-7 px-2 text-[10px] w-full"
                                            >
                                                사진 없이 완료
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-1.5 items-center">
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none">완료됨</Badge>
                                            {order.deliveryInfo?.completionPhotoUrl && (
                                                <div className="flex gap-1 mt-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => window.open(order.deliveryInfo?.completionPhotoUrl, '_blank')}
                                                        className="h-6 px-1.5 text-[10px]"
                                                    >
                                                        📸 사진
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onDeletePhoto(order.id, order.deliveryInfo?.completionPhotoUrl || '')}
                                                        className="h-6 px-1 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
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
                            <div className="flex flex-col items-end gap-1">
                                {getStatusBadge(order.status)}
                                <span className="text-[10px] font-medium text-slate-500">{order.branchName}</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-600 mb-4 border-l-2 border-blue-100 pl-3">
                            <div className="flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">{formatDateTime(order.deliveryInfo?.date || '', order.deliveryInfo?.time || '')}</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                                <span className="flex-1 leading-tight">{order.deliveryInfo?.address || '-'}</span>
                            </div>
                            <div className="flex items-start gap-2">
                                <Truck className="w-4 h-4 text-slate-400 mt-0.5" />
                                <div className="flex-1 text-xs">
                                    <div><strong>{order.deliveryInfo?.driverName || '기사 미지정'}</strong> ({order.deliveryInfo?.driverAffiliation || '-'})</div>
                                    <div className="text-slate-400 mt-0.5">{order.deliveryInfo?.driverContact || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {order.actualDeliveryCost && (
                            <div className="flex justify-between items-center mb-4 p-2 bg-slate-50 rounded-lg text-xs">
                                <span className="text-slate-500">배송 비용</span>
                                <div className="text-right">
                                    <div className="font-bold">₩{order.actualDeliveryCost.toLocaleString()}</div>
                                    <div className={order.deliveryProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                        차익: {order.deliveryProfit >= 0 ? '+' : ''}₩{order.deliveryProfit?.toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEditDriver(order)}
                                className="h-8 text-xs"
                            >
                                정보 수정
                            </Button>

                            {order.status === 'processing' ? (
                                <div className="flex gap-2">
                                    <DeliveryPhotoUpload
                                        orderId={order.id}
                                        currentPhotoUrl={order.deliveryInfo?.completionPhotoUrl}
                                        onPhotoUploaded={(photoUrl) => onComplete(order.id, photoUrl)}
                                        onPhotoRemoved={() => { }}
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => onComplete(order.id)}
                                        className="h-8 text-[10px] text-slate-400 underline"
                                    >
                                        사진 없이
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    {order.deliveryInfo?.completionPhotoUrl && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => window.open(order.deliveryInfo?.completionPhotoUrl, '_blank')}
                                            className="h-8 text-xs"
                                        >
                                            📸 사진 보기
                                        </Button>
                                    )}
                                    <Badge variant="secondary" className="h-8 flex items-center bg-slate-100 text-slate-500 border-none">완료됨</Badge>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
