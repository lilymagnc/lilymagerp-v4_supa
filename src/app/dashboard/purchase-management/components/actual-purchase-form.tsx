'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Package, ShoppingCart, Truck, CheckCircle2, Search, X, Plus, Filter, ChevronDown, ChevronUp } from 'lucide-react';
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
import { usePartners } from '@/hooks/use-partners';
import { useMaterials } from '@/hooks/use-materials';

interface ActualPurchaseFormProps {
  batch: PurchaseBatch;
  onComplete: () => void;
  onCancel: () => void;
  loading: boolean;
}

interface PurchaseFormItem extends ActualPurchaseItem {
  requestId: string;
  branchName: string;
  isChecked: boolean;      // 구매 체크 여부
  isAdditional?: boolean;  // 본사 추가 품목 여부
}

export function ActualPurchaseForm({
  batch,
  onComplete,
  onCancel,
  loading
}: ActualPurchaseFormProps) {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseFormItem[]>([]);
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>(batch.notes || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const { updateActualPurchase } = usePurchaseBatches();
  const { getRequestById } = useMaterialRequests();
  const { partners } = usePartners();
  const { materials, fetchMaterials } = useMaterials();
  const [supplierSearchIndex, setSupplierSearchIndex] = useState<number | null>(null);
  const [supplierSearchText, setSupplierSearchText] = useState('');

  // 필터링/뷰 상태
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [showCheckedOnly, setShowCheckedOnly] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // 추가 품목 입력 상태
  const [addItemName, setAddItemName] = useState('');
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemPrice, setAddItemPrice] = useState(0);
  const [addItemSupplier, setAddItemSupplier] = useState('');
  const [addItemMemo, setAddItemMemo] = useState('');
  const [materialSearchOpen, setMaterialSearchOpen] = useState(false);
  const [materialSearchText, setMaterialSearchText] = useState('');

  // 자재 목록 로딩
  useEffect(() => {
    if (materials.length === 0) {
      fetchMaterials({ pageSize: 1000 });
    }
  }, [fetchMaterials, materials.length]);

  // 관련 요청들 로드 및 초기 구매 품목 목록 생성
  useEffect(() => {
    const loadRequestsAndItems = async () => {
      try {
        const requestPromises = batch.includedRequests.map(requestId =>
          getRequestById(requestId)
        );
        const loadedRequests = await Promise.all(requestPromises);
        const validRequests = loadedRequests.filter(req => req !== null) as MaterialRequest[];
        setRequests(validRequests);

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
              purchaseDate: new Date().toISOString(),
              supplier: '',
              isChecked: false,
              isAdditional: false
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
    if (field === 'actualQuantity' || field === 'actualPrice') {
      newItems[index].totalAmount = newItems[index].actualQuantity * newItems[index].actualPrice;
    }
    setPurchaseItems(newItems);
    if (errors[`item-${index}-${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`item-${index}-${field}`];
      setErrors(newErrors);
    }
  };

  // 체크 토글
  const toggleCheck = (index: number) => {
    const newItems = [...purchaseItems];
    newItems[index].isChecked = !newItems[index].isChecked;
    setPurchaseItems(newItems);
  };

  // 전체 체크/해제
  const toggleAllChecks = () => {
    const allChecked = filteredItems.every(([_, item]) => item.isChecked);
    const newItems = [...purchaseItems];
    filteredItems.forEach(([idx]) => {
      newItems[idx].isChecked = !allChecked;
    });
    setPurchaseItems(newItems);
  };

  // 추가 품목 삭제
  const removeItem = (index: number) => {
    const newItems = purchaseItems.filter((_, i) => i !== index);
    setPurchaseItems(newItems);
  };

  // 본사 추가 품목 추가
  const handleAddExtraItem = () => {
    if (!addItemName.trim()) return;
    const newItem: PurchaseFormItem = {
      requestId: 'HQ-ADDITIONAL',
      branchName: '본사 추가',
      originalMaterialId: '',
      originalMaterialName: addItemName,
      requestedQuantity: 0,
      actualMaterialId: '',
      actualMaterialName: addItemName,
      actualQuantity: addItemQty,
      actualPrice: addItemPrice,
      totalAmount: addItemQty * addItemPrice,
      status: 'purchased' as PurchaseItemStatus,
      memo: addItemMemo,
      purchaseDate: new Date().toISOString(),
      supplier: addItemSupplier,
      isChecked: false,
      isAdditional: true
    };
    setPurchaseItems([...purchaseItems, newItem]);
    // 초기화
    setAddItemName('');
    setAddItemQty(1);
    setAddItemPrice(0);
    setAddItemSupplier('');
    setAddItemMemo('');
    setShowAddForm(false);
  };

  // 공급업체 목록 (현재 품목에서 추출)
  const supplierList = useMemo(() => {
    const suppliers = new Set<string>();
    purchaseItems.forEach(item => {
      if (item.supplier) suppliers.add(item.supplier);
    });
    return Array.from(suppliers).sort();
  }, [purchaseItems]);

  // 필터링된 품목 (index와 item 쌍 반환)
  const filteredItems = useMemo(() => {
    return purchaseItems
      .map((item, index) => [index, item] as [number, PurchaseFormItem])
      .filter(([_, item]) => {
        if (supplierFilter !== 'all') {
          if (supplierFilter === 'unassigned' && item.supplier && item.supplier.trim() !== '') return false;
          if (supplierFilter !== 'unassigned' && item.supplier !== supplierFilter) return false;
        }
        if (showCheckedOnly && !item.isChecked) return false;
        return true;
      });
  }, [purchaseItems, supplierFilter, showCheckedOnly]);

  // 통계
  const checkedCount = purchaseItems.filter(i => i.isChecked).length;
  const totalCost = purchaseItems.reduce((sum, item) => sum + item.totalAmount, 0);
  const additionalCount = purchaseItems.filter(i => i.isAdditional).length;

  // 자재 검색 필터 (추가 품목용)
  const filteredMaterials = useMemo(() => {
    if (!materialSearchText) return materials.slice(0, 30);
    const term = materialSearchText.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(term)).slice(0, 30);
  }, [materials, materialSearchText]);

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
      if (item.actualQuantity <= 0 && item.status !== 'unavailable') {
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
    if (!validateForm()) return;
    try {
      const purchaseData = {
        batchId: batch.id,
        purchaseDate: new Date(purchaseDate).toISOString(),
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
          purchaseDate: new Date(purchaseDate).toISOString(),
          supplier: item.supplier,
          isAdditional: item.isAdditional || false
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
    }
  };

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">실제 구매 내역 입력</h2>
          <p className="text-gray-600">배치 번호: {batch.batchNumber}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-sm">
            <Package className="w-4 h-4 mr-1" />
            {purchaseItems.length}개 품목
          </Badge>
          <Badge variant="outline" className="text-sm bg-green-50">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {checkedCount}/{purchaseItems.length} 체크
          </Badge>
          {additionalCount > 0 && (
            <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700">
              <Plus className="w-4 h-4 mr-1" />
              추가 {additionalCount}개
            </Badge>
          )}
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

        {/* 필터 및 추가 도구 */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 flex-wrap">
              {/* 공급업체 필터 */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-[180px] h-8 text-sm">
                    <SelectValue placeholder="공급업체 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 공급업체</SelectItem>
                    {supplierList.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    <SelectItem value="unassigned">미지정</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 체크된 것만 보기 */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showChecked"
                  checked={showCheckedOnly}
                  onCheckedChange={(v) => setShowCheckedOnly(!!v)}
                />
                <label htmlFor="showChecked" className="text-sm cursor-pointer">체크된 것만 보기</label>
              </div>

              <div className="flex-1" />

              {/* 품목 추가 버튼 */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                품목 추가 (본사)
                {showAddForm ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
              </Button>
            </div>

            {/* 추가 품목 입력 폼 */}
            {showAddForm && (
              <div className="mt-4 p-4 border-2 border-dashed border-blue-200 rounded-lg bg-blue-50/50 space-y-3">
                <p className="text-sm font-medium text-blue-700">📦 본사 추가 품목 (지점 요청 외)</p>
                <div className="grid grid-cols-12 gap-2">
                  {/* 자재 검색/선택 */}
                  <div className="col-span-12 sm:col-span-4 relative" ref={(() => {
                    const ref = React.createRef<HTMLDivElement>();
                    return ref;
                  })()}>
                    <Label className="text-xs">품목명 *</Label>
                    <Input
                      placeholder="자재명 검색..."
                      value={addItemName}
                      onChange={(e) => {
                        setAddItemName(e.target.value);
                        setMaterialSearchText(e.target.value);
                        setMaterialSearchOpen(!!e.target.value);
                      }}
                      onFocus={() => setMaterialSearchOpen(!!addItemName)}
                      className="h-8 text-sm"
                    />
                    {materialSearchOpen && filteredMaterials.length > 0 && (
                      <div className="absolute z-50 top-14 left-0 w-full max-h-48 overflow-y-auto bg-white border rounded-md shadow-lg">
                        {filteredMaterials.map(m => (
                          <button
                            key={m.docId || m.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between"
                            onClick={() => {
                              setAddItemName(m.name);
                              setAddItemPrice(m.price || 0);
                              setMaterialSearchOpen(false);
                            }}
                          >
                            <span>{m.name}</span>
                            <span className="text-muted-foreground">₩{(m.price || 0).toLocaleString()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">수량</Label>
                    <Input type="number" min="1" value={addItemQty} onChange={(e) => setAddItemQty(parseInt(e.target.value) || 1)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">단가</Label>
                    <Input type="number" min="0" value={addItemPrice} onChange={(e) => setAddItemPrice(parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">공급업체</Label>
                    <Input placeholder="업체명" value={addItemSupplier} onChange={(e) => setAddItemSupplier(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-12 sm:col-span-2 flex items-end">
                    <Button type="button" size="sm" onClick={handleAddExtraItem} disabled={!addItemName.trim()} className="w-full h-8">
                      <Plus className="w-3 h-3 mr-1" /> 추가
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 구매 품목 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                구매 품목 상세 내역
                <Badge variant="secondary" className="ml-2">{filteredItems.length}개 표시</Badge>
              </CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={toggleAllChecks} className="text-xs">
                {filteredItems.every(([_, item]) => item.isChecked) ? '전체 해제' : '전체 체크'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredItems.map(([index, item]) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 space-y-4 transition-all ${item.isChecked ? 'bg-green-50/50 border-green-200' : ''
                    } ${item.isAdditional ? 'border-blue-200 bg-blue-50/30' : ''}`}
                >
                  {/* 품목 헤더 */}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={item.isChecked}
                      onCheckedChange={() => toggleCheck(index)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${item.isChecked ? 'line-through text-muted-foreground' : ''}`}>
                          {item.originalMaterialName}
                        </h4>
                        {item.isAdditional && (
                          <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700">본사 추가</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {item.isAdditional ? '본사 추가 품목' : `요청 지점: ${item.branchName} | 요청 수량: ${item.requestedQuantity}개`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(item.status)}>
                        {PURCHASE_ITEM_STATUS_LABELS[item.status]}
                      </Badge>
                      {item.isAdditional && (
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600" onClick={() => removeItem(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* 구매 상태 + 수량/가격 */}
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
                            type="number" min="0" step="1"
                            value={item.actualQuantity}
                            onChange={(e) => updateItem(index, 'actualQuantity', parseInt(e.target.value) || 0)}
                            className={errors[`item-${index}-actualQuantity`] ? 'border-red-500' : ''}
                          />
                        </div>
                        <div>
                          <Label>실제 단가 *</Label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.actualPrice}
                            onChange={(e) => updateItem(index, 'actualPrice', parseFloat(e.target.value) || 0)}
                            className={errors[`item-${index}-actualPrice`] ? 'border-red-500' : ''}
                          />
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
                          onChange={(e) => updateItem(index, 'actualMaterialId', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>대체품명 *</Label>
                        <Input
                          placeholder="실제 구매한 대체품명"
                          value={item.actualMaterialName}
                          onChange={(e) => updateItem(index, 'actualMaterialName', e.target.value)}
                          className={errors[`item-${index}-actualMaterialName`] ? 'border-red-500' : ''}
                        />
                      </div>
                    </div>
                  )}

                  {/* 공급업체 및 메모 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Label>공급업체</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="거래처 검색 또는 직접 입력..."
                          value={supplierSearchIndex === index ? supplierSearchText : (item.supplier || '')}
                          onChange={(e) => {
                            if (supplierSearchIndex !== index) setSupplierSearchIndex(index);
                            setSupplierSearchText(e.target.value);
                            updateItem(index, 'supplier', e.target.value);
                          }}
                          onFocus={() => {
                            setSupplierSearchIndex(index);
                            setSupplierSearchText(item.supplier || '');
                          }}
                          onBlur={() => setTimeout(() => setSupplierSearchIndex(null), 200)}
                          className="pl-9"
                        />
                        {item.supplier && supplierSearchIndex !== index && (
                          <button
                            type="button"
                            onClick={() => updateItem(index, 'supplier', '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                      {supplierSearchIndex === index && (
                        <div className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto bg-background border rounded-md shadow-lg">
                          {partners
                            .filter(p => !supplierSearchText || p.name.toLowerCase().includes(supplierSearchText.toLowerCase()))
                            .slice(0, 20)
                            .map(partner => (
                              <button
                                key={partner.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  updateItem(index, 'supplier', partner.name);
                                  setSupplierSearchIndex(null);
                                  setSupplierSearchText('');
                                }}
                              >
                                <span className="font-medium">{partner.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {partner.type || ''}{partner.items ? ` · ${partner.items}` : ''}
                                </span>
                              </button>
                            ))}
                          {partners.filter(p => !supplierSearchText || p.name.toLowerCase().includes(supplierSearchText.toLowerCase())).length === 0 && (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              검색 결과 없음 — 이름을 직접 입력하세요
                            </div>
                          )}
                        </div>
                      )}
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
                    </div>
                  </div>

                  {/* 요청 vs 실제 비교 (요청 품목만) */}
                  {!item.isAdditional && (
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
                          <span className={`ml-2 font-medium ${item.actualQuantity - item.requestedQuantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.actualQuantity - item.requestedQuantity > 0 ? '+' : ''}
                            {item.actualQuantity - item.requestedQuantity}개
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {filteredItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {showCheckedOnly ? '체크된 품목이 없습니다.' : '표시할 품목이 없습니다.'}
                </div>
              )}
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
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            취소
          </Button>
          <Button type="submit" disabled={loading} className="min-w-[120px]">
            {loading ? '저장 중...' : '구매 내역 저장'}
          </Button>
        </div>
      </form>
    </div>
  );
}
