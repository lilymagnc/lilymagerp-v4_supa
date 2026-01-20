"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/use-orders";
import { Recipient } from "@/hooks/use-recipients";
import { MapPin, Phone, Calendar, Package, User, Mail, Building } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface RecipientDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: Recipient | null;
}

export function RecipientDetailDialog({ isOpen, onOpenChange, recipient }: RecipientDetailDialogProps) {
  const { orders } = useOrders();
  const [relatedOrders, setRelatedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (recipient && isOpen) {
      setLoading(true);
      // 해당 수령자와 관련된 주문들 필터링
      const filtered = orders.filter(order => 
        order.deliveryInfo?.recipientContact === recipient.contact &&
        order.branchName === recipient.branchName
      );
      setRelatedOrders(filtered);
      setLoading(false);
    }
  }, [recipient, orders, isOpen]);

  if (!recipient) return null;

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

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return <Badge className="bg-blue-500 text-white">완결</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-500 text-white">미결</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReceiptTypeBadge = (receiptType: string) => {
    switch (receiptType) {
      case 'delivery_reservation':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">배송</Badge>;
      case 'pickup_reservation':
        return <Badge variant="outline" className="bg-green-50 text-green-700">픽업</Badge>;
      case 'store_pickup':
        return <Badge variant="outline" className="bg-purple-50 text-purple-700">매장픽업</Badge>;
      default:
        return <Badge variant="outline">{receiptType}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            수령자 상세 정보
          </DialogTitle>
          <DialogDescription>
            {recipient.name}님의 상세 정보와 주문 내역을 확인합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 수령자 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">기본 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">수령자명:</span>
                    <span>{recipient.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">연락처:</span>
                    <span>{recipient.contact}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">이메일:</span>
                    <span>{recipient.email || '-'}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">주소:</span>
                    <span className="text-sm">{recipient.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">지점:</span>
                    <span>{recipient.branchName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">수령 횟수:</span>
                    <Badge variant={recipient.orderCount >= 3 ? "default" : "secondary"}>
                      {recipient.orderCount}회
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 통계 정보 */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">총 주문 금액</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₩{relatedOrders.reduce((sum, order) => sum + (order.summary?.total || 0), 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">평균 주문 금액</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₩{relatedOrders.length > 0 
                    ? Math.round(relatedOrders.reduce((sum, order) => sum + (order.summary?.total || 0), 0) / relatedOrders.length).toLocaleString()
                    : '0'
                  }
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">최근 주문일</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recipient.lastOrderDate 
                    ? format(recipient.lastOrderDate.toDate(), "MM/dd", { locale: ko })
                    : '-'
                  }
                </div>
              </CardContent>
            </Card>
          </div>

                     {/* 수령 내역 */}
           <Card>
             <CardHeader>
               <CardTitle className="text-lg">수령 내역 ({relatedOrders.length}건)</CardTitle>
             </CardHeader>
             <CardContent>
               {loading ? (
                 <div className="space-y-3">
                   {[1, 2, 3].map((i) => (
                     <div key={i} className="flex items-center space-x-4">
                       <Skeleton className="h-4 w-20" />
                       <Skeleton className="h-4 w-32" />
                       <Skeleton className="h-4 w-24" />
                       <Skeleton className="h-4 w-16" />
                     </div>
                   ))}
                 </div>
               ) : relatedOrders.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   관련된 수령 내역이 없습니다.
                 </div>
               ) : (
                 <div className="space-y-4">
                   {relatedOrders.map((order) => (
                     <div key={order.id} className="border rounded-lg p-4 space-y-3">
                       {/* 주문 기본 정보 */}
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <span className="font-medium text-sm">주문 ID:</span>
                           <span className="text-sm text-muted-foreground">{order.id.slice(0, 8)}...</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <span className="text-sm text-muted-foreground">
                             {order.orderDate && format(order.orderDate.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko })}
                           </span>
                           {getStatusBadge(order.status)}
                           {getPaymentStatusBadge(order.payment?.status)}
                         </div>
                       </div>

                       {/* 주문자 정보 */}
                       <div className="bg-muted/50 rounded p-3">
                         <div className="text-sm font-medium mb-2">주문자 정보</div>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                           <div>
                             <span className="text-muted-foreground">주문자:</span>
                             <span className="ml-2">{order.orderer?.name || '-'}</span>
                           </div>
                           <div>
                             <span className="text-muted-foreground">연락처:</span>
                             <span className="ml-2">{order.orderer?.contact || '-'}</span>
                           </div>
                           <div>
                             <span className="text-muted-foreground">회사:</span>
                             <span className="ml-2">{order.orderer?.company || '-'}</span>
                           </div>
                           <div>
                             <span className="text-muted-foreground">이메일:</span>
                             <span className="ml-2">{order.orderer?.email || '-'}</span>
                           </div>
                         </div>
                       </div>

                       {/* 상품 정보 */}
                       <div className="bg-muted/50 rounded p-3">
                         <div className="text-sm font-medium mb-2">상품 정보</div>
                         <div className="space-y-2">
                           {order.items?.map((item: any, index: number) => (
                             <div key={index} className="flex justify-between items-center text-sm">
                               <div className="flex items-center gap-2">
                                 <span className="font-medium">{item.name}</span>
                                 <span className="text-muted-foreground">x{item.quantity}</span>
                               </div>
                               <span className="font-medium">₩{(item.price * item.quantity).toLocaleString()}</span>
                             </div>
                           ))}
                         </div>
                       </div>

                       {/* 배송/픽업 정보 */}
                       {order.deliveryInfo && (
                         <div className="bg-blue-50 rounded p-3">
                           <div className="text-sm font-medium mb-2 text-blue-700">배송 정보</div>
                           <div className="grid grid-cols-2 gap-2 text-sm">
                             <div>
                               <span className="text-muted-foreground">배송일:</span>
                               <span className="ml-2">{order.deliveryInfo.date}</span>
                             </div>
                             <div>
                               <span className="text-muted-foreground">배송시간:</span>
                               <span className="ml-2">{order.deliveryInfo.time}</span>
                             </div>
                             <div>
                               <span className="text-muted-foreground">배송주소:</span>
                               <span className="ml-2">{order.deliveryInfo.address}</span>
                             </div>
                             <div>
                               <span className="text-muted-foreground">지역:</span>
                               <span className="ml-2">{order.deliveryInfo.district}</span>
                             </div>
                           </div>
                         </div>
                       )}

                       {order.pickupInfo && (
                         <div className="bg-green-50 rounded p-3">
                           <div className="text-sm font-medium mb-2 text-green-700">픽업 정보</div>
                           <div className="grid grid-cols-2 gap-2 text-sm">
                             <div>
                               <span className="text-muted-foreground">픽업일:</span>
                               <span className="ml-2">{order.pickupInfo.date}</span>
                             </div>
                             <div>
                               <span className="text-muted-foreground">픽업시간:</span>
                               <span className="ml-2">{order.pickupInfo.time}</span>
                             </div>
                             <div>
                               <span className="text-muted-foreground">픽업자:</span>
                               <span className="ml-2">{order.pickupInfo.pickerName}</span>
                             </div>
                             <div>
                               <span className="text-muted-foreground">연락처:</span>
                               <span className="ml-2">{order.pickupInfo.pickerContact}</span>
                             </div>
                           </div>
                         </div>
                       )}

                       {/* 메시지 정보 */}
                       {order.message && order.message.content && (
                         <div className="bg-purple-50 rounded p-3">
                           <div className="text-sm font-medium mb-2 text-purple-700">메시지</div>
                           <div className="flex items-center gap-2 mb-2">
                             <Badge variant="outline" className="bg-purple-100 text-purple-700">
                               {order.message.type === 'card' ? '카드' : '리본'}
                             </Badge>
                           </div>
                           <div className="text-sm bg-white rounded p-2 border">
                             {order.message.content}
                           </div>
                         </div>
                       )}

                       {/* 특별 요청사항 */}
                       {order.request && (
                         <div className="bg-yellow-50 rounded p-3">
                           <div className="text-sm font-medium mb-2 text-yellow-700">특별 요청사항</div>
                           <div className="text-sm bg-white rounded p-2 border">
                             {order.request}
                           </div>
                         </div>
                       )}

                       {/* 결제 정보 */}
                       <div className="bg-gray-50 rounded p-3">
                         <div className="text-sm font-medium mb-2">결제 정보</div>
                         <div className="grid grid-cols-2 gap-2 text-sm">
                           <div>
                             <span className="text-muted-foreground">결제수단:</span>
                             <span className="ml-2">
                               {order.payment?.method === 'card' ? '카드' :
                                order.payment?.method === 'cash' ? '현금' :
                                order.payment?.method === 'transfer' ? '계좌이체' :
                                order.payment?.method === 'mainpay' ? '메인페이' :
                                order.payment?.method === 'shopping_mall' ? '쇼핑몰' :
                                order.payment?.method === 'epay' ? '이페이' : order.payment?.method}
                             </span>
                           </div>
                           <div>
                             <span className="text-muted-foreground">소계:</span>
                             <span className="ml-2">₩{(order.summary?.subtotal || 0).toLocaleString()}</span>
                           </div>
                           <div>
                             <span className="text-muted-foreground">배송비:</span>
                             <span className="ml-2">₩{(order.summary?.deliveryFee || 0).toLocaleString()}</span>
                           </div>
                           <div>
                             <span className="text-muted-foreground">총 금액:</span>
                             <span className="ml-2 font-bold">₩{(order.summary?.total || 0).toLocaleString()}</span>
                           </div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </CardContent>
           </Card>

          {/* 마케팅 정보 */}
          {recipient.marketingConsent !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">마케팅 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">마케팅 동의:</span>
                    <Badge variant={recipient.marketingConsent ? "default" : "secondary"}>
                      {recipient.marketingConsent ? "동의" : "미동의"}
                    </Badge>
                  </div>
                  {recipient.source && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">데이터 출처:</span>
                      <span>{recipient.source}</span>
                    </div>
                  )}
                  {recipient.createdAt && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">등록일:</span>
                      <span>{format(recipient.createdAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko })}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
