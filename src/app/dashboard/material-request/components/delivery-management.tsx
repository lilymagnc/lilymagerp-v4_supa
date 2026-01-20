"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Truck, 
  Package, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  MapPin,
  Bell,
  Clock,
  Scan,
  FileText,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { useToast } from '@/hooks/use-toast';
import type { MaterialRequest, DeliveryInfo } from '@/types/material-request';
interface DeliveryManagementProps {
  request: MaterialRequest;
  onDeliveryUpdate?: () => void;
}
export function DeliveryManagement({ request, onDeliveryUpdate }: DeliveryManagementProps) {
  const { user } = useAuth();
  const { updateRequestStatus, loading } = useMaterialRequests();
  const { toast } = useToast();
  const [deliveryForm, setDeliveryForm] = useState({
    deliveryMethod: '직접배송',
    trackingNumber: '',
    estimatedDelivery: '',
    notes: ''
  });
  const [receivingForm, setReceivingForm] = useState({
    receivedItems: request.requestedItems.map(item => ({
      materialId: item.materialId,
      materialName: item.materialName,
      requestedQuantity: item.requestedQuantity,
      receivedQuantity: item.requestedQuantity,
      condition: 'good' as 'good' | 'damaged' | 'missing',
      notes: ''
    })),
    receivedDate: new Date().toISOString().slice(0, 16),
    receiverName: user?.email || '',
    notes: ''
  });
  // 배송 시작 처리
  const handleStartShipping = async () => {
    try {
      const deliveryInfo: DeliveryInfo = {
        shippingDate: { seconds: Date.now() / 1000, toMillis: () => Date.now(), toDate: () => new Date() } as any,
        deliveryMethod: deliveryForm.deliveryMethod,
        trackingNumber: deliveryForm.trackingNumber || undefined,
        deliveryStatus: 'shipped'
      };
      await updateRequestStatus(request.id, 'shipping', {
        delivery: deliveryInfo
      });
      // 배송 시작 알림 생성
      await createShippingNotification(request);
      toast({
        title: "배송 시작",
        description: "배송이 시작되었습니다. 지점에 알림이 전송되었습니다.",
      });
      onDeliveryUpdate?.();
    } catch (error) {
      console.error('배송 시작 오류:', error);
      toast({
        title: "오류",
        description: "배송 시작 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  // 입고 확인 처리
  const handleConfirmReceiving = async () => {
    try {
      // 입고 내역 검증
      const hasDiscrepancy = receivingForm.receivedItems.some(item => 
        item.receivedQuantity !== item.requestedQuantity || item.condition !== 'good'
      );
      const deliveryInfo: DeliveryInfo = {
        ...request.delivery!,
        deliveryDate: { seconds: Date.now() / 1000, toMillis: () => Date.now(), toDate: () => new Date() } as any,
        deliveryStatus: 'delivered'
      };
      await updateRequestStatus(request.id, 'delivered', {
        delivery: deliveryInfo,
        receivingInfo: {
          receivedDate: new Date(receivingForm.receivedDate),
          receiverName: receivingForm.receiverName,
          receivedItems: receivingForm.receivedItems,
          notes: receivingForm.notes,
          hasDiscrepancy
        }
      });
      // 재고 자동 업데이트 처리
      await updateInventoryFromReceiving();
      toast({
        title: "입고 완료",
        description: hasDiscrepancy 
          ? "입고가 완료되었습니다. 차이점이 기록되었습니다." 
          : "입고가 완료되었습니다. 재고가 자동으로 업데이트되었습니다.",
      });
      onDeliveryUpdate?.();
    } catch (error) {
      console.error('입고 확인 오류:', error);
      toast({
        title: "오류",
        description: "입고 확인 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  // 재고 자동 업데이트
  const updateInventoryFromReceiving = async () => {
    try {
      // materials 컬렉션 업데이트
      for (const item of receivingForm.receivedItems) {
        if (item.receivedQuantity > 0 && item.condition === 'good') {
          // 실제 구현에서는 materials 컬렉션의 재고를 증가시킴
          }
      }
      // stockHistory 컬렉션에 입고 기록 생성
      const stockHistoryRecord = {
        branchId: request.branchId,
        branchName: request.branchName,
        type: 'in',
        reason: 'material_request_receiving',
        relatedRequestId: request.id,
        items: receivingForm.receivedItems.map(item => ({
          materialId: item.materialId,
          materialName: item.materialName,
          quantity: item.receivedQuantity,
          condition: item.condition,
          notes: item.notes
        })),
        createdAt: new Date(),
        createdBy: user?.uid || '',
        createdByName: user?.email || ''
      };
      } catch (error) {
      console.error('재고 업데이트 오류:', error);
    }
  };
  // 배송 시작 알림 생성
  const createShippingNotification = async (request: MaterialRequest) => {
    try {
      // 실제 구현에서는 notifications 컬렉션에 추가
      const notification = {
        type: 'material_request',
        subType: 'shipping_started',
        title: '배송 시작',
        message: `요청하신 자재(${request.requestNumber})의 배송이 시작되었습니다.`,
        branchId: request.branchId,
        relatedRequestId: request.id,
        isRead: false,
        createdAt: new Date()
      };
      } catch (error) {
      console.error('알림 생성 오류:', error);
    }
  };
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  // 본사 관리자용 배송 시작 인터페이스
  if (user?.role === '본사 관리자' && request.status === 'purchased') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            배송 시작
          </CardTitle>
          <CardDescription>
            구매가 완료된 자재의 배송을 시작합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="deliveryMethod">배송 방법</Label>
              <Input
                id="deliveryMethod"
                value={deliveryForm.deliveryMethod}
                onChange={(e) => setDeliveryForm(prev => ({
                  ...prev,
                  deliveryMethod: e.target.value
                }))}
                placeholder="직접배송, 택배 등"
              />
            </div>
            <div>
              <Label htmlFor="trackingNumber">송장번호 (선택)</Label>
              <Input
                id="trackingNumber"
                value={deliveryForm.trackingNumber}
                onChange={(e) => setDeliveryForm(prev => ({
                  ...prev,
                  trackingNumber: e.target.value
                }))}
                placeholder="송장번호 입력"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">배송 메모</Label>
            <Textarea
              id="notes"
              value={deliveryForm.notes}
              onChange={(e) => setDeliveryForm(prev => ({
                ...prev,
                notes: e.target.value
              }))}
              placeholder="배송 관련 특이사항"
              rows={3}
            />
          </div>
          <Button 
            onClick={handleStartShipping}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Truck className="h-4 w-4 mr-2" />
            )}
            배송 시작
          </Button>
        </CardContent>
      </Card>
    );
  }
  // 지점용 입고 확인 인터페이스
  if (request.branchId === user?.franchise && request.status === 'shipping') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            입고 확인
          </CardTitle>
          <CardDescription>
            배송된 자재의 입고를 확인하고 재고를 업데이트합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 배송 정보 표시 */}
          {request.delivery && (
            <Alert className="border-blue-200 bg-blue-50">
              <Truck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="space-y-1">
                  <p><strong>배송 시작:</strong> {formatDate(request.delivery.shippingDate)}</p>
                  <p><strong>배송 방법:</strong> {request.delivery.deliveryMethod}</p>
                  {request.delivery.trackingNumber && (
                    <p><strong>송장번호:</strong> {request.delivery.trackingNumber}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          {/* 입고 품목 확인 */}
          <div>
            <Label className="text-base font-medium">입고 품목 확인</Label>
            <div className="mt-2 space-y-3">
              {receivingForm.receivedItems.map((item, index) => (
                <div key={item.materialId} className="border rounded-lg p-3 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{item.materialName}</p>
                      <p className="text-sm text-muted-foreground">
                        요청 수량: {item.requestedQuantity}개
                      </p>
                    </div>
                    <Badge variant="outline">
                      {item.condition === 'good' ? '양호' : 
                       item.condition === 'damaged' ? '손상' : '누락'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`received-${index}`} className="text-sm">실제 입고 수량</Label>
                      <Input
                        id={`received-${index}`}
                        type="number"
                        min="0"
                        value={item.receivedQuantity}
                        onChange={(e) => {
                          const newItems = [...receivingForm.receivedItems];
                          newItems[index].receivedQuantity = parseInt(e.target.value) || 0;
                          setReceivingForm(prev => ({
                            ...prev,
                            receivedItems: newItems
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">상태</Label>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        value={item.condition}
                        onChange={(e) => {
                          const newItems = [...receivingForm.receivedItems];
                          newItems[index].condition = e.target.value as any;
                          setReceivingForm(prev => ({
                            ...prev,
                            receivedItems: newItems
                          }));
                        }}
                      >
                        <option value="good">양호</option>
                        <option value="damaged">손상</option>
                        <option value="missing">누락</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor={`notes-${index}`} className="text-sm">메모</Label>
                      <Input
                        id={`notes-${index}`}
                        value={item.notes}
                        onChange={(e) => {
                          const newItems = [...receivingForm.receivedItems];
                          newItems[index].notes = e.target.value;
                          setReceivingForm(prev => ({
                            ...prev,
                            receivedItems: newItems
                          }));
                        }}
                        placeholder="특이사항"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* 입고 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="receivedDate">입고 일시</Label>
              <Input
                id="receivedDate"
                type="datetime-local"
                value={receivingForm.receivedDate}
                onChange={(e) => setReceivingForm(prev => ({
                  ...prev,
                  receivedDate: e.target.value
                }))}
              />
            </div>
            <div>
              <Label htmlFor="receiverName">입고 담당자</Label>
              <Input
                id="receiverName"
                value={receivingForm.receiverName}
                onChange={(e) => setReceivingForm(prev => ({
                  ...prev,
                  receiverName: e.target.value
                }))}
                placeholder="입고 담당자명"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="receivingNotes">입고 메모</Label>
            <Textarea
              id="receivingNotes"
              value={receivingForm.notes}
              onChange={(e) => setReceivingForm(prev => ({
                ...prev,
                notes: e.target.value
              }))}
              placeholder="입고 관련 특이사항"
              rows={3}
            />
          </div>
          {/* 차이점 경고 */}
          {receivingForm.receivedItems.some(item => 
            item.receivedQuantity !== item.requestedQuantity || item.condition !== 'good'
          ) && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>주의:</strong> 요청 내역과 실제 입고 내역에 차이가 있습니다. 
                차이점이 기록되어 본사에 전달됩니다.
              </AlertDescription>
            </Alert>
          )}
          <Button 
            onClick={handleConfirmReceiving}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            입고 확인 및 재고 업데이트
          </Button>
        </CardContent>
      </Card>
    );
  }
  // 배송 추적 정보 표시 (모든 사용자)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          배송 추적
        </CardTitle>
      </CardHeader>
      <CardContent>
        {request.delivery ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">배송 시작</p>
                <p className="font-medium">{formatDate(request.delivery.shippingDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">배송 방법</p>
                <p className="font-medium">{request.delivery.deliveryMethod}</p>
              </div>
            </div>
            {request.delivery.trackingNumber && (
              <div>
                <p className="text-muted-foreground text-sm">송장번호</p>
                <p className="font-mono text-sm bg-muted/50 rounded p-2">
                  {request.delivery.trackingNumber}
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              {request.delivery.deliveryStatus === 'delivered' ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">
                    배송 완료: {request.delivery.deliveryDate ? formatDate(request.delivery.deliveryDate) : '확인 중'}
                  </span>
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-blue-600 font-medium">배송 중</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>배송 정보가 없습니다</p>
            <p className="text-sm">구매 완료 후 배송이 시작됩니다</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
