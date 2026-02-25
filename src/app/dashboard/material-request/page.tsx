"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterials } from '@/hooks/use-materials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ShoppingCart, Plus, Minus, Package, Filter, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { MaterialRequestCart } from './components/material-request-cart';
import { RequestStatusTracker } from './components/request-status-tracker';
import { DeliveryNotifications } from './components/delivery-notifications';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import type { RequestItem, UrgencyLevel } from '@/types/material-request';
import type { Material } from '@/hooks/use-materials';
import { useBranches } from '@/hooks/use-branches';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

export default function MaterialRequestPage() {
  const { user } = useAuth();
  const { materials, loading: materialsLoading, fetchMaterials } = useMaterials();
  const { branches, loading: branchesLoading } = useBranches();
  const { createRequest, deleteRequest, loading: requestLoading } = useMaterialRequests();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [cartItems, setCartItems] = useState<RequestItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('전체');
  const [isNotificationsCollapsed, setIsNotificationsCollapsed] = useState(true);
  const [isTrackerCollapsed, setIsTrackerCollapsed] = useState(true);

  useEffect(() => {
    if (user && branches.length > 0) {
      if (user.role === '본사 관리자' && !selectedBranch) {
        setSelectedBranch(branches[0].name);
      } else if (user.franchise && !selectedBranch) {
        setSelectedBranch(user.franchise);
      }
    }
  }, [user, branches, selectedBranch]);

  useEffect(() => {
    if (selectedBranch) {
      fetchMaterials({ branch: selectedBranch, pageSize: 1000 });
    }
  }, [selectedBranch, fetchMaterials]);

  const availableMaterials = useMemo(() => {
    return materials.filter(m => m.branch === selectedBranch);
  }, [materials, selectedBranch]);

  const categories = useMemo(() => {
    const cats = new Set(availableMaterials.map(m => m.mainCategory || '기타'));
    return ['전체', ...Array.from(cats)];
  }, [availableMaterials]);

  const filteredMaterials = useMemo(() => {
    return availableMaterials.filter(m => {
      const matchCat = activeCategory === '전체' || (m.mainCategory || '기타') === activeCategory;
      const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [availableMaterials, activeCategory, searchTerm]);

  // 장바구니 수량 가져오기
  const getCartQuantity = (material: Material) => {
    const key = `${material.id}-${material.branch}`;
    return cartItems.find(item => item.materialId === key)?.requestedQuantity || 0;
  };

  const handleUpdateCartQuantity = (material: Material, change: number) => {
    const materialKey = `${material.id}-${material.branch}`;
    const existingIndex = cartItems.findIndex(item => item.materialId === materialKey);

    if (existingIndex >= 0) {
      const currentQty = cartItems[existingIndex].requestedQuantity;
      const newQty = currentQty + change;

      if (newQty <= 0) {
        setCartItems(cartItems.filter(item => item.materialId !== materialKey));
      } else {
        const newItems = [...cartItems];
        newItems[existingIndex].requestedQuantity = newQty;
        setCartItems(newItems);
      }
    } else if (change > 0) {
      const newItem: RequestItem = {
        materialId: materialKey,
        materialName: material.name,
        requestedQuantity: change,
        estimatedPrice: material.price,
        urgency: 'normal',
        memo: ''
      };
      setCartItems([...cartItems, newItem]);
    }
  };

  const handleRemoveFromCart = (materialId: string) => {
    setCartItems(cartItems.filter(item => item.materialId !== materialId));
  };

  const handleUpdateItem = (materialId: string, updates: Partial<RequestItem>) => {
    setCartItems(cartItems.map(item =>
      item.materialId === materialId ? { ...item, ...updates } : item
    ));
  };

  const handleUpdateQuantityDirect = (materialId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(materialId);
      return;
    }
    setCartItems(cartItems.map(item =>
      item.materialId === materialId ? { ...item, requestedQuantity: newQuantity } : item
    ));
  };

  const handleSubmitRequest = async () => {
    if (cartItems.length === 0) return;
    if (!user?.email) return;

    const targetBranch = branches.find(b => b.name === selectedBranch);
    if (!targetBranch) return;

    try {
      const requestData = {
        branchId: targetBranch.id,
        branchName: targetBranch.name,
        requesterId: user.id,
        requesterName: user.email,
        requestedItems: cartItems
      };
      const requestNumber = await createRequest(requestData);
      toast({ title: '요청 완료', description: `요청번호: ${requestNumber}` });
      setCartItems([]);
      setShowCart(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      toast({ variant: 'destructive', title: '요청 실패', description: '오류가 발생했습니다.' });
    }
  };

  const handleEditRequest = async (request: any) => {
    try {
      // 1. 장바구니에 아이템 담기
      setCartItems(request.requestedItems);
      // 2. 카트 열기
      setShowCart(true);
      // 3. 기존 요청 삭제하기
      await deleteRequest(request.id);
      setRefreshTrigger(prev => prev + 1);
      toast({ title: '수정 모드 전환', description: '기존 요청이 취소되었고 카트로 불러왔습니다.' });
    } catch (e) {
      toast({ variant: 'destructive', title: '오류', description: '요청을 불러오는 중 오류가 발생했습니다.' });
    }
  };

  const totalEstimatedCost = useMemo(() => {
    return cartItems.reduce((total, item) => total + (item.requestedQuantity * item.estimatedPrice), 0);
  }, [cartItems]);

  const isLoading = materialsLoading || branchesLoading;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">카탈로그를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:p-6 lg:flex-row overflow-hidden">
      {/* 왼쪽 메인 패널 (카탈로그 영역) */}
      <div className="flex-1 overflow-hidden flex flex-col gap-4">
        {/* 헤더 및 컨트롤 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">자재 요청 (카탈로그)</h1>
            <p className="text-sm text-muted-foreground mt-1">
              본사에서 공통자재를 쉽고 빠르게 신청하세요. 카트에 담고 한 번에 주문할 수 있습니다.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {user?.role === '본사 관리자' && branches.length > 0 && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="지점 선택" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Badge variant="secondary" className="h-9 px-3 rounded-md text-sm font-medium">
              {selectedBranch || '지점 미선택'}
            </Badge>

            {/* 모바일 장바구니 토글 버튼 */}
            <Button
              className="lg:hidden h-9"
              variant={cartItems.length > 0 ? "default" : "outline"}
              onClick={() => setShowCart(!showCart)}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              {cartItems.length}
            </Button>
          </div>
        </div>

        {/* 배송 알림 (접기/펼치기) */}
        <div className="shrink-0">
          <button
            onClick={() => setIsNotificationsCollapsed(!isNotificationsCollapsed)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 rounded-lg border text-sm font-medium text-muted-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              🔔 배송 알림
            </span>
            {isNotificationsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {!isNotificationsCollapsed && (
            <div className="mt-2">
              <DeliveryNotifications key={`delivery-${selectedBranch}`} selectedBranch={selectedBranch} />
            </div>
          )}
        </div>

        {/* 카탈로그 컨텐츠 영역 */}
        <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-muted">
          <CardHeader className="py-4 border-b bg-muted/20">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full sm:w-auto">
                <TabsList className="w-full sm:w-auto overflow-x-auto justify-start inline-flex h-9">
                  {categories.map(cat => (
                    <TabsTrigger key={cat} value={cat} className="text-sm min-w-fit px-4">
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="자재명 검색..."
                  className="pl-8 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 lg:p-6 bg-secondary/5">
            {filteredMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-20" />
                <p>해당 조건의 자재가 존재하지 않습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 auto-rows-max">
                {filteredMaterials.map(material => {
                  const qtyInCart = getCartQuantity(material);
                  return (
                    <div
                      key={material.id}
                      className={cn(
                        "group relative flex flex-col bg-card rounded-lg border shadow-sm transition-all hover:shadow-md hover:border-primary/30",
                        qtyInCart > 0 && "ring-1 ring-primary border-primary"
                      )}
                    >
                      <div className="px-2.5 py-1.5 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">
                            {material.midCategory || material.mainCategory || '기타'}
                          </Badge>
                          {material.stock > 0 && (
                            <span className="text-[9px] text-muted-foreground">재고:{material.stock}</span>
                          )}
                        </div>
                        <h3 className="font-semibold text-xs leading-tight line-clamp-1">
                          {material.name}
                        </h3>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">
                          {material.size}{material.color ? ` / ${material.color}` : ''}
                        </p>
                        <p className="font-bold text-primary text-xs mt-0.5">
                          {material.price > 0 ? `${material.price.toLocaleString()}원` : '시세변동'}
                        </p>
                      </div>
                      <div className="px-2 py-1.5 bg-muted/30 border-t mt-auto rounded-b-lg">
                        {qtyInCart > 0 ? (
                          <div className="flex items-center justify-between w-full h-6 bg-background border rounded">
                            <button
                              onClick={() => handleUpdateCartQuantity(material, -1)}
                              className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-l transition-colors"
                            >
                              <Minus className="h-2.5 w-2.5" />
                            </button>
                            <span className="text-xs font-semibold select-none w-6 text-center">{qtyInCart}</span>
                            <button
                              onClick={() => handleUpdateCartQuantity(material, 1)}
                              className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-r transition-colors"
                            >
                              <Plus className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full h-6 text-[10px] font-semibold"
                            onClick={() => handleUpdateCartQuantity(material, 1)}
                          >
                            <Plus className="h-2.5 w-2.5 mr-0.5" />
                            담기
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 요청 현황 트래커 (하단, 접기/펼치기) */}
        <div className="shrink-0">
          <button
            onClick={() => setIsTrackerCollapsed(!isTrackerCollapsed)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 rounded-lg border text-sm font-medium text-muted-foreground transition-colors"
          >
            <span className="flex items-center gap-2">
              📋 요청 현황
            </span>
            {isTrackerCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {!isTrackerCollapsed && (
            <div className="mt-2">
              <RequestStatusTracker
                key={`tracker-${selectedBranch}-${refreshTrigger}`}
                selectedBranch={selectedBranch}
                onEditRequest={handleEditRequest}
              />
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽 장바구니 패널 (사이드바) */}
      <div
        className={cn(
          "w-full lg:w-[380px] shrink-0 transition-all duration-300 ease-in-out z-10",
          !showCart && cartItems.length === 0 ? "hidden lg:block lg:opacity-50" : "block shadow-xl lg:shadow-none"
        )}
      >
        <div className="h-full overflow-y-auto rounded-xl border bg-card shadow-sm hide-scrollbar pb-6 relative">
          <MaterialRequestCart
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantityDirect}
            onUpdateItem={handleUpdateItem}
            onRemoveItem={handleRemoveFromCart}
            onSubmitRequest={handleSubmitRequest}
            totalEstimatedCost={totalEstimatedCost}
            loading={requestLoading}
          />
        </div>
      </div>
    </div>
  );
}
