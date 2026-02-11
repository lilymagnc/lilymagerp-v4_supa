"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

import { parseDate } from "@/lib/date-utils";
import {
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  Clock,
  Package,
  MessageSquare,
  FileText,
  CreditCard,
  Truck,
  Home,
  ArrowRightLeft,
  DollarSign,
  ExternalLink,
  Printer,
  Settings
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, Order } from "@/hooks/use-orders";
import { useState, useEffect } from "react";

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onPrintMessage?: (order: Order) => void;
}

export function OrderDetailDialog({ open, onOpenChange, order, onPrintMessage }: OrderDetailDialogProps) {
  const { user } = useAuth();
  const { updateOrder } = useOrders();
  const [editOrderDate, setEditOrderDate] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [isDateEditing, setIsDateEditing] = useState(false);

  useEffect(() => {
    if (order && open) {
      setEditOrderDate(order.orderDate ? format(parseDate(order.orderDate), "yyyy-MM-dd") : "");
      setEditPaymentDate(order.payment?.completedAt ? format(parseDate(order.payment.completedAt), "yyyy-MM-dd'T'HH:mm") : "");
      setIsDateEditing(false);
    }
  }, [order, open]);

  // Handle Order Date Change with Auto-Sync to Payment Date
  const handleOrderDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setEditOrderDate(newDate);

    // Auto-sync payment date to same day (preserving current time if possible, or 09:00 default)
    if (newDate) {
      // If there was an existing payment time, try to keep it, otherwise use 09:00
      const currentPaymentTime = editPaymentDate ? editPaymentDate.split('T')[1] : "09:00";
      setEditPaymentDate(`${newDate}T${currentPaymentTime}`);
    }
  };

  const isAdmin = user?.email === 'lilymag0301@gmail.com' || user?.role === '본사 관리자' || (user?.role as any) === 'admin' || (user?.role as any) === 'hq_manager';

  const handleSaveDateCorrection = async () => {
    if (!order) return;
    try {
      const updates: any = {};

      // 1. Order Date
      if (editOrderDate) {
        const original = new Date(order.orderDate);
        const newDate = new Date(editOrderDate);
        newDate.setHours(original.getHours(), original.getMinutes(), original.getSeconds());
        updates.orderDate = newDate.toISOString();
      }

      // 2. Payment Date
      if (editPaymentDate) {
        const currentPayment = order.payment || {};
        updates.payment = {
          ...currentPayment,
          completedAt: new Date(editPaymentDate).toISOString()
        };
      }

      await updateOrder(order.id, updates);
      setIsDateEditing(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (!order) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">완료</Badge>;
      case 'processing':
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">처리중</Badge>;
      case 'canceled':
        return <Badge variant="destructive">취소</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'card': return '카드';
      case 'cash': return '현금';
      case 'transfer': return '계좌이체';
      case 'mainpay': return '메인페이';
      case 'shopping_mall': return '쇼핑몰';
      case 'epay': return '이페이';
      default: return method;
    }
  };

  const getPaymentStatusBadge = (order: any) => {
    const status = order.payment?.status;
    const completedAt = order.payment?.completedAt;

    switch (status) {
      case 'paid':
      case 'completed':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-blue-600 text-white border-none">완결</Badge>
            {completedAt && (
              <span className="text-[10px] text-gray-400">
                {format(parseDate(completedAt), 'MM/dd HH:mm')}
              </span>
            )}
          </div>
        );
      case 'split_payment':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-orange-500 text-white font-semibold border-none text-[10px]">분할결제</Badge>
            <span className="text-[10px] text-gray-500">후결제 대기</span>
          </div>
        );
      case 'pending':
        return <Badge className="bg-amber-500 text-white border-none">미결</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDeliveryMethodBadge = (method: string) => {
    switch (method) {
      case 'pickup':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">픽업</Badge>;
      case 'delivery':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">배송</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case 'card':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">카드</Badge>;
      case 'ribbon':
        return <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">리본</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">없음</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="h-6 w-6 text-blue-600" />
            주문 상세 정보
            <Badge variant="secondary" className="font-mono font-normal">
              {order.id.slice(0, 8)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            주문의 상세 내용을 확인하고 관리합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 관리자 데이터 정정 섹션 */}
          {isAdmin && (
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center justify-between text-base text-red-700">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    관리자 데이터 정정
                  </div>
                  <Button
                    variant={isDateEditing ? "outline" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsDateEditing(!isDateEditing)}
                  >
                    {isDateEditing ? "취소" : "수정 모드"}
                  </Button>
                </CardTitle>
              </CardHeader>
              {isDateEditing && (
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-order-date" className="text-xs font-semibold text-red-600">
                        주문 일자 (접수일)
                      </Label>
                      <Input
                        id="edit-order-date"
                        type="date"
                        value={editOrderDate}
                        onChange={handleOrderDateChange}
                        className="bg-white border-red-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-payment-date" className="text-xs font-semibold text-red-600">
                        결제 완료일 (매출/정산일)
                      </Label>
                      <Input
                        id="edit-payment-date"
                        type="datetime-local"
                        value={editPaymentDate}
                        onChange={(e) => setEditPaymentDate(e.target.value)}
                        className="bg-white border-red-200"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button size="sm" onClick={handleSaveDateCorrection} className="bg-red-600 hover:bg-red-700 text-white">
                      변경사항 저장
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 주문 기본 정보 */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-50/50 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <FileText className="h-4 w-4 text-slate-500" />
                  주문 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">출고지점</span>
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold">
                        {order.transferInfo?.isTransferred && order.transferInfo?.processBranchName
                          ? order.transferInfo.processBranchName
                          : order.branchName}
                      </p>
                      {order.transferInfo?.isTransferred && <Badge className="h-4 text-[9px] px-1 bg-purple-100 text-purple-700 border-none">이관</Badge>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">주문일시</span>
                    <p className="text-sm">{order.orderDate && format(parseDate(order.orderDate), 'yyyy-MM-dd HH:mm')}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">진행상태</span>
                    <div className="flex gap-1.5 mt-0.5">
                      {getStatusBadge(order.status)}
                      {order.payment && getPaymentStatusBadge(order)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">결제수단</span>
                    <p className="text-sm font-medium">
                      {order.payment?.isSplitPayment ? '분할결제' : (order.payment?.method ? getPaymentMethodText(order.payment.method) : '미정')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 주문자 정보 */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-50/50 py-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <User className="h-4 w-4 text-slate-500" />
                  주문자 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">주문자명</span>
                    <p className="text-sm font-bold">{order.orderer.name}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">연락처</span>
                    <p className="text-sm font-medium">{order.orderer.contact}</p>
                  </div>
                  {order.orderer.company && (
                    <div className="space-y-1 col-span-2">
                      <span className="text-[11px] text-muted-foreground">회사명</span>
                      <p className="text-sm">{order.orderer.company}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 수령 정보 */}
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50/50 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Truck className="h-4 w-4 text-slate-500" />
                수령/배송 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">수령 방법</span>
                    <div>{getDeliveryMethodBadge(order.receiptType === 'delivery_reservation' ? 'delivery' : 'pickup')}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">예정 일시</span>
                    <p className="text-sm font-bold text-blue-600">
                      {order.pickupInfo?.date && order.pickupInfo?.time
                        ? `${order.pickupInfo.date} ${order.pickupInfo.time}`
                        : order.deliveryInfo?.date && order.deliveryInfo?.time
                          ? `${order.deliveryInfo.date} ${order.deliveryInfo.time}`
                          : '-'
                      }
                    </p>
                  </div>
                </div>

                {order.pickupInfo ? (
                  <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-green-50/30 p-3 rounded-lg border border-green-100">
                    <div className="space-y-1">
                      <span className="text-[11px] text-green-600 font-semibold">픽업자</span>
                      <p className="text-sm font-bold">{order.pickupInfo.pickerName}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-green-600 font-semibold">연락처</span>
                      <p className="text-sm">{order.pickupInfo.pickerContact}</p>
                    </div>
                  </div>
                ) : order.deliveryInfo ? (
                  <div className="md:col-span-2 space-y-3 bg-blue-50/30 p-3 rounded-lg border border-blue-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[11px] text-blue-600 font-semibold">수령인</span>
                        <p className="text-sm font-bold">{order.deliveryInfo.recipientName}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-blue-600 font-semibold">연락처</span>
                        <p className="text-sm">{order.deliveryInfo.recipientContact}</p>
                      </div>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-blue-100">
                      <span className="text-[11px] text-blue-600 font-semibold">배송 주소</span>
                      <p className="text-sm flex items-start gap-1">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 text-blue-400" />
                        {order.deliveryInfo.address}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {/* 주문 상품 */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 py-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Package className="h-4 w-4 text-slate-500" />
                주문 상품 목록
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">수량: {item.quantity}개</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground line-through">₩{item.price.toLocaleString()}</p>
                      <p className="font-bold text-sm">₩{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50/80 p-4 space-y-2 border-t">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>상품 합계</span>
                  <span>₩{order.summary.subtotal.toLocaleString()}</span>
                </div>
                {order.summary.deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>배송비</span>
                    <span>₩{order.summary.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                {order.summary.pointsUsed > 0 && (
                  <div className="flex justify-between text-xs text-red-500">
                    <span>포인트 사용</span>
                    <span>-₩{order.summary.pointsUsed.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>총 결제금액</span>
                  <span className="text-blue-600">₩{order.summary.total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 메시지 및 요청사항 */}
          {(order.message || (order.request && order.request.trim())) && (
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-50/50 py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <MessageSquare className="h-4 w-4 text-slate-500" />
                    메시지 및 요청사항
                  </CardTitle>
                  {order.message && onPrintMessage && (
                    <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onPrintMessage(order)}>
                      <Printer className="h-3 w-3" /> 인쇄하기
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {order.message && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">메시지 타입:</span>
                      {getMessageTypeBadge(order.message.type)}
                    </div>
                    <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{order.message.content}</p>
                    </div>
                  </div>
                )}
                {order.request && order.request.trim() && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-amber-600">특별 요청사항:</span>
                    <div className="p-3 bg-amber-50/30 rounded-lg border border-amber-100">
                      <p className="text-sm text-amber-800 leading-relaxed font-medium">{order.request}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 이관/외부 정보 */}
          {(order.transferInfo?.isTransferred || order.outsourceInfo?.isOutsourced) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {order.transferInfo?.isTransferred && (
                <Card className="shadow-sm border-purple-100 bg-purple-50/10">
                  <CardHeader className="py-3 bg-purple-50/50">
                    <CardTitle className="text-xs font-bold text-purple-700 flex items-center gap-2">
                      <ArrowRightLeft className="h-3.5 w-3.5" /> 이관 처리 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">처리지점</span>
                      <span className="font-bold">{order.transferInfo.processBranchName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">이관일시</span>
                      <span>{order.transferInfo.transferDate && format(parseDate(order.transferInfo.transferDate), 'yyyy-MM-dd HH:mm')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              {order.outsourceInfo?.isOutsourced && (
                <Card className="shadow-sm border-blue-100 bg-blue-50/10">
                  <CardHeader className="py-3 bg-blue-50/50">
                    <CardTitle className="text-xs font-bold text-blue-700 flex items-center gap-2">
                      <ExternalLink className="h-3.5 w-3.5" /> 외부 발주 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">수주처</span>
                      <span className="font-bold">{order.outsourceInfo.partnerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">정산가</span>
                      <span className="text-blue-600 font-bold">₩{order.outsourceInfo.partnerPrice.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
