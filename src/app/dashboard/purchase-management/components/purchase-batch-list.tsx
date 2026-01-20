"use client";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Package, 
  ShoppingCart, 
  Truck, 
  CheckCircle, 
  Clock, 
  Users,
  Calculator,
  Eye,
  Edit,
  Trash2,
  Play
} from 'lucide-react';
import { usePurchaseBatches } from '@/hooks/use-purchase-batches';
import { ActualPurchaseForm } from './actual-purchase-form';
import type { PurchaseBatch } from '@/types/material-request';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
interface PurchaseBatchListProps {
  onRefresh?: () => void;
}
export function PurchaseBatchList({ onRefresh }: PurchaseBatchListProps) {
  const [selectedBatch, setSelectedBatch] = useState<PurchaseBatch | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'planning' | 'purchasing' | 'completed'>('planning');
  const { 
    batches, 
    loading, 
    fetchBatches, 
    startDelivery, 
    deleteBatch,
    calculateBatchStats 
  } = usePurchaseBatches();
  useEffect(() => {
    fetchBatches();
  }, []);
  // 상태별 배치 필터링
  const filteredBatches = batches.filter(batch => batch.status === activeTab);
  // 배송 시작 처리
  const handleStartDelivery = async (batchId: string) => {
    const success = await startDelivery(batchId);
    if (success) {
      await fetchBatches(); // 배치 목록 새로고침
      if (onRefresh) {
        onRefresh(); // 상위 컴포넌트 새로고침
      }
    }
  };
  // 배치 삭제 처리
  const handleDeleteBatch = async (batchId: string) => {
    if (confirm('정말로 이 구매 배치를 삭제하시겠습니까?')) {
      const success = await deleteBatch(batchId);
      if (success && onRefresh) {
        onRefresh();
      }
    }
  };
  // 상태별 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'blue';
      case 'purchasing': return 'orange';
      case 'completed': return 'green';
      default: return 'gray';
    }
  };
  // 상태별 라벨 반환
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'planning': return '계획중';
      case 'purchasing': return '구매중';
      case 'completed': return '완료';
      default: return status;
    }
  };
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">구매 배치를 불러오는 중...</div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            구매 배치 관리
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="planning" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                계획중 ({batches.filter(b => b.status === 'planning').length})
              </TabsTrigger>
              <TabsTrigger value="purchasing" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                구매중 ({batches.filter(b => b.status === 'purchasing').length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                완료 ({batches.filter(b => b.status === 'completed').length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              {filteredBatches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {activeTab === 'planning' && '계획중인 구매 배치가 없습니다.'}
                  {activeTab === 'purchasing' && '구매중인 배치가 없습니다.'}
                  {activeTab === 'completed' && '완료된 배치가 없습니다.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBatches.map((batch) => {
                    const stats = calculateBatchStats(batch);
                    return (
                      <Card key={batch.id} className="border-l-4" style={{
                        borderLeftColor: getStatusColor(batch.status) === 'blue' ? '#3b82f6' :
                                        getStatusColor(batch.status) === 'orange' ? '#f97316' :
                                        getStatusColor(batch.status) === 'green' ? '#10b981' : '#6b7280'
                      }}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{batch.batchNumber}</h3>
                                <Badge variant="outline" className={`
                                  ${getStatusColor(batch.status) === 'blue' ? 'border-blue-500 text-blue-700' : ''}
                                  ${getStatusColor(batch.status) === 'orange' ? 'border-orange-500 text-orange-700' : ''}
                                  ${getStatusColor(batch.status) === 'green' ? 'border-green-500 text-green-700' : ''}
                                `}>
                                  {getStatusLabel(batch.status)}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                생성일: {batch.createdAt?.toDate ? format(batch.createdAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <ShoppingCart className="h-4 w-4" />
                                  <span>{stats.requestCount}개 요청</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4" />
                                  <span>{stats.branchCount}개 지점</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Package className="h-4 w-4" />
                                  <span>{stats.totalItems}개 품목</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calculator className="h-4 w-4" />
                                  <span>₩{stats.totalCost.toLocaleString()}</span>
                                </div>
                              </div>
                              {batch.notes && (
                                <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                                  메모: {batch.notes}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedBatch(batch);
                                  setShowDetailsDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {batch.status === 'planning' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedBatch(batch);
                                      setShowPurchaseForm(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteBatch(batch.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {batch.status === 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartDelivery(batch.id)}
                                >
                                  <Truck className="h-4 w-4" />
                                  배송시작
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {/* 배치 상세 정보 다이얼로그 */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>구매 배치 상세 정보</DialogTitle>
            <DialogDescription>
              선택한 구매 배치의 상세 정보를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          {selectedBatch && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">배치 정보</h4>
                  <div className="space-y-1 text-sm">
                    <div>배치 번호: <strong>{selectedBatch.batchNumber}</strong></div>
                    <div>상태: <Badge variant="outline">{getStatusLabel(selectedBatch.status)}</Badge></div>
                    <div>생성일: {selectedBatch.createdAt?.toDate ? format(selectedBatch.createdAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}</div>
                    <div>구매자: {selectedBatch.purchaserName}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">통계</h4>
                  <div className="space-y-1 text-sm">
                    <div>포함 요청: <strong>{selectedBatch.includedRequests.length}건</strong></div>
                    <div>배송 지점: <strong>{selectedBatch.deliveryPlan.length}곳</strong></div>
                    <div>총 비용: <strong>₩{selectedBatch.totalCost.toLocaleString()}</strong></div>
                  </div>
                </div>
              </div>
              {/* 배송 계획 */}
              <div>
                <h4 className="font-medium mb-2">배송 계획</h4>
                <div className="space-y-2">
                  {selectedBatch.deliveryPlan.map((plan, index) => (
                    <Card key={index} className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">{plan.branchName}</div>
                          <div className="text-sm text-muted-foreground">
                            {plan.items.length}개 품목 • ₩{plan.estimatedCost.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
              {/* 구매 품목 (완료된 경우) */}
              {selectedBatch.status === 'completed' && selectedBatch.purchasedItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">구매 품목</h4>
                  <div className="space-y-2">
                    {selectedBatch.purchasedItems.map((item, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{item.actualMaterialName}</div>
                            <div className="text-sm text-muted-foreground">
                              수량: {item.actualQuantity} • 단가: ₩{item.actualPrice.toLocaleString()}
                            </div>
                            {item.memo && (
                              <div className="text-sm text-muted-foreground mt-1">
                                메모: {item.memo}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-medium">₩{item.totalAmount.toLocaleString()}</div>
                            <Badge variant="outline" className={`
                              ${item.status === 'purchased' ? 'border-green-500 text-green-700' : ''}
                              ${item.status === 'substituted' ? 'border-orange-500 text-orange-700' : ''}
                              ${item.status === 'unavailable' ? 'border-red-500 text-red-700' : ''}
                              ${item.status === 'partial' ? 'border-yellow-500 text-yellow-700' : ''}
                            `}>
                              {item.status === 'purchased' && '구매완료'}
                              {item.status === 'substituted' && '대체품'}
                              {item.status === 'unavailable' && '구매불가'}
                              {item.status === 'partial' && '부분구매'}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {selectedBatch.notes && (
                <div>
                  <h4 className="font-medium mb-2">메모</h4>
                  <div className="p-3 bg-muted/50 rounded text-sm">
                    {selectedBatch.notes}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* 실제 구매 입력 폼 */}
      {selectedBatch && (
        <Dialog open={showPurchaseForm} onOpenChange={setShowPurchaseForm}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>실제 구매 내역 입력</DialogTitle>
              <DialogDescription>
                선택한 구매 배치의 실제 구매 내역을 입력합니다.
              </DialogDescription>
            </DialogHeader>
            <ActualPurchaseForm
              batch={selectedBatch}
              onComplete={() => {
                setShowPurchaseForm(false);
                fetchBatches();
                if (onRefresh) onRefresh();
              }}
              onCancel={() => setShowPurchaseForm(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
