"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  FileText,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Database
} from 'lucide-react';
import { useInventorySync } from '@/hooks/use-inventory-sync';
import { useToast } from '@/hooks/use-toast';
import type { MaterialRequest } from '@/types/material-request';
interface ReceivingComparisonProps {
  request: MaterialRequest;
  onInventorySync?: () => void;
}
interface ComparisonItem {
  materialId: string;
  materialName: string;
  requested: {
    quantity: number;
    estimatedPrice: number;
    urgency: string;
  };
  actual?: {
    quantity: number;
    actualPrice: number;
    condition: 'good' | 'damaged' | 'missing';
    status: 'purchased' | 'unavailable' | 'substituted' | 'partial';
  };
  received?: {
    quantity: number;
    condition: 'good' | 'damaged' | 'missing';
    notes?: string;
  };
  discrepancies: {
    quantityDiff: number;
    priceDiff: number;
    conditionIssue: boolean;
    hasSubstitution: boolean;
  };
}
export function ReceivingComparison({ request, onInventorySync }: ReceivingComparisonProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'summary' | 'items' | 'issues'>('summary');
  const [isProcessingSync, setIsProcessingSync] = useState(false);
  const { syncInventoryOnDelivery, loading: syncLoading } = useInventorySync();
  const { toast } = useToast();
  // 요청 vs 실제 vs 입고 비교 데이터 생성
  const generateComparisonData = (): ComparisonItem[] => {
    return request.requestedItems.map(requestedItem => {
      // 실제 구매 정보 찾기
      const actualItem = request.actualPurchase?.items.find(
        item => item.originalMaterialId === requestedItem.materialId
      );
      // 입고 정보 찾기 (receivingInfo가 있다고 가정)
      const receivedItem = (request as any).receivingInfo?.receivedItems?.find(
        (item: any) => item.materialId === requestedItem.materialId
      );
      // 차이점 계산
      const quantityDiff = (receivedItem?.quantity || actualItem?.actualQuantity || 0) - requestedItem.requestedQuantity;
      const priceDiff = (actualItem?.actualPrice || requestedItem.estimatedPrice) - requestedItem.estimatedPrice;
      const conditionIssue = receivedItem?.condition !== 'good';
      const hasSubstitution = actualItem?.actualMaterialId !== actualItem?.originalMaterialId;
      return {
        materialId: requestedItem.materialId,
        materialName: requestedItem.materialName,
        requested: {
          quantity: requestedItem.requestedQuantity,
          estimatedPrice: requestedItem.estimatedPrice,
          urgency: requestedItem.urgency
        },
        actual: actualItem ? {
          quantity: actualItem.actualQuantity,
          actualPrice: actualItem.actualPrice,
          condition: 'good', // 구매 시점에서는 양호로 가정
          status: actualItem.status
        } : undefined,
        received: receivedItem ? {
          quantity: receivedItem.quantity,
          condition: receivedItem.condition,
          notes: receivedItem.notes
        } : undefined,
        discrepancies: {
          quantityDiff,
          priceDiff,
          conditionIssue,
          hasSubstitution
        }
      };
    });
  };
  const comparisonData = generateComparisonData();
  // 전체 통계 계산
  const totalStats = {
    requestedItems: comparisonData.length,
    purchasedItems: comparisonData.filter(item => item.actual).length,
    receivedItems: comparisonData.filter(item => item.received).length,
    issueItems: comparisonData.filter(item => 
      item.discrepancies.quantityDiff !== 0 || 
      item.discrepancies.conditionIssue || 
      item.discrepancies.hasSubstitution
    ).length,
    totalRequestedCost: comparisonData.reduce((sum, item) => 
      sum + (item.requested.quantity * item.requested.estimatedPrice), 0
    ),
    totalActualCost: comparisonData.reduce((sum, item) => 
      sum + (item.actual ? item.actual.quantity * item.actual.actualPrice : 0), 0
    )
  };
  const costDifference = totalStats.totalActualCost - totalStats.totalRequestedCost;
  const costDifferencePercent = totalStats.totalRequestedCost > 0 
    ? (costDifference / totalStats.totalRequestedCost) * 100 
    : 0;
  const getStatusIcon = (item: ComparisonItem) => {
    if (!item.actual) return <XCircle className="h-4 w-4 text-red-500" />;
    if (!item.received) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    if (item.discrepancies.conditionIssue || item.discrepancies.quantityDiff !== 0) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };
  const getStatusText = (item: ComparisonItem) => {
    if (!item.actual) return '구매 안됨';
    if (!item.received) return '입고 대기';
    if (item.discrepancies.conditionIssue) return '상태 이상';
    if (item.discrepancies.quantityDiff > 0) return '초과 입고';
    if (item.discrepancies.quantityDiff < 0) return '부족 입고';
    return '정상 입고';
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  // 자동 재고 연동 처리
  const handleInventorySync = async () => {
    if (!request.actualPurchase?.items || request.actualPurchase.items.length === 0) {
      toast({
        variant: 'destructive',
        title: '재고 연동 불가',
        description: '실제 구매 내역이 없어 재고를 연동할 수 없습니다.'
      });
      return;
    }
    setIsProcessingSync(true);
    try {
      const result = await syncInventoryOnDelivery(
        request.id,
        request.actualPurchase.items,
        request.branchId,
        request.branchName,
        'current-user-id', // 실제로는 현재 사용자 ID를 가져와야 함
        'current-user-name' // 실제로는 현재 사용자 이름을 가져와야 함
      );
      if (result.success) {
        toast({
          title: '재고 연동 완료',
          description: `${result.updatedMaterials}개 자재의 재고가 업데이트되었습니다.`
        });
        // 부모 컴포넌트에 재고 연동 완료 알림
        onInventorySync?.();
      } else {
        toast({
          variant: 'destructive',
          title: '재고 연동 실패',
          description: `${result.errors.length}개 항목에서 오류가 발생했습니다.`
        });
      }
    } catch (error) {
      console.error('Inventory sync error:', error);
      toast({
        variant: 'destructive',
        title: '재고 연동 오류',
        description: '재고 연동 중 예상치 못한 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessingSync(false);
    }
  };
  // 재고 연동 가능 여부 확인
  const canSyncInventory = () => {
    return request.actualPurchase?.items && 
           request.actualPurchase.items.length > 0 &&
           request.status === 'delivered';
  };
  return (
    <div className="space-y-4">
      {/* 요약 통계 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            입고 내역 비교 요약
          </CardTitle>
          <CardDescription>
            요청 → 구매 → 입고 전 과정의 비교 분석
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{totalStats.requestedItems}</p>
              <p className="text-sm text-blue-800">요청 품목</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{totalStats.purchasedItems}</p>
              <p className="text-sm text-green-800">구매 품목</p>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{totalStats.receivedItems}</p>
              <p className="text-sm text-purple-800">입고 품목</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{totalStats.issueItems}</p>
              <p className="text-sm text-orange-800">이슈 품목</p>
            </div>
          </div>
          {/* 비용 비교 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Info className="h-4 w-4" />
              비용 비교
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">요청 금액</p>
                <p className="font-medium text-lg">{formatCurrency(totalStats.totalRequestedCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">실제 금액</p>
                <p className="font-medium text-lg">{formatCurrency(totalStats.totalActualCost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">차이</p>
                <p className={`font-medium text-lg flex items-center gap-1 ${
                  costDifference > 0 ? 'text-red-600' : 
                  costDifference < 0 ? 'text-green-600' : 'text-gray-600'
                }`}>
                  {costDifference > 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : costDifference < 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                  {formatCurrency(Math.abs(costDifference))}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({costDifferencePercent > 0 ? '+' : ''}{costDifferencePercent.toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>
          </div>
          {/* 이슈 알림 */}
          {totalStats.issueItems > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>{totalStats.issueItems}개 품목</strong>에서 요청 내역과 차이가 발견되었습니다. 
                상세 내역을 확인해 주세요.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      {/* 상세 비교 테이블 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>상세 비교 내역</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    간단히 보기
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    자세히 보기
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                내보내기
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comparisonData.map((item) => (
              <div key={item.materialId} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item)}
                    <div>
                      <h4 className="font-medium">{item.materialName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {getStatusText(item)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.requested.urgency === 'urgent' && (
                      <Badge variant="destructive" className="text-xs">긴급</Badge>
                    )}
                    {item.discrepancies.hasSubstitution && (
                      <Badge variant="outline" className="text-xs">대체품</Badge>
                    )}
                  </div>
                </div>
                {/* 기본 정보 */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 rounded p-3">
                    <p className="font-medium text-blue-800 mb-1">요청</p>
                    <p>수량: {item.requested.quantity}개</p>
                    <p>예상가: {formatCurrency(item.requested.estimatedPrice)}</p>
                    <p className="text-xs text-muted-foreground">
                      소계: {formatCurrency(item.requested.quantity * item.requested.estimatedPrice)}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded p-3">
                    <p className="font-medium text-green-800 mb-1">구매</p>
                    {item.actual ? (
                      <>
                        <p>수량: {item.actual.quantity}개</p>
                        <p>실제가: {formatCurrency(item.actual.actualPrice)}</p>
                        <p className="text-xs text-muted-foreground">
                          소계: {formatCurrency(item.actual.quantity * item.actual.actualPrice)}
                        </p>
                      </>
                    ) : (
                      <p className="text-red-600">구매 안됨</p>
                    )}
                  </div>
                  <div className="bg-purple-50 rounded p-3">
                    <p className="font-medium text-purple-800 mb-1">입고</p>
                    {item.received ? (
                      <>
                        <p>수량: {item.received.quantity}개</p>
                        <p>상태: {
                          item.received.condition === 'good' ? '양호' :
                          item.received.condition === 'damaged' ? '손상' : '누락'
                        }</p>
                        {item.received.notes && (
                          <p className="text-xs text-muted-foreground">
                            메모: {item.received.notes}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-yellow-600">입고 대기</p>
                    )}
                  </div>
                </div>
                {/* 상세 정보 (토글) */}
                {showDetails && (
                  <div className="mt-4 pt-4 border-t">
                    <h5 className="font-medium mb-2">차이점 분석</h5>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">수량 차이</p>
                        <p className={`font-medium ${
                          item.discrepancies.quantityDiff > 0 ? 'text-orange-600' :
                          item.discrepancies.quantityDiff < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {item.discrepancies.quantityDiff > 0 ? '+' : ''}
                          {item.discrepancies.quantityDiff}개
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">가격 차이</p>
                        <p className={`font-medium ${
                          item.discrepancies.priceDiff > 0 ? 'text-red-600' :
                          item.discrepancies.priceDiff < 0 ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {item.discrepancies.priceDiff > 0 ? '+' : ''}
                          {formatCurrency(item.discrepancies.priceDiff)}
                        </p>
                      </div>
                    </div>
                    {(item.discrepancies.conditionIssue || item.discrepancies.hasSubstitution) && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                        {item.discrepancies.conditionIssue && (
                          <p className="text-yellow-800">⚠️ 상태 이상이 발견되었습니다.</p>
                        )}
                        {item.discrepancies.hasSubstitution && (
                          <p className="text-blue-800">🔄 대체품으로 구매되었습니다.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* 처리 필요 사항 */}
      {totalStats.issueItems > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              처리 필요 사항
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comparisonData
                .filter(item => 
                  item.discrepancies.quantityDiff !== 0 || 
                  item.discrepancies.conditionIssue || 
                  item.discrepancies.hasSubstitution
                )
                .map((item) => (
                  <div key={item.materialId} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.materialName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.discrepancies.quantityDiff !== 0 && `수량 차이: ${item.discrepancies.quantityDiff}개`}
                        {item.discrepancies.conditionIssue && ' • 상태 이상'}
                        {item.discrepancies.hasSubstitution && ' • 대체품'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      보고서 작성
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
