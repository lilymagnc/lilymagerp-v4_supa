'use client';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Package, ShoppingCart, Truck, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PurchaseBatch, 
  ActualPurchaseItem, 
  PurchaseItemStatus,
  PURCHASE_ITEM_STATUS_LABELS,
  MaterialRequest,
  RequestItem
} from '@/types/material-request';
import { usePurchaseBatches } from '@/hooks/use-purchase-batches';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { Timestamp } from 'firebase/firestore';
interface ActualPurchaseFormProps {
  batch: PurchaseBatch;
  onComplete: () => void;
  onCancel: () => void;
  loading: boolean; // usePurchaseBatches 훅의 로딩 상태를 전달받음
}
// ... (중간 코드 생략)
export function ActualPurchaseForm({
  batch,
  onComplete,
  onCancel,
  loading // prop으로 loading 상태를 받음
}: ActualPurchaseFormProps) {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseFormItem[]>([]);
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>(batch.notes || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  // isSubmitting 상태는 더 이상 필요 없음 (prop으로 loading을 받으므로)
  // const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const { updateActualPurchase } = usePurchaseBatches();
  const { getRequestById } = useMaterialRequests();
  // 관련 요청들 로드 및 초기 구매 품목 목록 생성
  useEffect(() => {
    const loadRequestsAndItems = async () => {
      try {
        // 배치에 포함된 요청들 로드
        const requestPromises = batch.includedRequests.map(requestId => 
          getRequestById(requestId)
        );
        const loadedRequests = await Promise.all(requestPromises);
        const validRequests = loadedRequests.filter(req => req !== null) as MaterialRequest[];
        setRequests(validRequests);
        // 초기 구매 품목 목록 생성
        const items: PurchaseFormItem[] = [];
        validRequests.forEach(request => {
          request.requestedItems.forEach(requestItem => {
            items.push({
              requestId: request.id,
              branchName: request.branchName,
              originalMaterialId: requestItem.materialId,
              originalMaterialName: requestItem.materialName,
              requestedQuantity: requestItem.requestedQuantity,
              actualMaterialId: requestItem.materialId,
              actualMaterialName: requestItem.materialName,
              actualQuantity: requestItem.requestedQuantity,
              actualPrice: requestItem.estimatedPrice,
              totalAmount: requestItem.requestedQuantity * requestItem.estimatedPrice,
              status: 'purchased' as PurchaseItemStatus,
              memo: requestItem.memo || '',
              purchaseDate: Timestamp.now(),
              supplier: ''
            });
          });
        });
        setPurchaseItems(items);
      } catch (error) {
        console.error('요청 로드 오류:', error);
      }
    };
    loadRequestsAndItems();
  }, [batch.includedRequests, getRequestById]);
  // 품목 업데이트 함수
  const updateItem = (index: number, field: keyof PurchaseFormItem, value: any) => {
    const newItems = [...purchaseItems];
    newItems[index] = { ...newItems[index], [field]: value };
    // 수량이나 가격이 변경되면 총액 자동 계산
    if (field === 'actualQuantity' || field === 'actualPrice') {
      newItems[index].totalAmount = newItems[index].actualQuantity * newItems[index].actualPrice;
    }
    setPurchaseItems(newItems);
    // 에러 제거
    if (errors[`item-${index}-${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`item-${index}-${field}`];
      setErrors(newErrors);
    }
  };
  // 대체품 설정 함수
  const setSubstitute = (index: number, isSubstitute: boolean) => {
    const newItems = [...purchaseItems];
    if (isSubstitute) {
      newItems[index].status = 'substituted';
      newItems[index].actualMaterialId = '';
      newItems[index].actualMaterialName = '';
    } else {
      newItems[index].status = 'purchased';
      newItems[index].actualMaterialId = newItems[index].originalMaterialId;
      newItems[index].actualMaterialName = newItems[index].originalMaterialName;
    }
    setPurchaseItems(newItems);
  };
  // 총 비용 계산
  const totalCost = purchaseItems.reduce((sum, item) => sum + item.totalAmount, 0);
  // 유효성 검사
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!purchaseDate) {
      newErrors.purchaseDate = '구매 날짜를 선택해주세요.';
    }
    purchaseItems.forEach((item, index) => {
      if (!item.actualMaterialName.trim()) {
        newErrors[`item-${index}-actualMaterialName`] = '자재명을 입력해주세요.';
      }
      if (item.actualQuantity <= 0) {
        newErrors[`item-${index}-actualQuantity`] = '수량은 0보다 커야 합니다.';
      }
      if (item.actualPrice < 0) {
        newErrors[`item-${index}-actualPrice`] = '가격은 0 이상이어야 합니다.';
      }
      if (item.status === 'unavailable' && !item.memo.trim()) {
        newErrors[`item-${index}-memo`] = '구매 불가 사유를 입력해주세요.';
      }
      if (item.status === 'substituted' && !item.memo.trim()) {
        newErrors[`item-${index}-memo`] = '대체 사유를 입력해주세요.';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    try {
      const purchaseData = {
        batchId: batch.id,
        purchaseDate: Timestamp.fromDate(new Date(purchaseDate)),
        items: purchaseItems.map(item => ({
          originalMaterialId: item.originalMaterialId,
          originalMaterialName: item.originalMaterialName,
          requestedQuantity: item.requestedQuantity,
          actualMaterialId: item.actualMaterialId,
          actualMaterialName: item.actualMaterialName,
          actualQuantity: item.actualQuantity,
          actualPrice: item.actualPrice,
          totalAmount: item.totalAmount,
          status: item.status,
          memo: item.memo,
          purchaseDate: Timestamp.fromDate(new Date(purchaseDate)),
          supplier: item.supplier
        })),
        totalCost,
        notes
      };
      const success = await updateActualPurchase(batch.id, purchaseData);
      if (success) {
        onComplete();
      }
    } catch (error) {
      console.error('구매 내역 저장 오류:', error);
    } finally {
      // setIsSubmitting(false); // 외부에서 loading prop으로 관리되므로 제거
    }
  };
  // 상태별 색상 반환
  const getStatusColor = (status: PurchaseItemStatus) => {
    switch (status) {
      case 'purchased': return 'bg-green-100 text-green-800';
      case 'unavailable': return 'bg-red-100 text-red-800';
      case 'substituted': return 'bg-yellow-100 text-yellow-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">실제 구매 내역 입력</h2>
          <p className="text-gray-600">배치 번호: {batch.batchNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            <Package className="w-4 h-4 mr-1" />
            {purchaseItems.length}개 품목
          </Badge>
          <Badge variant="outline" className="text-sm">
            <ShoppingCart className="w-4 h-4 mr-1" />
            총 {totalCost.toLocaleString()}원
          </Badge>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 구매 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              구매 기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchaseDate">구매 날짜 *</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={errors.purchaseDate ? 'border-red-500' : ''}
                />
                {errors.purchaseDate && (
                  <p className="text-sm text-red-500 mt-1">{errors.purchaseDate}</p>
                )}
              </div>
              <div>
                <Label>총 구매 비용</Label>
                <div className="text-2xl font-bold text-green-600">
                  {totalCost.toLocaleString()}원
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="notes">구매 메모</Label>
              <Textarea
                id="notes"
                placeholder="구매 관련 특이사항이나 메모를 입력하세요..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
        {/* 구매 품목 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              구매 품목 상세 내역
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {purchaseItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  {/* 품목 헤더 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{item.originalMaterialName}</h4>
                      <p className="text-sm text-gray-600">
                        요청 지점: {item.branchName} | 요청 수량: {item.requestedQuantity}개
                      </p>
                    </div>
                    <Badge className={getStatusColor(item.status)}>
                      {PURCHASE_ITEM_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  <Separator />
                  {/* 구매 상태 선택 */}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label>구매 상태 *</Label>
                      <Select
                        value={item.status}
                        onValueChange={(value: PurchaseItemStatus) => 
                          updateItem(index, 'status', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="purchased">구매완료</SelectItem>
                          <SelectItem value="unavailable">구매불가</SelectItem>
                          <SelectItem value="substituted">대체품</SelectItem>
                          <SelectItem value="partial">부분구매</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {item.status !== 'unavailable' && (
                      <>
                        <div>
                          <Label>실제 수량 *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={item.actualQuantity}
                            onChange={(e) => 
                              updateItem(index, 'actualQuantity', parseInt(e.target.value) || 0)
                            }
                            className={errors[`item-${index}-actualQuantity`] ? 'border-red-500' : ''}
                          />
                          {errors[`item-${index}-actualQuantity`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`item-${index}-actualQuantity`]}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>실제 단가 *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.actualPrice}
                            onChange={(e) => 
                              updateItem(index, 'actualPrice', parseFloat(e.target.value) || 0)
                            }
                            className={errors[`item-${index}-actualPrice`] ? 'border-red-500' : ''}
                          />
                          {errors[`item-${index}-actualPrice`] && (
                            <p className="text-sm text-red-500 mt-1">
                              {errors[`item-${index}-actualPrice`]}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>총액</Label>
                          <div className="text-lg font-semibold text-green-600 mt-2">
                            {item.totalAmount.toLocaleString()}원
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {/* 대체품 정보 */}
                  {item.status === 'substituted' && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <Label>대체품 ID</Label>
                        <Input
                          placeholder="대체품 자재 ID"
                          value={item.actualMaterialId || ''}
                          onChange={(e) => 
                            updateItem(index, 'actualMaterialId', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <Label>대체품명 *</Label>
                        <Input
                          placeholder="실제 구매한 대체품명"
                          value={item.actualMaterialName}
                          onChange={(e) => 
                            updateItem(index, 'actualMaterialName', e.target.value)
                          }
                          className={errors[`item-${index}-actualMaterialName`] ? 'border-red-500' : ''}
                        />
                        {errors[`item-${index}-actualMaterialName`] && (
                          <p className="text-sm text-red-500 mt-1">
                            {errors[`item-${index}-actualMaterialName`]}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* 공급업체 및 메모 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>공급업체</Label>
                      <Input
                        placeholder="구매처 또는 공급업체명"
                        value={item.supplier || ''}
                        onChange={(e) => updateItem(index, 'supplier', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>
                        메모 
                        {(item.status === 'unavailable' || item.status === 'substituted') && 
                          <span className="text-red-500"> *</span>
                        }
                      </Label>
                      <Input
                        placeholder={
                          item.status === 'unavailable' ? '구매 불가 사유를 입력하세요' :
                          item.status === 'substituted' ? '대체 사유를 입력하세요' :
                          '특이사항이나 메모를 입력하세요'
                        }
                        value={item.memo}
                        onChange={(e) => updateItem(index, 'memo', e.target.value)}
                        className={errors[`item-${index}-memo`] ? 'border-red-500' : ''}
                      />
                      {errors[`item-${index}-memo`] && (
                        <p className="text-sm text-red-500 mt-1">
                          {errors[`item-${index}-memo`]}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* 요청 vs 실제 비교 */}
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">요청 수량:</span>
                        <span className="ml-2 font-medium">{item.requestedQuantity}개</span>
                      </div>
                      <div>
                        <span className="text-gray-600">실제 수량:</span>
                        <span className="ml-2 font-medium">{item.actualQuantity}개</span>
                      </div>
                      <div>
                        <span className="text-gray-600">수량 차이:</span>
                        <span className={`ml-2 font-medium ${
                          item.actualQuantity - item.requestedQuantity >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.actualQuantity - item.requestedQuantity > 0 ? '+' : ''}
                          {item.actualQuantity - item.requestedQuantity}개
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* 경고 메시지 */}
        {Object.keys(errors).length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              입력 정보를 확인해주세요. 필수 항목이 누락되었거나 올바르지 않은 값이 있습니다.
            </AlertDescription>
          </Alert>
        )}
        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="min-w-[120px]"
          >
            {loading ? '저장 중...' : '구매 내역 저장'}
          </Button>
        </div>
      </form>
    </div>
  );
}
