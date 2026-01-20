"use client";
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, MapPin, User, Package, AlertCircle } from 'lucide-react';
import type { MaterialRequest } from '@/types/material-request';
interface RequestDetailDialogProps {
  request: MaterialRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function RequestDetailDialog({ request, open, onOpenChange }: RequestDetailDialogProps) {
  if (!request) return null;
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const getStatusText = (status: string) => {
    switch (status) {
      case 'submitted': return '제출됨';
      case 'reviewing': return '검토중';
      case 'purchasing': return '구매중';
      case 'purchased': return '구매완료';
      case 'shipping': return '배송중';
      case 'delivered': return '배송완료';
      case 'completed': return '완료';
      default: return status;
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'secondary';
      case 'reviewing': return 'default';
      case 'purchasing': return 'default';
      case 'purchased': return 'default';
      case 'shipping': return 'default';
      case 'delivered': return 'outline';
      case 'completed': return 'default';
      default: return 'secondary';
    }
  };
  const totalCost = request.requestedItems.reduce(
    (sum, item) => sum + (item.requestedQuantity * item.estimatedPrice), 0
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            요청 상세 정보
          </DialogTitle>
          <DialogDescription>
            요청번호 {request.requestNumber}의 상세 정보를 확인합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">기본 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">요청번호:</span>
                    <span className="font-mono">{request.requestNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">지점:</span>
                    <span>{request.branchName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">요청자:</span>
                    <span>{request.requesterName}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">요청일:</span>
                    <span>{formatDate(request.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusColor(request.status)}>
                      {getStatusText(request.status)}
                    </Badge>
                    {request.requestedItems.some(item => item.urgency === 'urgent') && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        긴급
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    총 {request.requestedItems.length}개 품목 • 
                    예상 비용: ₩{totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* 요청 품목 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">요청 품목</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>품목명</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead className="text-right">단가</TableHead>
                    <TableHead className="text-right">소계</TableHead>
                    <TableHead>긴급도</TableHead>
                    <TableHead>메모</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.requestedItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.materialName}</TableCell>
                      <TableCell className="text-right">{item.requestedQuantity}</TableCell>
                      <TableCell className="text-right">₩{item.estimatedPrice.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₩{(item.requestedQuantity * item.estimatedPrice).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.urgency === 'urgent' ? 'destructive' : 'secondary'}>
                          {item.urgency === 'urgent' ? '긴급' : '일반'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.memo || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {/* 배송 정보 */}
          {request.delivery && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">배송 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {request.delivery.shippingDate && (
                    <div>
                      <span className="font-medium">배송 시작일:</span>
                      <span className="ml-2">{formatDate(request.delivery.shippingDate)}</span>
                    </div>
                  )}
                  {request.delivery.deliveryDate && (
                    <div>
                      <span className="font-medium">배송 완료일:</span>
                      <span className="ml-2">{formatDate(request.delivery.deliveryDate)}</span>
                    </div>
                  )}
                  {request.delivery.trackingNumber && (
                    <div>
                      <span className="font-medium">송장번호:</span>
                      <span className="ml-2 font-mono">{request.delivery.trackingNumber}</span>
                    </div>
                  )}
                  {request.delivery.deliveryMethod && (
                    <div>
                      <span className="font-medium">배송 방법:</span>
                      <span className="ml-2">{request.delivery.deliveryMethod}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {/* 처리 이력 */}
          {request.statusHistory && request.statusHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">처리 이력</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {request.statusHistory.map((history, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="text-xs">
                        {getStatusText(history.status)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatDate(history.timestamp)}
                      </span>
                      {history.note && (
                        <span className="text-muted-foreground">- {history.note}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 
