"use client";
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, ShoppingCart, Package } from 'lucide-react';
import { ConsolidatedItemsView } from './consolidated-items-view';
import { BranchRequestsView } from './branch-requests-view';
import { PurchaseBatchManager } from './purchase-batch-manager';
import { ActualPurchaseForm } from './actual-purchase-form';
import { useToast } from '@/hooks/use-toast';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { usePurchaseBatches } from '@/hooks/use-purchase-batches';
import { useAuth } from '@/hooks/use-auth';
import type { MaterialRequest, ConsolidatedItem, PurchaseBatch, ActualPurchaseInputData } from '@/types/material-request';
import { Timestamp } from 'firebase/firestore';
interface PurchaseRequestDashboardProps {
  requests: MaterialRequest[];
  onRefresh: () => void;
}
export function PurchaseRequestDashboard({ requests, onRefresh }: PurchaseRequestDashboardProps) {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'quantity' | 'urgency' | 'cost'>('quantity');
  const [groupBy, setGroupBy] = useState<'material' | 'branch'>('material');
  const [showActualPurchaseForm, setShowActualPurchaseForm] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<PurchaseBatch | null>(null);
  const { toast } = useToast();
  const { updateRequestStatus } = useMaterialRequests();
  const { createPurchaseBatch, loading: batchLoading } = usePurchaseBatches();
  const { user } = useAuth(); // useAuth 훅을 사용하여 user 객체 가져오기 // usePurchaseBatches 훅에서 createPurchaseBatch 가져오기
  // 처리 가능한 요청들 (제출됨, 검토중 상태)
  const processableRequests = useMemo(() => {
    return requests.filter(request => 
      ['submitted', 'reviewing'].includes(request.status)
    );
  }, [requests]);
  // 구매 중인 요청들 (실제 구매 내역 입력 가능)
  const purchasingRequests = useMemo(() => {
    return requests.filter(request => request.status === 'purchasing');
  }, [requests]);
  // 자재별 취합 데이터 생성
  const consolidatedItems = useMemo(() => {
    const itemsMap = new Map<string, ConsolidatedItem>();
    processableRequests.forEach(request => {
      request.requestedItems.forEach(item => {
        const key = item.materialId;
        if (itemsMap.has(key)) {
          const existing = itemsMap.get(key)!;
          existing.totalQuantity += item.requestedQuantity;
          existing.estimatedTotalCost += item.requestedQuantity * item.estimatedPrice;
          existing.requestingBranches.push({
            branchName: request.branchName,
            quantity: item.requestedQuantity,
            urgency: item.urgency,
            requestId: request.id
          });
        } else {
          itemsMap.set(key, {
            materialId: item.materialId,
            materialName: item.materialName,
            totalQuantity: item.requestedQuantity,
            requestingBranches: [{
              branchName: request.branchName,
              quantity: item.requestedQuantity,
              urgency: item.urgency,
              requestId: request.id
            }],
            estimatedTotalCost: item.requestedQuantity * item.estimatedPrice
          });
        }
      });
    });
    return Array.from(itemsMap.values());
  }, [processableRequests]);
  // 정렬된 취합 데이터
  const sortedConsolidatedItems = useMemo(() => {
    const items = [...consolidatedItems];
    switch (sortBy) {
      case 'quantity':
        return items.sort((a, b) => b.totalQuantity - a.totalQuantity);
      case 'urgency':
        return items.sort((a, b) => {
          const aUrgent = a.requestingBranches.some(branch => branch.urgency === 'urgent');
          const bUrgent = b.requestingBranches.some(branch => branch.urgency === 'urgent');
          if (aUrgent && !bUrgent) return -1;
          if (!aUrgent && bUrgent) return 1;
          return b.totalQuantity - a.totalQuantity;
        });
      case 'cost':
        return items.sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost);
      default:
        return items;
    }
  }, [consolidatedItems, sortBy]);
  // 지점별 요청 통계
  const branchStats = useMemo(() => {
    const statsMap = new Map();
    processableRequests.forEach(request => {
      const key = request.branchId;
      const totalCost = request.requestedItems.reduce((sum, item) => 
        sum + (item.requestedQuantity * item.estimatedPrice), 0
      );
      const hasUrgent = request.requestedItems.some(item => item.urgency === 'urgent');
      if (statsMap.has(key)) {
        const existing = statsMap.get(key);
        existing.requestCount += 1;
        existing.totalCost += totalCost;
        existing.itemCount += request.requestedItems.length;
        if (hasUrgent) existing.urgentCount += 1;
      } else {
        statsMap.set(key, {
          branchId: request.branchId,
          branchName: request.branchName,
          requestCount: 1,
          totalCost,
          itemCount: request.requestedItems.length,
          urgentCount: hasUrgent ? 1 : 0
        });
      }
    });
    return Array.from(statsMap.values());
  }, [processableRequests]);
  // 요청 선택 토글
  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequests(prev => 
      prev.includes(requestId)
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };
  // 전체 선택/해제
  const toggleAllRequests = () => {
    if (selectedRequests.length === processableRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(processableRequests.map(r => r.id));
    }
  };
  // 긴급 요청만 선택
  const selectUrgentRequests = () => {
    const urgentRequestIds = processableRequests
      .filter(request => request.requestedItems.some(item => item.urgency === 'urgent'))
      .map(request => request.id);
    setSelectedRequests(urgentRequestIds);
  };
  // 실제 구매 내역 입력 시작
  const startActualPurchase = async (purchasingRequestIds: string[]) => {
    const batchRequests = requests.filter(r => purchasingRequestIds.includes(r.id));
    // 실제 구매 배치 생성
    try {
      const newBatch = await createPurchaseBatch(
        { 
          purchaserId: user?.uid || '',
          purchaserName: user?.displayName || user?.email || '',
          includedRequests: purchasingRequestIds,
        },
        batchRequests
      );
      if (newBatch) {
        setCurrentBatch(newBatch);
        setShowActualPurchaseForm(true);
      } else {
        toast({
          title: "오류",
          description: "구매 배치 생성에 실패했습니다.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("구매 배치 생성 오류:", error);
      toast({
        title: "오류",
        description: "구매 배치 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };
  // 실제 구매 내역 저장 (이 함수는 실제로는 사용되지 않음 - ActualPurchaseForm에서 직접 처리)
  const handleActualPurchaseSubmit = async (purchaseData: ActualPurchaseInputData) => {
    // 이 함수는 실제로는 호출되지 않습니다.
    // ActualPurchaseForm에서 직접 updateActualPurchase를 호출하고 onComplete를 실행합니다.

  };
  // 실제 구매 폼 취소
  const handleActualPurchaseCancel = () => {
    setShowActualPurchaseForm(false);
    setCurrentBatch(null);
  };
  // 실제 구매 폼이 열려있으면 폼만 표시
  if (showActualPurchaseForm && currentBatch) {
    return (
      <ActualPurchaseForm
        batch={currentBatch}
        loading={batchLoading}
        onComplete={() => {
          setShowActualPurchaseForm(false);
          setCurrentBatch(null);
          onRefresh();
        }}
        onCancel={handleActualPurchaseCancel}
      />
    );
  }
  return (
    <div className="space-y-6">
      {/* 구매 중인 요청들 */}
      {purchasingRequests.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              구매 진행 중인 요청 ({purchasingRequests.length}건)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {purchasingRequests.map(request => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                  <div>
                    <div className="font-medium">{request.requestNumber}</div>
                    <div className="text-sm text-gray-600">
                      {request.branchName} • {request.requestedItems.length}개 품목 • 
                      ₩{request.requestedItems.reduce((sum, item) => 
                        sum + (item.requestedQuantity * item.estimatedPrice), 0
                      ).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => startActualPurchase([request.id])}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    실제 구매 입력
                  </Button>
                </div>
              ))}
              {purchasingRequests.length > 1 && (
                <div className="pt-2 border-t">
                  <Button
                    onClick={() => startActualPurchase(purchasingRequests.map(r => r.id))}
                    className="w-full"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    모든 구매 중인 요청 일괄 처리
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* 컨트롤 패널 */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>구매 요청 취합 대시보드</CardTitle>
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quantity">수량순</SelectItem>
                  <SelectItem value="urgency">긴급도순</SelectItem>
                  <SelectItem value="cost">비용순</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="material">자재별</SelectItem>
                  <SelectItem value="branch">지점별</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={toggleAllRequests}
            >
              {selectedRequests.length === processableRequests.length ? '전체 해제' : '전체 선택'}
              ({selectedRequests.length}/{processableRequests.length})
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={selectUrgentRequests}
            >
              긴급 요청만 선택
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedRequests([])}
            >
              선택 초기화
            </Button>
            {selectedRequests.length > 0 && (
              <Badge variant="secondary">
                {selectedRequests.length}개 요청 선택됨
              </Badge>
            )}
          </div>
          {/* 요약 통계 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">처리 대기 요청</div>
              <div className="text-2xl font-bold text-blue-700">{processableRequests.length}건</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">총 자재 종류</div>
              <div className="text-2xl font-bold text-green-700">{consolidatedItems.length}개</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-sm text-yellow-600 font-medium">예상 총 비용</div>
              <div className="text-2xl font-bold text-yellow-700">
                ₩{consolidatedItems.reduce((sum, item) => sum + item.estimatedTotalCost, 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-red-600 font-medium">긴급 요청</div>
              <div className="text-2xl font-bold text-red-700">
                {processableRequests.filter(r => 
                  r.requestedItems.some(item => item.urgency === 'urgent')
                ).length}건
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* 메인 뷰 */}
      <Tabs value={groupBy} onValueChange={(value) => setGroupBy(value as any)}>
        <TabsList>
          <TabsTrigger value="material">자재별 취합 뷰</TabsTrigger>
          <TabsTrigger value="branch">지점별 요청 뷰</TabsTrigger>
        </TabsList>
        <TabsContent value="material">
          <ConsolidatedItemsView 
            items={sortedConsolidatedItems}
            selectedRequests={selectedRequests}
            onToggleRequest={toggleRequestSelection}
          />
        </TabsContent>
        <TabsContent value="branch">
          <BranchRequestsView 
            requests={processableRequests}
            branchStats={branchStats}
            selectedRequests={selectedRequests}
            onToggleRequest={toggleRequestSelection}
          />
        </TabsContent>
      </Tabs>
      {/* 구매 배치 관리 */}
      {selectedRequests.length > 0 && (
        <PurchaseBatchManager 
          selectedRequestIds={selectedRequests}
          requests={processableRequests.filter(r => selectedRequests.includes(r.id))}
          onBatchCreated={() => {
            setSelectedRequests([]);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
