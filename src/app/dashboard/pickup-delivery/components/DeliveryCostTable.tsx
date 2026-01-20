"use client";

import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, MapPin } from "lucide-react";
import { Order } from "@/hooks/use-orders";

interface DeliveryCostTableProps {
  orders: Order[];
  onCostInput: (order: Order) => void;
}

export function DeliveryCostTable({ orders, onCostInput }: DeliveryCostTableProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-muted/30 p-8 rounded-lg text-center border-2 border-dashed">
        <p className="text-sm text-muted-foreground">배송 완료된 주문이 없습니다.</p>
        <p className="text-xs text-muted-foreground mt-1">배송 관리 탭에서 배송을 완료하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-xl">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="w-[100px]">주문번호</TableHead>
            <TableHead>수령자</TableHead>
            <TableHead>배송지</TableHead>
            <TableHead>배송기사</TableHead>
            <TableHead>고객 배송비</TableHead>
            <TableHead>실제 배송비</TableHead>
            <TableHead>차익(Profit)</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">정산</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="hover:bg-slate-50/50">
              <TableCell className="font-mono text-[10px] text-slate-400">
                {order.id.slice(0, 8)}
              </TableCell>
              <TableCell className="font-medium">{order.deliveryInfo?.recipientName || '-'}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 max-w-[180px]">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                  <span className="truncate text-xs text-slate-600" title={order.deliveryInfo?.address}>
                    {order.deliveryInfo?.address || '-'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-[10px]">
                  <div className="font-bold text-slate-700">{order.deliveryInfo?.driverName || '-'}</div>
                  <div className="text-slate-400">{order.deliveryInfo?.driverAffiliation || '-'}</div>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                ₩{(order.summary?.deliveryFee || 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-sm font-bold">
                {order.actualDeliveryCost ? (
                  `₩${order.actualDeliveryCost.toLocaleString()}`
                ) : (
                  <span className="text-slate-300 font-normal italic">미입력</span>
                )}
              </TableCell>
              <TableCell>
                {order.deliveryProfit !== undefined ? (
                  <Badge variant="outline" className={`border-none px-0 font-bold ${order.deliveryProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {order.deliveryProfit >= 0 ? '+' : ''}₩{order.deliveryProfit.toLocaleString()}
                  </Badge>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </TableCell>
              <TableCell>
                {order.actualDeliveryCost ? (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 h-5 text-[10px]">입력완료</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-2 h-5 text-[10px]">미입력</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCostInput(order)}
                  className="h-8 px-3 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  {order.actualDeliveryCost ? '수정' : '입력'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
