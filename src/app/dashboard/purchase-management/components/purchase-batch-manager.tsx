"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertTriangle, Package, ShoppingCart, Users, Calculator, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { usePurchaseBatches } from '@/hooks/use-purchase-batches';
import type { MaterialRequest, ConsolidatedItem } from '@/types/material-request';

interface PurchaseBatchManagerProps {
  selectedRequestIds: string[];
  requests: MaterialRequest[];
  onBatchCreated: () => void;
}

export function PurchaseBatchManager({ 
  selectedRequestIds, 
  requests, 
  onBatchCreated 
}: PurchaseBatchManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const { toast } = useToast();
  const { user } = useAuth();
  const { createPurchaseBatch } = usePurchaseBatches();

  // 선택된 요청들의 통계 계산
  const selectedRequests = requests.filter(req => selectedRequestIds.includes(req.id));

  const batchStats = {
    requestCount: selectedRequests.length,
    branchCount: new Set(selectedRequests.map(req => req.branchId)).size,
    totalItems: selectedRequests.reduce((sum, req) => sum + req.requestedItems.length, 0),
    totalCost: selectedRequests.reduce((sum, req) => 
      sum + req.requestedItems.reduce((itemSum, item) => 
        itemSum + (item.requestedQuantity * item.estimatedPrice), 0
      ), 0
    ),
    urgentCount: selectedRequests.filter(req => 
      req.requestedItems.some(item => item.urgency === 'urgent')
    ).length
  };

  // 자재별 취합 정보
  const consolidatedMaterials = selectedRequests.reduce((acc, request) => {
    request.requestedItems.forEach(item => {
      const key = item.materialId;
      if (acc[key]) {
        acc[key].totalQuantity += item.requestedQuantity;
        acc[key].totalCost += item.requestedQuantity * item.estimatedPrice;
        acc[key].requestCount += 1;
        if (item.urgency === 'urgent') {
          acc[key].urgentCount += 1;
        }
      } else {
        acc[key] = {
          materialId: item.materialId,
          materialName: item.materialName,
          totalQuantity: item.requestedQuantity,
          totalCost: item.requestedQuantity * item.estimatedPrice,
          requestCount: 1,
          urgentCount: item.urgency === 'urgent' ? 1 : 0
        };
      }
    });
    return acc;
  }, {} as Record<string, any>);

  const materialsList = Object.values(consolidatedMaterials);

  // 구매 배치 생성
  const handleCreateBatch = async () => {
    if (selectedRequestIds.length === 0) {
      toast({
        title: "오류",
        description: "선택된 요청이 없습니다.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      const selectedRequests = requests.filter(req => selectedRequestIds.includes(req.id));

      const batchId = await createPurchaseBatch(
        {
          purchaserId: user.uid,
          purchaserName: user.displayName || user.email || '',
          includedRequests: selectedRequestIds,
          notes: batchNotes
        },
        selectedRequests
      );

      if (batchId) {
        setShowConfirmDialog(false);
        setBatchNotes('');
        onBatchCreated();
      }

    } catch (error) {
      console.error('구매 배치 생성 오류:', error);
      toast({
        title: "오류",
        description: "구매 배치 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (selectedRequestIds.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          구매 배치 생성
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 배치 요약 정보 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{batchStats.requestCount}</div>
            <div className="text-sm text-muted-foreground">요청 건수</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{batchStats.branchCount}</div>
            <div className="text-sm text-muted-foreground">지점 수</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{batchStats.totalItems}</div>
            <div className="text-sm text-muted-foreground">총 품목</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              ₩{batchStats.totalCost.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">예상 비용</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{batchStats.urgentCount}</div>
            <div className="text-sm text-muted-foreground">긴급 요청</div>
          </div>
        </div>

        {/* 구매할 자재 목록 미리보기 */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            구매 예정 자재 ({materialsList.length}종류)
          </h4>

          <div className="max-h-40 overflow-y-auto space-y-1">
            {materialsList
              .sort((a, b) => b.urgentCount - a.urgentCount || b.totalQuantity - a.totalQuantity)
              .map((material) => (
                <div 
                  key={material.materialId}
                  className="flex items-center justify-between p-2 bg-white rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span>{material.materialName}</span>
                    {material.urgentCount > 0 && (
                      <Badge variant="destructive">
                        긴급 {material.urgentCount}건
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{material.totalQuantity.toLocaleString()}개</div>
                    <div className="text-xs text-muted-foreground">
                      ₩{material.totalCost.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* 요청 지점 목록 */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            요청 지점 ({batchStats.branchCount}곳)
          </h4>

          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(selectedRequests.map(req => req.branchName))).map(branchName => (
              <Badge key={branchName} variant="outline">
                {branchName}
              </Badge>
            ))}
          </div>
        </div>

        {/* 구매 배치 생성 버튼 */}
        <div className="flex gap-2 pt-4 border-t">
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogTrigger asChild>
              <Button className="flex-1" disabled={isCreating}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                구매 배치 생성
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>구매 배치 생성 확인</DialogTitle>
                <DialogDescription>
                  선택한 자재 요청들을 하나의 구매 배치로 생성합니다.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">배치 요약</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>요청 건수: <strong>{batchStats.requestCount}건</strong></div>
                    <div>지점 수: <strong>{batchStats.branchCount}곳</strong></div>
                    <div>총 품목: <strong>{batchStats.totalItems}개</strong></div>
                    <div>예상 비용: <strong>₩{batchStats.totalCost.toLocaleString()}</strong></div>
                  </div>

                  {batchStats.urgentCount > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700">
                        긴급 요청 {batchStats.urgentCount}건이 포함되어 있습니다.
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">구매 메모 (선택사항)</label>
                  <Textarea
                    placeholder="구매 시 참고할 메모를 입력하세요..."
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowConfirmDialog(false)}
                    disabled={isCreating}
                  >
                    취소
                  </Button>
                  <Button 
                    onClick={handleCreateBatch}
                    disabled={isCreating}
                  >
                    {isCreating ? '생성 중...' : '구매 배치 생성'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
