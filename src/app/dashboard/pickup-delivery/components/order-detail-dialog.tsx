"use client";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Order } from "@/hooks/use-orders";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar, Phone, MapPin, Package, User, Building, CreditCard, MessageSquare } from "lucide-react";
interface OrderDetailDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'processing':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">처리중</Badge>;
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800">완료</Badge>;
    case 'canceled':
      return <Badge variant="destructive">취소됨</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};
const getPaymentStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800">결제완료</Badge>;
    case 'pending':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">결제대기</Badge>;
    case 'failed':
      return <Badge variant="destructive">결제실패</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};
const formatDateTime = (date: string, time: string) => {
  if (!date) return '-';
  try {
    const dateObj = new Date(date);
    const formattedDate = format(dateObj, 'yyyy년 MM월 dd일 (EEE)', { locale: ko });
    return time ? `${formattedDate} ${time}` : formattedDate;
  } catch {
    return date + (time ? ` ${time}` : '');
  }
};
const formatOrderDate = (date: any) => {
  if (!date) return '-';
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '-';
    }
    return format(dateObj, 'yyyy-MM-dd HH:mm', { locale: ko });
  } catch {
    return '-';
  }
};
export function OrderDetailDialog({ order, open, onOpenChange }: OrderDetailDialogProps) {
  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            주문 상세 정보
            <Badge variant="outline" className="ml-2">
              {order.id.slice(0, 8)}...
            </Badge>
          </DialogTitle>
          <DialogDescription>
            주문의 상세 정보를 확인합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* 주문 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                주문 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">주문일시</p>
                <p className="font-medium">
                  {order.orderDate ? formatOrderDate(order.orderDate) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">주문 상태</p>
                <div>{getStatusBadge(order.status)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">수령 방법</p>
                <p className="font-medium">
                  {order.receiptType === 'store_pickup' ? '매장픽업 (즉시)' :
                    order.receiptType === 'pickup_reservation' ? '픽업예약' :
                      order.receiptType === 'delivery_reservation' ? '배송예약' :
                        order.receiptType || '기타'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">지점</p>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {order.transferInfo?.isTransferred && order.transferInfo?.processBranchName
                        ? order.transferInfo.processBranchName
                        : order.branchName || '-'}
                    </p>
                    {order.transferInfo?.isTransferred && (
                      <Badge variant="outline" className="text-xs">
                        이관됨
                      </Badge>
                    )}
                  </div>
                  {order.transferInfo?.isTransferred && (
                    <p className="text-xs text-gray-500">
                      발주지점: {order.branchName}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          {/* 주문자 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4" />
                주문자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">이름</p>
                <p className="font-medium">{order.orderer?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">연락처</p>
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  <p className="font-medium">{order.orderer?.contact || '-'}</p>
                </div>
              </div>
              {order.orderer?.company && (
                <div>
                  <p className="text-sm text-muted-foreground">회사명</p>
                  <div className="flex items-center gap-1">
                    <Building className="w-3 h-3" />
                    <p className="font-medium">{order.orderer.company}</p>
                  </div>
                </div>
              )}
              {order.orderer?.email && (
                <div>
                  <p className="text-sm text-muted-foreground">이메일</p>
                  <p className="font-medium">{order.orderer.email}</p>
                </div>
              )}
            </CardContent>
          </Card>
          {/* 픽업/배송 정보 */}
          {(order.receiptType === 'store_pickup' || order.receiptType === 'pickup_reservation') && order.pickupInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  픽업 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">픽업 예정일시</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <p className="font-medium">
                      {formatDateTime(order.pickupInfo?.date || '', order.pickupInfo?.time || '')}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">픽업자</p>
                  <p className="font-medium">{order.pickupInfo?.pickerName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">픽업자 연락처</p>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <p className="font-medium">{order.pickupInfo?.pickerContact || '-'}</p>
                  </div>
                </div>
                {order.pickupInfo?.completedAt && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      픽업 완료 일시
                    </p>
                    <p className="font-medium text-green-600">
                      {format(order.pickupInfo.completedAt instanceof Date ? order.pickupInfo.completedAt : (order.pickupInfo.completedAt as any).toDate(), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {order.receiptType === 'delivery_reservation' && order.deliveryInfo && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  배송 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">배송 예정일시</p>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <p className="font-medium">
                      {formatDateTime(order.deliveryInfo?.date || '', order.deliveryInfo?.time || '')}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">수령자</p>
                  <p className="font-medium">{order.deliveryInfo?.recipientName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">수령자 연락처</p>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <p className="font-medium">{order.deliveryInfo?.recipientContact || '-'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">배송지</p>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <p className="font-medium">{order.deliveryInfo?.address || '-'}</p>
                  </div>
                </div>
                {order.deliveryInfo?.district && (
                  <div>
                    <p className="text-sm text-muted-foreground">배송 지역</p>
                    <p className="font-medium">{order.deliveryInfo.district}</p>
                  </div>
                )}
                {order.deliveryInfo?.completedAt && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      배송 완료 일시
                    </p>
                    <p className="font-medium text-green-600">
                      {format(order.deliveryInfo.completedAt instanceof Date ? order.deliveryInfo.completedAt : (order.deliveryInfo.completedAt as any).toDate(), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {/* 주문 상품 */}
          <Card>
            <CardHeader>
              <CardTitle>주문 상품</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상품명</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right">단가</TableHead>
                    <TableHead className="text-right">합계</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items || []).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.name || '-'}</TableCell>
                      <TableCell className="text-right">{item.quantity || 0}</TableCell>
                      <TableCell className="text-right">₩{(item.price || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">₩{((item.quantity || 0) * (item.price || 0)).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>상품 합계:</span>
                  <span>₩{(order.summary?.subtotal || 0).toLocaleString()}</span>
                </div>
                {(order.summary?.deliveryFee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span>배송비:</span>
                    <span>₩{(order.summary?.deliveryFee || 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg">
                  <span>총 합계:</span>
                  <span>₩{(order.summary?.total || 0).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* 결제 정보 */}
          {order.payment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  결제 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">결제 방법</p>
                  <p className="font-medium">{order.payment.method || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">결제 상태</p>
                  <div>{getPaymentStatusBadge(order.payment.status || 'pending')}</div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* 이관 정보 */}
          {order.transferInfo?.isTransferred && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  이관 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">발주지점</p>
                  <p className="font-medium">{order.branchName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">처리지점</p>
                  <p className="font-medium">{order.transferInfo.processBranchName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">이관일시</p>
                  <p className="font-medium">
                    {order.transferInfo.transferDate ? formatOrderDate(order.transferInfo.transferDate) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">이관 상태</p>
                  <div>
                    {order.transferInfo.status === 'accepted' && (
                      <Badge variant="default" className="bg-green-100 text-green-800">수락됨</Badge>
                    )}
                    {order.transferInfo.status === 'pending' && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">대기중</Badge>
                    )}
                    {order.transferInfo.status === 'rejected' && (
                      <Badge variant="destructive">거절됨</Badge>
                    )}
                    {order.transferInfo.status === 'completed' && (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">완료됨</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* 메시지 및 요청사항 */}
          {((order.message && order.message.content) || order.request) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  메시지 및 요청사항
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.message && order.message.content && (
                  <div>
                    <p className="text-sm text-muted-foreground">메시지 ({order.message.type || 'card'})</p>
                    <p className="font-medium bg-gray-50 p-3 rounded">{order.message.content}</p>
                  </div>
                )}
                {order.request && (
                  <div>
                    <p className="text-sm text-muted-foreground">특별 요청사항</p>
                    <p className="font-medium bg-gray-50 p-3 rounded">{order.request}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
