"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterials } from '@/hooks/use-materials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Plus, Minus, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MaterialRequestCart } from './components/material-request-cart';
import { RequestStatusTracker } from './components/request-status-tracker';
import { DeliveryNotifications } from './components/delivery-notifications';
import { DeliveryManagement } from './components/delivery-management';
import { ReceivingComparison } from './components/receiving-comparison';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import type { RequestItem, UrgencyLevel } from '@/types/material-request';
import type { Material } from '@/hooks/use-materials';
import { useBranches } from '@/hooks/use-branches';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
export default function MaterialRequestPage() {
  const { user } = useAuth();
  const { materials, loading: materialsLoading } = useMaterials();
  const { branches, loading: branchesLoading } = useBranches();
  const { createRequest, loading: requestLoading } = useMaterialRequests();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 기존 상태 변수들
  const [cartItems, setCartItems] = useState<RequestItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  // 누락된 상태 변수들 추가
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [memo, setMemo] = useState('');
  useEffect(() => {
    // 사용자가 있고, 지점 목록이 로드되었을 때 기본 선택 설정
    if (user && branches.length > 0) {
      if (user.role === '본사 관리자' && !selectedBranch) {
        setSelectedBranch(branches[0].name); // 본사 관리자는 첫 번째 지점을 기본 선택
      } else if (user.franchise) {
        setSelectedBranch(user.franchise);
      }
    }
  }, [user, branches]); // user와 branches가 변경될 때마다 실행
  // 현재 사용자의 지점 또는 선택된 지점에 해당하는 자재만 필터링
  const availableMaterials = materials.filter(material =>
    material.branch === selectedBranch
  ).filter(material => material.stock > 0); // 재고가 있는 자재만 표시
  // 자재를 카테고리별로 그룹화
  const groupedMaterials = availableMaterials.reduce((acc, material) => {
    const category = material.mainCategory || '기타';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(material);
    return acc;
  }, {} as Record<string, Material[]>);
  // 장바구니에 자재 추가
  const handleAddToCart = () => {
    if (!selectedMaterial) {
      toast({
        variant: 'destructive',
        title: '자재 선택 필요',
        description: '추가할 자재를 선택해주세요.',
      });
      return;
    }
    if (quantity <= 0) {
      toast({
        variant: 'destructive',
        title: '수량 오류',
        description: '수량은 1개 이상이어야 합니다.',
      });
      return;
    }
    // 이미 장바구니에 있는 자재인지 확인 (ID와 지점으로 구분)
    const materialKey = `${selectedMaterial.id}-${selectedMaterial.branch}`;
    const existingItemIndex = cartItems.findIndex(
      item => item.materialId === materialKey
    );
    if (existingItemIndex >= 0) {
      // 기존 아이템 수량 업데이트
      const updatedItems = [...cartItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        requestedQuantity: updatedItems[existingItemIndex].requestedQuantity + quantity,
        urgency,
        memo: memo || updatedItems[existingItemIndex].memo
      };
      setCartItems(updatedItems);
    } else {
      // 새 아이템 추가
      const newItem: RequestItem = {
        materialId: materialKey,
        materialName: selectedMaterial.name,
        requestedQuantity: quantity,
        estimatedPrice: selectedMaterial.price,
        urgency,
        memo
      };
      setCartItems([...cartItems, newItem]);
    }
    // 폼 초기화
    setSelectedMaterial(null);
    setQuantity(1);
    setUrgency('normal');
    setMemo('');
    setShowCart(true);
    toast({
      title: '장바구니 추가',
      description: `${selectedMaterial.name}이(가) 장바구니에 추가되었습니다.`,
    });
  };
  // 장바구니에서 아이템 제거
  const handleRemoveFromCart = (materialId: string) => {
    setCartItems(cartItems.filter(item => item.materialId !== materialId));
  };
  // 장바구니 아이템 수량 업데이트
  const handleUpdateQuantity = (materialId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(materialId);
      return;
    }
    setCartItems(cartItems.map(item =>
      item.materialId === materialId
        ? { ...item, requestedQuantity: newQuantity }
        : item
    ));
  };
  // 장바구니 아이템 정보 업데이트 (긴급도, 메모 등)
  const handleUpdateItem = (materialId: string, updates: Partial<RequestItem>) => {
    setCartItems(cartItems.map(item =>
      item.materialId === materialId
        ? { ...item, ...updates }
        : item
    ));
  };
  // 장바구니 저장
  const handleSaveCart = () => {
    if (cartItems.length === 0) {
      toast({
        variant: 'destructive',
        title: '장바구니 비어있음',
        description: '저장할 아이템이 없습니다.',
      });
      return;
    }
    localStorage.setItem('material-request-cart', JSON.stringify(cartItems));
    toast({
      title: '장바구니 저장됨',
      description: `${cartItems.length}개 아이템이 저장되었습니다.`,
    });
  };
  // 장바구니 불러오기
  const handleLoadCart = () => {
    const saved = localStorage.getItem('material-request-cart');
    if (saved) {
      try {
        const savedItems = JSON.parse(saved) as RequestItem[];
        // 저장된 아이템들을 현재 장바구니에 추가 (중복 제거)
        const newItems = [...cartItems];
        let addedCount = 0;
        savedItems.forEach(savedItem => {
          const exists = newItems.find(item => item.materialId === savedItem.materialId);
          if (!exists) {
            newItems.push(savedItem);
            addedCount++;
          }
        });
        setCartItems(newItems);
        setShowCart(true);
        toast({
          title: '장바구니 불러옴',
          description: `${addedCount}개의 새로운 아이템을 추가했습니다.`,
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '불러오기 실패',
          description: '저장된 데이터를 읽을 수 없습니다.',
        });
      }
    } else {
      toast({
        variant: 'destructive',
        title: '저장된 장바구니 없음',
        description: '저장된 장바구니가 없습니다.',
      });
    }
  };
  // 자재 행 클릭 시 바로 장바구니에 추가하는 함수
  const handleMaterialClick = (material: Material) => {
    // 이미 장바구니에 있는 자재인지 확인 (ID와 지점으로 구분)
    const materialKey = `${material.id}-${material.branch}`;
    const existingItemIndex = cartItems.findIndex(
      item => item.materialId === materialKey
    );
    if (existingItemIndex >= 0) {
      // 기존 아이템 수량 1 증가
      const updatedItems = [...cartItems];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        requestedQuantity: updatedItems[existingItemIndex].requestedQuantity + 1
      };
      setCartItems(updatedItems);
    } else {
      // 새 아이템 추가 (기본 수량 1, 긴급도 일반)
      const newItem: RequestItem = {
        materialId: materialKey,
        materialName: material.name,
        requestedQuantity: 1,
        estimatedPrice: material.price,
        urgency: 'normal',
        memo: ''
      };
      setCartItems([...cartItems, newItem]);
    }
    // selectedMaterial 상태 초기화로 조건부 렌더링 블록 제거
    setSelectedMaterial(null);
    setShowCart(true);
    toast({
      title: '장바구니 추가',
      description: `${material.name}이(가) 장바구니에 추가되었습니다.`,
    });
  };
  // 요청 제출
  const handleSubmitRequest = async () => {
    if (cartItems.length === 0) {
      toast({
        variant: 'destructive',
        title: '장바구니 비어있음',
        description: '요청할 자재를 장바구니에 추가해주세요.',
      });
      return;
    }
    if (!user?.email) {
      toast({
        variant: 'destructive',
        title: '사용자 정보 오류',
        description: '사용자 정보를 확인할 수 없습니다.',
      });
      return;
    }
    // Firebase 인증 상태 확인
    // Firebase Auth 상태 확인
    const { auth } = await import('@/lib/firebase');
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({
        variant: 'destructive',
        title: '인증 오류',
        description: 'Firebase 인증이 필요합니다. 다시 로그인해주세요.',
      });
      return;
    }
    const targetBranch = branches.find(b => b.name === selectedBranch);
    if (!targetBranch) {
      toast({
        variant: 'destructive',
        title: '지점 정보 오류',
        description: '요청할 지점을 찾을 수 없습니다.',
      });
      return;
    }
    try {
      const requestData = {
        branchId: targetBranch.id,
        branchName: targetBranch.name,
        requesterId: user.uid,
        requesterName: user.email, // 본사 관리자가 요청하더라도 요청자는 본인으로 기록
        requestedItems: cartItems
      };
      const requestNumber = await createRequest(requestData);
      toast({
        title: '요청 제출 완료',
        description: `요청번호: ${requestNumber}`,
      });
      // 장바구니 초기화
      setCartItems([]);
      setShowCart(false);
      // 요청현황 자동 새로고침
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('요청 제출 오류:', error);
      toast({
        variant: 'destructive',
        title: '요청 제출 실패',
        description: '요청 제출 중 오류가 발생했습니다.',
      });
    }
  };
  // 총 예상 비용 계산
  const totalEstimatedCost = cartItems.reduce(
    (total, item) => total + (item.requestedQuantity * item.estimatedPrice),
    0
  );
  const isLoading = materialsLoading || branchesLoading;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">자재 요청</h1>
          <p className="text-muted-foreground">
            필요한 자재를 본사에 요청하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === '본사 관리자' && branches.length > 0 && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="지점 선택" />
              </SelectTrigger>
              <SelectContent>
                {branches.map(branch => (
                  <SelectItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="outline">
            {selectedBranch || '지점을 선택하세요'}
          </Badge>
          {cartItems.length > 0 && (
            <Button
              onClick={() => setShowCart(!showCart)}
              variant="outline"
              className="relative"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              장바구니 ({cartItems.length})
            </Button>
          )}
        </div>
      </div>
      {/* 배송 알림 섹션 */}
      <DeliveryNotifications key={`delivery-${selectedBranch}`} selectedBranch={selectedBranch} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 자재 선택 영역 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 자재 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>사용 가능한 자재</CardTitle>
              <CardDescription>
                요청할 자재를 선택하고 수량을 입력하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={Object.keys(groupedMaterials)} className="w-full">
                {Object.entries(groupedMaterials).map(([category, items]) => (
                  <AccordionItem key={category} value={category}>
                    <AccordionTrigger className="text-lg font-semibold">{category} ({items.length})</AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>자재명</TableHead>
                            <TableHead>카테고리</TableHead>
                            <TableHead className="text-right">재고</TableHead>
                            <TableHead className="text-right">단가</TableHead>
                            <TableHead>규격</TableHead>
                            <TableHead>공급업체</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((material) => (
                            <TableRow
                              key={`${material.docId || material.id}-${material.branch}`}
                              onClick={() => handleMaterialClick(material)}
                              className="cursor-pointer hover:bg-primary/5"
                            >
                              <TableCell className="font-medium">{material.name}</TableCell>
                              <TableCell className="text-muted-foreground">{material.midCategory}</TableCell>
                              <TableCell className="text-right">{material.stock}</TableCell>
                              <TableCell className="text-right">{material.price.toLocaleString()}원</TableCell>
                              <TableCell className="text-muted-foreground">{material.size} / {material.color}</TableCell>
                              <TableCell className="text-muted-foreground">{material.supplier}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              {availableMaterials.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>사용 가능한 자재가 없습니다.</p>
                </div>
              )}
            </CardContent>
          </Card>
          {selectedMaterial && (
            <Card>
              <CardHeader>
                <CardTitle>선택된 자재: {selectedMaterial.name}</CardTitle>
                <CardDescription>
                  수량과 옵션을 설정하고 장바구니에 추가하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 수량 입력 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">수량</label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 text-center border rounded px-2 py-1"
                        min="1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuantity(quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* 긴급도 선택 */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">긴급도</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="normal">일반</option>
                      <option value="urgent">긴급</option>
                    </select>
                  </div>
                </div>
                {/* 메모 입력 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">메모 (선택사항)</label>
                  <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="특별한 요청사항이나 메모를 입력하세요"
                    className="w-full border rounded px-3 py-2 h-20 resize-none"
                  />
                </div>
                {/* 예상 비용 */}
                <div className="bg-muted p-3 rounded">
                  <p className="text-sm">
                    예상 비용: <span className="font-medium">
                      {(quantity * selectedMaterial.price).toLocaleString()}원
                    </span>
                  </p>
                </div>
                <Button onClick={handleAddToCart} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  장바구니에 추가
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        {/* 장바구니 및 요청 상태 */}
        <div className="space-y-6">
          {/* 장바구니 */}
          {(showCart || cartItems.length > 0) && (
            <MaterialRequestCart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantity}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveFromCart}
              onSubmitRequest={handleSubmitRequest}
              onSaveCart={handleSaveCart}
              onLoadCart={handleLoadCart}
              totalEstimatedCost={totalEstimatedCost}
              loading={requestLoading}
            />
          )}
          {/* 요청 상태 추적 */}
          <RequestStatusTracker key={`tracker-${selectedBranch}-${refreshTrigger}`} selectedBranch={selectedBranch} />
        </div>
      </div>
    </div>
  );
}
