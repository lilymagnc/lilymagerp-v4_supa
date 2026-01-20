"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Minus, Trash2, Send, ShoppingCart, Edit3, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { RequestItem, UrgencyLevel } from '@/types/material-request';
interface MaterialRequestCartProps {
  items: RequestItem[];
  onUpdateQuantity: (materialId: string, quantity: number) => void;
  onUpdateItem: (materialId: string, updates: Partial<RequestItem>) => void;
  onRemoveItem: (materialId: string) => void;
  onSubmitRequest: () => void;
  onSaveCart?: () => void;
  onLoadCart?: () => void;
  totalEstimatedCost: number;
  loading?: boolean;
}
export function MaterialRequestCart({
  items,
  onUpdateQuantity,
  onUpdateItem,
  onRemoveItem,
  onSubmitRequest,
  onSaveCart,
  onLoadCart,
  totalEstimatedCost,
  loading = false
}: MaterialRequestCartProps) {
  const [editingItem, setEditingItem] = useState<RequestItem | null>(null);
  const [editForm, setEditForm] = useState({
    quantity: 1,
    urgency: 'normal' as UrgencyLevel,
    memo: ''
  });
  const [sortBy, setSortBy] = useState<'name' | 'urgency' | 'cost'>('name');
  const [showUrgentOnly, setShowUrgentOnly] = useState(false);
  const { toast } = useToast();
  // 아이템 정렬 및 필터링
  const sortedAndFilteredItems = React.useMemo(() => {
    let filteredItems = showUrgentOnly 
      ? items.filter(item => item.urgency === 'urgent')
      : items;
    return filteredItems.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.materialName.localeCompare(b.materialName);
        case 'urgency':
          if (a.urgency === 'urgent' && b.urgency === 'normal') return -1;
          if (a.urgency === 'normal' && b.urgency === 'urgent') return 1;
          return a.materialName.localeCompare(b.materialName);
        case 'cost':
          const aCost = a.requestedQuantity * a.estimatedPrice;
          const bCost = b.requestedQuantity * b.estimatedPrice;
          return bCost - aCost; // 높은 비용부터
        default:
          return 0;
      }
    });
  }, [items, sortBy, showUrgentOnly]);
  // 아이템 편집 시작
  const handleStartEdit = (item: RequestItem) => {
    setEditingItem(item);
    setEditForm({
      quantity: item.requestedQuantity,
      urgency: item.urgency,
      memo: item.memo || ''
    });
  };
  // 아이템 편집 저장
  const handleSaveEdit = () => {
    if (!editingItem) return;
    onUpdateItem(editingItem.materialId, {
      requestedQuantity: editForm.quantity,
      urgency: editForm.urgency,
      memo: editForm.memo
    });
    setEditingItem(null);
  };
  // 아이템 편집 취소
  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditForm({
      quantity: 1,
      urgency: 'normal',
      memo: ''
    });
  };
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            장바구니
          </CardTitle>
          <CardDescription>
            요청할 자재를 추가해주세요
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>장바구니가 비어있습니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          장바구니 ({items.length}개 품목)
        </CardTitle>
        <CardDescription>
          요청할 자재 목록을 확인하고 제출하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 정렬 및 필터 옵션 */}
        <div className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">정렬:</span>
            <Select value={sortBy} onValueChange={(value: 'name' | 'urgency' | 'cost') => setSortBy(value)}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">이름순</SelectItem>
                <SelectItem value="urgency">긴급도순</SelectItem>
                <SelectItem value="cost">비용순</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showUrgentOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUrgentOnly(!showUrgentOnly)}
              className="h-8"
            >
              {showUrgentOnly ? "전체 보기" : "긴급만 보기"}
            </Button>
          </div>
        </div>
        {/* 장바구니 아이템 목록 */}
        <div className="space-y-3">
          {sortedAndFilteredItems.length === 0 && items.length > 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p>필터 조건에 맞는 아이템이 없습니다.</p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => setShowUrgentOnly(false)}
                className="mt-1"
              >
                전체 아이템 보기
              </Button>
            </div>
          ) : (
            sortedAndFilteredItems.map((item) => (
            <div key={item.materialId} className="border rounded-lg p-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <h4 className="font-medium">{item.materialName}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge 
                      variant={item.urgency === 'urgent' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {item.urgency === 'urgent' ? '긴급' : '일반'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      단가: {item.estimatedPrice.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* 편집 버튼 */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(item)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>자재 정보 수정</DialogTitle>
                        <DialogDescription>
                          {item.materialName}의 수량, 긴급도, 메모를 수정할 수 있습니다.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {/* 수량 입력 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="quantity" className="text-right text-sm font-medium">
                            수량
                          </label>
                          <div className="col-span-3 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditForm(prev => ({ 
                                ...prev, 
                                quantity: Math.max(1, prev.quantity - 1) 
                              }))}
                              disabled={editForm.quantity <= 1}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              id="quantity"
                              type="number"
                              value={editForm.quantity}
                              onChange={(e) => setEditForm(prev => ({ 
                                ...prev, 
                                quantity: Math.max(1, parseInt(e.target.value) || 1) 
                              }))}
                              className="w-20 text-center"
                              min="1"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditForm(prev => ({ 
                                ...prev, 
                                quantity: prev.quantity + 1 
                              }))}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {/* 긴급도 선택 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="urgency" className="text-right text-sm font-medium">
                            긴급도
                          </label>
                          <div className="col-span-3">
                            <Select
                              value={editForm.urgency}
                              onValueChange={(value: UrgencyLevel) => 
                                setEditForm(prev => ({ ...prev, urgency: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">일반</SelectItem>
                                <SelectItem value="urgent">긴급</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {/* 메모 입력 */}
                        <div className="grid grid-cols-4 items-start gap-4">
                          <label htmlFor="memo" className="text-right text-sm font-medium pt-2">
                            메모
                          </label>
                          <div className="col-span-3">
                            <Textarea
                              id="memo"
                              value={editForm.memo}
                              onChange={(e) => setEditForm(prev => ({ 
                                ...prev, 
                                memo: e.target.value 
                              }))}
                              placeholder="특별한 요청사항이나 메모를 입력하세요"
                              className="resize-none"
                              rows={3}
                            />
                          </div>
                        </div>
                        {/* 예상 비용 표시 */}
                        <div className="grid grid-cols-4 items-center gap-4">
                          <span className="text-right text-sm font-medium">예상 비용</span>
                          <div className="col-span-3">
                            <span className="text-lg font-semibold text-primary">
                              {(editForm.quantity * item.estimatedPrice).toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={handleCancelEdit}>
                          취소
                        </Button>
                        <Button onClick={handleSaveEdit}>
                          저장
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {/* 삭제 버튼 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveItem(item.materialId)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* 수량 조절 (빠른 조절용) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">수량:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateQuantity(item.materialId, item.requestedQuantity - 1)}
                    disabled={item.requestedQuantity <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-12 text-center font-medium">
                    {item.requestedQuantity}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUpdateQuantity(item.materialId, item.requestedQuantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {(item.requestedQuantity * item.estimatedPrice).toLocaleString()}원
                  </p>
                </div>
              </div>
              {/* 메모 표시 */}
              {item.memo && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  <p className="text-muted-foreground">메모: {item.memo}</p>
                </div>
              )}
            </div>
            ))
          )}
        </div>
        <Separator />
        {/* 총 비용 */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">총 품목 수:</span>
            <span className="font-medium">{items.length}개</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">총 수량:</span>
            <span className="font-medium">
              {items.reduce((total, item) => total + item.requestedQuantity, 0)}개
            </span>
          </div>
          <div className="flex justify-between items-center text-lg">
            <span className="font-medium">총 예상 비용:</span>
            <span className="font-bold text-primary">
              {totalEstimatedCost.toLocaleString()}원
            </span>
          </div>
        </div>
        <Separator />
        {/* 일괄 작업 버튼들 */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              items.forEach(item => {
                onUpdateItem(item.materialId, { urgency: 'urgent' });
              });
            }}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            모두 긴급으로
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              items.forEach(item => {
                onUpdateItem(item.materialId, { urgency: 'normal' });
              });
            }}
          >
            모두 일반으로
          </Button>
        </div>
        {/* 장바구니 저장/불러오기 */}
        {(onSaveCart || onLoadCart) && (
          <div className="flex gap-2">
            {onSaveCart && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveCart}
                className="flex-1"
              >
                장바구니 저장
              </Button>
            )}
            {onLoadCart && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadCart}
                className="flex-1"
              >
                장바구니 불러오기
              </Button>
            )}
          </div>
        )}
        {/* 긴급 요청 알림 */}
        {items.some(item => item.urgency === 'urgent') && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">긴급 요청 포함</span>
            </div>
            <p className="text-xs text-destructive/80 mt-1">
              긴급 요청이 포함된 경우 우선적으로 처리됩니다.
            </p>
          </div>
        )}
        {/* 제출 버튼 */}
        <Button 
          onClick={onSubmitRequest} 
          className="w-full" 
          size="lg"
          disabled={loading}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              요청 제출 중...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              본사에 요청 제출
            </>
          )}
        </Button>
        {/* 안내 메시지 */}
        <div className="text-xs text-muted-foreground text-center">
          <p>요청 제출 후 본사에서 검토하여 구매를 진행합니다.</p>
          <p>실제 구매 가격은 시장 상황에 따라 달라질 수 있습니다.</p>
        </div>
      </CardContent>
    </Card>
  );
}
