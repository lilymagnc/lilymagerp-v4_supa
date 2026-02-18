"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onPrintMessage?: (order: Order) => void;
}



export function OrderDetailDialog({ isOpen, onOpenChange, order, onPrintMessage }: OrderDetailDialogProps) {
  const { user } = useAuth();
  const { updateOrder } = useOrders();
  const [editOrderDate, setEditOrderDate] = useState("");
  const [editPaymentDate, setEditPaymentDate] = useState("");
  const [editSecondPaymentDate, setEditSecondPaymentDate] = useState(""); // 2차 결제일 수정 상태 추가

  const [editPaymentMethod, setEditPaymentMethod] = useState("");
  const [editFirstPaymentMethod, setEditFirstPaymentMethod] = useState("");
  const [editSecondPaymentMethod, setEditSecondPaymentMethod] = useState("");

  const [isDateEditing, setIsDateEditing] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      setEditOrderDate(order.orderDate ? format(parseDate(order.orderDate), "yyyy-MM-dd") : "");
      // 1차 결제일 (또는 일반 결제일) 초기화. 분할결제면 firstPaymentDate 우선, 없으면 completedAt
      const firstDate = order.payment?.isSplitPayment
        ? (order.payment.firstPaymentDate || order.payment.completedAt)
        : order.payment?.completedAt;

      setEditPaymentDate(firstDate ? format(parseDate(firstDate), "yyyy-MM-dd'T'HH:mm") : "");

      // 2차 결제일 초기화 (없으면 completedAt으로 폴백)
      const secDate = order.payment?.secondPaymentDate || (order.payment?.isSplitPayment ? order.payment?.completedAt : null);
      setEditSecondPaymentDate(secDate ? format(parseDate(secDate), "yyyy-MM-dd'T'HH:mm") : "");

      // Payment Methods Logic
      const p: any = order.payment || {};
      setEditPaymentMethod(p.method || 'card');
      setEditFirstPaymentMethod(p.firstPaymentMethod || p.method || 'card');
      setEditSecondPaymentMethod(p.secondPaymentMethod || p.method || 'card');

      setIsDateEditing(false);
    }
  }, [order, isOpen]);

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
      const original = new Date(order.orderDate);

      // 1. Order Date
      if (editOrderDate) {
        const newDate = new Date(editOrderDate);
        // Preserve time from original
        newDate.setHours(original.getHours(), original.getMinutes(), original.getSeconds());
        updates.orderDate = newDate.toISOString();
      }

      // 2. Payment Date & Method
      if (editPaymentDate || editSecondPaymentDate || editPaymentMethod || editFirstPaymentMethod || editSecondPaymentMethod) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentPayment: any = order.payment || {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newPayment: any = { ...currentPayment };

        if (currentPayment.isSplitPayment) {
          newPayment.firstPaymentMethod = editFirstPaymentMethod;
          newPayment.secondPaymentMethod = editSecondPaymentMethod;
        } else {
          newPayment.method = editPaymentMethod;
        }

        // 1차 결제일 (또는 일반 결제일) 수정
        if (editPaymentDate) {
          const d = new Date(editPaymentDate).toISOString();
          if (currentPayment.isSplitPayment) {
            // 분할결제: 1차 결제일만 수정 (완료일 건드리지 않음)
            newPayment.firstPaymentDate = d;
          } else {
            // 일반결제: 완료일 = 1차 결제일
            newPayment.completedAt = d;
            newPayment.firstPaymentDate = d;
          }
        }

        // 2차 결제일 수정 (분할결제인 경우만)
        if (editSecondPaymentDate && currentPayment.isSplitPayment) {
          const d = new Date(editSecondPaymentDate).toISOString();
          // 2차 결제일 필드 업데이트 및 완료일 동기화
          newPayment.secondPaymentDate = d;
          newPayment.completedAt = d;
        }

        updates.payment = newPayment;
      }

      // Force update if methods changed even if dates didn't (ensure updates object is populated)
      if (Object.keys(updates).length === 0) {
        // Check if only methods changed
        const currentMethod = order.payment?.method;
        const currentFirst = order.payment?.firstPaymentMethod;
        const currentSecond = order.payment?.secondPaymentMethod;

        let changed = false;
        const newPayment: any = { ...order.payment };

        if (order.payment?.isSplitPayment) {
          if (editFirstPaymentMethod !== currentFirst) {
            newPayment.firstPaymentMethod = editFirstPaymentMethod;
            changed = true;
          }
          if (editSecondPaymentMethod !== currentSecond) {
            newPayment.secondPaymentMethod = editSecondPaymentMethod;
            changed = true;
          }
        } else {
          if (editPaymentMethod !== currentMethod) {
            newPayment.method = editPaymentMethod;
            changed = true;
          }
        }

        if (changed) {
          updates.payment = newPayment;
        }
      }

      await updateOrder(order.id, updates);
      setIsDateEditing(false);
      // toast is handled in updateOrder
    } catch (e) {
      console.error(e);
    }
  };

  if (!order) return null;
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">완료</Badge>;
      case 'processing':
        return <Badge variant="secondary">처리중</Badge>;
      case 'canceled':
        return <Badge variant="destructive">취소</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'card':
        return '카드';
      case 'cash':
        return '현금';
      case 'transfer':
        return '계좌이체';
      case 'mainpay':
        return '메인페이';
      case 'shopping_mall':
        return '쇼핑몰';
      case 'epay':
        return '이페이';
      default:
        return method;
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
            <Badge className="bg-blue-500 text-white">완결</Badge>
            {completedAt && (
              <span className="text-xs text-gray-500">
                {format(parseDate(completedAt), 'MM/dd HH:mm')}
              </span>
            )}
          </div>
        );
      case 'split_payment':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-orange-500 text-white font-semibold">분할결제</Badge>
            <span className="text-xs text-gray-500">후결제 대기</span>
          </div>
        );
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">미결</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  const getDeliveryMethodBadge = (method: string) => {
    switch (method) {
      case 'pickup':
        return <Badge variant="outline" className="bg-green-50 text-green-700">픽업</Badge>;
      case 'delivery':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">배송</Badge>;
      default:
        return <Badge variant="outline">{method}</Badge>;
    }
  };
  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case 'card':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">카드</Badge>;
      case 'ribbon':
        return <Badge variant="outline" className="bg-pink-50 text-pink-700">리본</Badge>;
      case 'none':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">없음</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            주문 상세 정보
            <span className="text-sm font-normal text-muted-foreground">
              ({order.id})
            </span>
          </DialogTitle>
          <DialogDescription>
            주문의 상세 정보를 확인합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* 관리자 데이터 정정 섹션 */}
          {isAdmin && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-3">
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
                        className="bg-white"
                      />
                      <p className="text-[10px] text-gray-500">
                        * 변경 시 주문 접수 건수가 이동됩니다. (결제일도 자동 변경됨)
                      </p>
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
                        className="bg-white"
                      />
                      <div className="mt-2">
                        <Label className="text-xs font-semibold text-red-600 mb-1 block">
                          {order.payment?.isSplitPayment ? '1차 결제 수단' : '결제 수단'}
                        </Label>
                        <Select
                          value={order.payment?.isSplitPayment ? editFirstPaymentMethod : editPaymentMethod}
                          onValueChange={order.payment?.isSplitPayment ? setEditFirstPaymentMethod : setEditPaymentMethod}
                        >
                          <SelectTrigger className="bg-white h-8 text-xs">
                            <SelectValue placeholder="결제 수단 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="card">카드</SelectItem>
                            <SelectItem value="cash">현금</SelectItem>
                            <SelectItem value="transfer">계좌이체</SelectItem>
                            <SelectItem value="mainpay">메인페이</SelectItem>
                            <SelectItem value="kakao">카카오페이</SelectItem>
                            <SelectItem value="naver">네이버페이</SelectItem>
                            <SelectItem value="zero">제로페이</SelectItem>
                            <SelectItem value="shopping_mall">쇼핑몰</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-[10px] text-gray-500">
                        * {order.payment?.isSplitPayment ? '1차 결제일 (계약금/선결제)' : '결제 완료일 (매출/정산일)'}
                      </p>
                    </div>

                    {/* 분할결제인 경우 2차 결제일 수정 필드 추가 */}
                    {order.payment?.isSplitPayment && (
                      <div className="space-y-2">
                        <Label htmlFor="edit-second-payment-date" className="text-xs font-semibold text-orange-600">
                          2차 결제일 (잔금 입금일)
                        </Label>
                        <Input
                          id="edit-second-payment-date"
                          type="datetime-local"
                          value={editSecondPaymentDate}
                          onChange={(e) => setEditSecondPaymentDate(e.target.value)}
                          className="bg-white"
                        />
                        <div className="mt-2">
                          <Label className="text-xs font-semibold text-orange-600 mb-1 block">2차 결제 수단</Label>
                          <Select value={editSecondPaymentMethod} onValueChange={setEditSecondPaymentMethod}>
                            <SelectTrigger className="bg-white h-8 text-xs">
                              <SelectValue placeholder="결제 수단 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="card">카드</SelectItem>
                              <SelectItem value="cash">현금</SelectItem>
                              <SelectItem value="transfer">계좌이체</SelectItem>
                              <SelectItem value="mainpay">메인페이</SelectItem>
                              <SelectItem value="kakao">카카오페이</SelectItem>
                              <SelectItem value="naver">네이버페이</SelectItem>
                              <SelectItem value="zero">제로페이</SelectItem>
                              <SelectItem value="shopping_mall">쇼핑몰</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-[10px] text-gray-500">
                          * 잔금 입금 날짜를 정정합니다.
                        </p>
                      </div>
                    )}
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

          {/* 주문 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                주문 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">출고지점</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {order.transferInfo?.isTransferred && order.transferInfo?.processBranchName
                        ? order.transferInfo.processBranchName
                        : order.branchName}
                    </p>
                    {order.transferInfo?.isTransferred && (
                      <Badge variant="outline" className="text-xs">
                        이관됨
                      </Badge>
                    )}
                    {order.outsourceInfo?.isOutsourced && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                        외부발주
                      </Badge>
                    )}
                  </div>
                  {order.transferInfo?.isTransferred && (
                    <p className="text-xs text-gray-500">
                      발주지점: {order.branchName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">주문일시</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.orderDate && format(parseDate(order.orderDate), 'yyyy-MM-dd HH:mm')}
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">주문 상태</span>
                  </div>
                  <div className="flex gap-2">
                    {getStatusBadge(order.status)}
                    {order.payment && getPaymentStatusBadge(order)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">결제 수단</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.payment?.isSplitPayment ? (
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="text-green-600 font-medium flex items-center flex-wrap gap-1">
                          <span>선결제: {order.payment.firstPaymentMethod ? getPaymentMethodText(order.payment.firstPaymentMethod) : '미설정'} (₩{order.payment.firstPaymentAmount?.toLocaleString() || 0})</span>
                          {order.payment.firstPaymentDate && (
                            <span className="text-xs text-gray-400 font-normal">
                              [{format(parseDate(order.payment.firstPaymentDate), 'MM/dd HH:mm')}]
                            </span>
                          )}
                        </div>
                        <div className="text-orange-600 font-medium flex items-center flex-wrap gap-1">
                          <span>후결제: {order.payment.secondPaymentMethod ? getPaymentMethodText(order.payment.secondPaymentMethod) : '미설정'} (₩{order.payment.secondPaymentAmount?.toLocaleString() || 0})</span>
                          {(order.payment.secondPaymentDate || ((order.payment.status === 'paid' || order.payment.status === 'completed') && order.payment.completedAt)) && (
                            <span className="text-xs text-gray-400 font-normal">
                              [{format(parseDate(order.payment.secondPaymentDate || order.payment.completedAt), 'MM/dd HH:mm')}]
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {order.payment?.method ? getPaymentMethodText(order.payment.method) : '미정'}
                      </p>
                    )}
                    {order.payment?.isSplitPayment && (
                      <Badge variant="secondary" className="text-xs">분할결제</Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* 주문자 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                주문자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">주문자명</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.orderer.name}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">연락처</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{order.orderer.contact}</p>
                </div>
                {order.orderer.company && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">회사명</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{order.orderer.company}</p>
                  </div>
                )}
                {order.orderer.email && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">이메일</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{order.orderer.email}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* 수령 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                수령 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">수령 방법</span>
                  </div>
                  {getDeliveryMethodBadge(order.receiptType === 'delivery_reservation' ? 'delivery' : 'pickup')}
                </div>
                {(order.pickupInfo || order.deliveryInfo) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">픽업/배송일시</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {order.pickupInfo?.date && order.pickupInfo?.time
                        ? `${order.pickupInfo.date} ${order.pickupInfo.time}`
                        : order.deliveryInfo?.date && order.deliveryInfo?.time
                          ? `${order.deliveryInfo.date} ${order.deliveryInfo.time}`
                          : '-'
                      }
                    </p>
                  </div>
                )}
                {order.pickupInfo && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">픽업자명</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.pickupInfo.pickerName}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">픽업자 연락처</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.pickupInfo.pickerContact}</p>
                    </div>
                  </>
                )}
                {order.deliveryInfo && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">수령인명</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.deliveryInfo.recipientName}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">수령인 연락처</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.deliveryInfo.recipientContact}</p>
                    </div>
                    {order.deliveryInfo.address && (
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">배송 주소</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{order.deliveryInfo.address}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          {/* 주문 상품 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                주문 상품
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        수량: {item.quantity}개
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₩{item.price.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">
                        총 ₩{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {/* 메시지 정보 */}
          {order.message && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    메시지 정보
                  </div>
                  {onPrintMessage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2"
                      onClick={() => onPrintMessage(order)}
                    >
                      <Printer className="h-4 w-4" />
                      메시지 인쇄
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">메시지 타입</span>
                    </div>
                    {getMessageTypeBadge(order.message.type)}
                  </div>
                </div>
                {/* 메시지 내용에서 보내는 사람 분리 */}
                {(order.message.content || (order.message as any).sender) && (
                  (() => {
                    let messageContent = order.message.content || '';
                    let senderName = (order.message as any).sender || null;

                    // 구분자로 분리 시도 (sender가 따로 없으면)
                    if (!senderName && messageContent.includes('\n---\n')) {
                      const messageParts = messageContent.split('\n---\n');
                      messageContent = messageParts[0];
                      senderName = messageParts.length > 1 ? messageParts[1] : null;
                    }

                    return (
                      <>
                        {senderName && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">보내는 분</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{senderName}</p>
                          </div>
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">메시지 내용</span>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm whitespace-pre-wrap">{messageContent}</p>
                          </div>
                        </div>
                      </>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          )}
          {/* 특별 요청사항 */}
          {order.request && order.request.trim() && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  특별 요청사항
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap text-amber-800">
                    {order.request}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {/* 이관 정보 */}
          {order.transferInfo?.isTransferred && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  이관 정보
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">처리 지점</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.transferInfo.processBranchName}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">이관일시</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.transferInfo.transferDate &&
                          format(parseDate(order.transferInfo.transferDate), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                  </div>
                  {order.transferInfo.transferReason && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">이관 사유</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.transferInfo.transferReason}
                      </p>
                    </div>
                  )}
                  {order.transferInfo.amountSplit && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">금액 분배</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">발주지점</p>
                          <p className="font-medium">{order.transferInfo.amountSplit.orderBranch}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">수주지점</p>
                          <p className="font-medium">{order.transferInfo.amountSplit.processBranch}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {order.transferInfo.notes && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">추가 메모</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.transferInfo.notes}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* 외부 발주 정보 */}
          {order.outsourceInfo?.isOutsourced && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <ExternalLink className="h-4 w-4" />
                  외부 발주 정보 (재주문)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">수주처 (파트너)</p>
                      <p className="font-medium text-sm">{order.outsourceInfo.partnerName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">발주일시</p>
                      <p className="font-medium text-sm">
                        {order.outsourceInfo.outsourcedAt && format(parseDate(order.outsourceInfo.outsourcedAt), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">발주가</p>
                      <p className="font-medium text-sm text-blue-700">₩{order.outsourceInfo.partnerPrice.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">예상 수익액</p>
                      <p className="font-medium text-sm text-green-700">₩{order.outsourceInfo.profit.toLocaleString()}</p>
                    </div>
                  </div>
                  {order.outsourceInfo.notes && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">전달 사항</p>
                      <p className="text-sm border-t pt-2 mt-1">{order.outsourceInfo.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* 주문 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                주문 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">상품 금액</span>
                  <span className="text-sm">₩{order.summary.subtotal.toLocaleString()}</span>
                </div>
                {order.summary.pointsUsed > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="text-sm">포인트 사용</span>
                    <span className="text-sm">-₩{order.summary.pointsUsed.toLocaleString()}</span>
                  </div>
                )}
                {order.summary.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">배송비</span>
                    <span className="text-sm">₩{order.summary.deliveryFee.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium">
                  <span>총 결제금액</span>
                  <span>₩{order.summary.total.toLocaleString()}</span>
                </div>
                {/* 분할결제 정보 */}
                {order.payment?.isSplitPayment && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-blue-600">분할결제 내역</div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">
                          선결제 ({order.payment.firstPaymentMethod ? getPaymentMethodText(order.payment.firstPaymentMethod) : '미설정'})
                        </span>
                        <span className="text-green-600 font-medium">₩{(order.payment.firstPaymentAmount || 0).toLocaleString()}</span>
                      </div>
                      {order.payment.firstPaymentDate && (
                        <div className="text-xs text-muted-foreground text-right">
                          {format(parseDate(order.payment.firstPaymentDate), 'yyyy-MM-dd HH:mm')}
                        </div>
                      )}

                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-orange-600">
                          후결제 ({order.payment.secondPaymentMethod ? getPaymentMethodText(order.payment.secondPaymentMethod) : '미설정'})
                        </span>
                        <span className="text-orange-600 font-medium">₩{(order.payment.secondPaymentAmount || 0).toLocaleString()}</span>
                      </div>
                      {(order.payment.secondPaymentDate || ((order.payment.status === 'paid' || order.payment.status === 'completed') && order.payment.completedAt)) && (
                        <div className="text-xs text-muted-foreground text-right">
                          {format(parseDate(order.payment.secondPaymentDate || order.payment.completedAt), 'yyyy-MM-dd HH:mm')}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {order.summary.pointsEarned > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span className="text-sm">적립 포인트</span>
                    <span className="text-sm">+{order.summary.pointsEarned.toLocaleString()} P</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 
