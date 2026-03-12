"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterials } from '@/hooks/use-materials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ShoppingCart, Plus, Minus, Package, Filter, AlertCircle, ChevronDown, ChevronUp, X, Trash2, Send } from 'lucide-react';
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

// 고정 카테고리 체계 (대분류 → 중분류) - DB 카테고리와 통일
const FLOWER_COLORS = ['레드', '핑크', '오렌지', '옐로우', '베이지', '블루', '보라', '흰색', '와인', '피치', '기타'];
const CATEGORY_MAP: Record<string, string[]> = {
  '생화': ['장미류', '카네이션류', '리시안서스류', '국화류', '거베라류', '매스플라워', '폼플라워', '라인플라워', '필러플라워', '소재(그린)', '기타'],
  '조화': ['장미류', '카네이션류', '리시안서스류', '국화류', '거베라류', '매스플라워', '폼플라워', '라인플라워', '필러플라워', '소재(그린)', '트리류'],
  '프리저브드': ['플라워', '잎소재', '열매', '폼플라워', '기타'],
  '식물': ['관엽소형', '관엽중형', '관엽대형', '다육선인장소형', '다육선인장중형', '다육선인장대형', '서양란', '동양란', '기타식물'],
  '바구니 / 화기': ['바구니', '도자기', '테라코타(토분)', '유리', '플라스틱', '테라조', '기타'],
  '소모품 및 부자재': ['원예자재', '데코자재', '제작도구', '포장재', '리본/텍', '기타'],
  '컬러': FLOWER_COLORS,
};
const MAIN_CATEGORIES = Object.keys(CATEGORY_MAP);

export default function MaterialRequestPage() {
  const { user } = useAuth();
  const { materials, loading: materialsLoading, fetchMaterials } = useMaterials();
  const { branches, loading: branchesLoading } = useBranches();
  const { createRequest, deleteRequest, loading: requestLoading } = useMaterialRequests();
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [cartItems, setCartItems] = useState<RequestItem[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMainCategory, setActiveMainCategory] = useState<string>('전체');
  const [activeMidCategory, setActiveMidCategory] = useState<string>('전체');
  const [isNotificationsCollapsed, setIsNotificationsCollapsed] = useState(true);
  const [isTrackerCollapsed, setIsTrackerCollapsed] = useState(true);
  // 모바일 장바구니: 접기/펼치기 (기본 펼침)
  const [isMobileCartExpanded, setIsMobileCartExpanded] = useState(true);
  // 모바일에서 장바구니 상세 편집 모드 (풀스크린)
  const [showFullCart, setShowFullCart] = useState(false);

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

  // 현재 대분류에 해당하는 중분류 목록
  const currentMidCategories = useMemo(() => {
    if (activeMainCategory === '전체') return [];
    return CATEGORY_MAP[activeMainCategory] || [];
  }, [activeMainCategory]);

  const filteredMaterials = useMemo(() => {
    return availableMaterials.filter(m => {
      // 검색 필터링
      const matchSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      // '컬러' 대분류: color 필드로 필터링
      if (activeMainCategory === '컬러') {
        if (activeMidCategory === '전체') return true; // 모든 자재 표시
        return (m.color || '기타') === activeMidCategory;
      }

      // 일반 대분류 필터링
      if (activeMainCategory !== '전체') {
        if ((m.mainCategory || '') !== activeMainCategory) return false;
        // 중분류 필터링
        if (activeMidCategory !== '전체') {
          if ((m.midCategory || '') !== activeMidCategory) return false;
        }
      }

      return true;
    });
  }, [availableMaterials, activeMainCategory, activeMidCategory, searchTerm]);

  // 대분류 변경 시 중분류 초기화
  const handleMainCategoryChange = (cat: string) => {
    setActiveMainCategory(cat);
    setActiveMidCategory('전체');
  };

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
        const newItems = cartItems.map((item, idx) => 
          idx === existingIndex 
            ? { ...item, requestedQuantity: newQty, updatedAt: Date.now() } 
            : item
        );
        setCartItems(newItems);
      }
    } else if (change > 0) {
      const newItem: RequestItem & { updatedAt?: number } = {
        materialId: materialKey,
        materialName: material.name,
        requestedQuantity: change,
        estimatedPrice: material.price,
        urgency: 'normal',
        memo: '',
        updatedAt: Date.now()
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
      item.materialId === materialId ? { ...item, requestedQuantity: newQuantity, updatedAt: Date.now() } : item
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
      setShowFullCart(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      toast({ variant: 'destructive', title: '요청 실패', description: '오류가 발생했습니다.' });
    }
  };

  const handleEditRequest = async (request: any) => {
    try {
      setCartItems(request.requestedItems);
      setIsMobileCartExpanded(true);
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

  const totalQuantity = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.requestedQuantity, 0);
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
    <>
      {/* ===== 데스크톱 레이아웃 (lg 이상): 좌우 분할 ===== */}
      <div className="hidden lg:flex h-[calc(100vh-4rem)] flex-row gap-6 p-6 overflow-hidden">
        {/* 왼쪽 메인 패널 */}
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between shrink-0">
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
            </div>
          </div>

          {/* 배송 알림 */}
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

          {/* 카탈로그 */}
          <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-muted">
            <CardHeader className="py-3 border-b bg-muted/20 space-y-2">
              <div className="flex flex-row justify-between gap-4">
                {/* 대분류 탭 */}
                <Tabs value={activeMainCategory} onValueChange={handleMainCategoryChange} className="w-auto">
                  <TabsList className="overflow-x-auto justify-start inline-flex h-9">
                    <TabsTrigger value="전체" className="text-sm min-w-fit px-4">전체</TabsTrigger>
                    {MAIN_CATEGORIES.map(cat => (
                      <TabsTrigger key={cat} value={cat} className="text-sm min-w-fit px-4">{cat}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="relative w-64 shrink-0">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="자재명 검색..." className="pl-8 h-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              {/* 중분류 탭 (대분류 선택 시 표시) */}
              {currentMidCategories.length > 0 && (
                <Tabs value={activeMidCategory} onValueChange={setActiveMidCategory}>
                  <TabsList className="overflow-x-auto justify-start inline-flex h-8 bg-muted/50">
                    <TabsTrigger value="전체" className="text-xs min-w-fit px-3 h-7">전체</TabsTrigger>
                    {currentMidCategories.map(mid => (
                      <TabsTrigger key={mid} value={mid} className="text-xs min-w-fit px-3 h-7">{mid}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6 bg-secondary/5">
              {filteredMaterials.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Package className="h-12 w-12 mb-4 opacity-20" />
                  <p>해당 조건의 자재가 존재하지 않습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 auto-rows-max">
                  {filteredMaterials.map(material => {
                    const qtyInCart = getCartQuantity(material);
                    return (
                      <div key={material.id} className={cn("group relative flex flex-col bg-card rounded-lg border shadow-sm transition-all hover:shadow-md hover:border-primary/30", qtyInCart > 0 && "ring-1 ring-primary border-primary")}>
                        <div className="px-2.5 py-1.5 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-muted-foreground">{material.midCategory || material.mainCategory || '기타'}</Badge>
                            {material.stock > 0 && <span className="text-[9px] text-muted-foreground">재고:{material.stock}</span>}
                          </div>
                          <h3 className="font-semibold text-xs leading-tight line-clamp-3">{material.name}</h3>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{material.size}{material.color ? ` / ${material.color}` : ''}</p>
                          <p className="font-bold text-primary text-xs mt-0.5">{material.price > 0 ? `${material.price.toLocaleString()}원` : '시세변동'}</p>
                        </div>
                        <div className="px-2 py-1.5 bg-muted/30 border-t mt-auto rounded-b-lg">
                          {qtyInCart > 0 ? (
                            <div className="flex items-center justify-between w-full h-6 bg-background border rounded">
                              <button onClick={() => handleUpdateCartQuantity(material, -1)} className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-l transition-colors"><Minus className="h-2.5 w-2.5" /></button>
                              <span className="text-xs font-semibold select-none w-6 text-center">{qtyInCart}</span>
                              <button onClick={() => handleUpdateCartQuantity(material, 1)} className="h-full px-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-r transition-colors"><Plus className="h-2.5 w-2.5" /></button>
                            </div>
                          ) : (
                            <Button variant="secondary" size="sm" className="w-full h-6 text-[10px] font-semibold" onClick={() => handleUpdateCartQuantity(material, 1)}>
                              <Plus className="h-2.5 w-2.5 mr-0.5" /> 담기
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

          {/* 요청 현황 */}
          <div className="shrink-0">
            <button onClick={() => setIsTrackerCollapsed(!isTrackerCollapsed)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 rounded-lg border text-sm font-medium text-muted-foreground transition-colors">
              <span className="flex items-center gap-2">📋 요청 현황</span>
              {isTrackerCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
            {!isTrackerCollapsed && (
              <div className="mt-2">
                <RequestStatusTracker key={`tracker-${selectedBranch}-${refreshTrigger}`} selectedBranch={selectedBranch} onEditRequest={handleEditRequest} />
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 장바구니 패널 */}
        <div className={cn("w-[380px] shrink-0", cartItems.length === 0 && "opacity-50")}>
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

      {/* ===== 모바일/태블릿 레이아웃 (lg 미만): 상하 분할 ===== */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {/* 상단: 카탈로그 영역 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {/* 헤더 */}
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-base sm:text-lg font-bold shrink-0">자재 요청</h1>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {user?.role === '본사 관리자' && branches.length > 0 && (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[100px] sm:w-[130px] h-8 text-xs sm:text-sm">
                    <SelectValue placeholder="지점" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Badge variant="secondary" className="h-8 px-2 rounded-md text-xs font-medium">
                {selectedBranch || '미선택'}
              </Badge>
            </div>
          </div>

          {/* 배송 알림 (축약) */}
          <button
            onClick={() => setIsNotificationsCollapsed(!isNotificationsCollapsed)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 rounded-lg border text-xs font-medium text-muted-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">🔔 배송 알림</span>
            {isNotificationsCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          {!isNotificationsCollapsed && (
            <DeliveryNotifications key={`delivery-m-${selectedBranch}`} selectedBranch={selectedBranch} />
          )}

          {/* 카탈로그 */}
          <div>
            {/* 카테고리 탭 + 검색 */}
            <div className="space-y-1.5 mb-2">
              {/* 대분류 */}
              <Tabs value={activeMainCategory} onValueChange={handleMainCategoryChange}>
                <TabsList className="w-full overflow-x-auto justify-start inline-flex h-8 no-scrollbar">
                  <TabsTrigger value="전체" className="text-xs min-w-fit px-2.5 h-7">전체</TabsTrigger>
                  {MAIN_CATEGORIES.map(cat => (
                    <TabsTrigger key={cat} value={cat} className="text-xs min-w-fit px-2.5 h-7">{cat}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {/* 중분류 (대분류 선택 시 표시) */}
              {currentMidCategories.length > 0 && (
                <Tabs value={activeMidCategory} onValueChange={setActiveMidCategory}>
                  <TabsList className="w-full overflow-x-auto justify-start inline-flex h-7 no-scrollbar bg-muted/50">
                    <TabsTrigger value="전체" className="text-[10px] min-w-fit px-2 h-6">전체</TabsTrigger>
                    {currentMidCategories.map(mid => (
                      <TabsTrigger key={mid} value={mid} className="text-[10px] min-w-fit px-2 h-6">{mid}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="자재명 검색..." className="pl-8 h-8 text-xs" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>

            {/* 자재 그리드 */}
            {filteredMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm">자재가 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2">
                {filteredMaterials.map(material => {
                  const qtyInCart = getCartQuantity(material);
                  return (
                    <div key={material.id} className={cn("flex flex-col bg-card rounded-lg border shadow-sm transition-all", qtyInCart > 0 && "ring-1 ring-primary border-primary")}>
                      <div className="px-2 py-1.5 flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Badge variant="outline" className="text-[8px] px-0.5 py-0 h-3.5 text-muted-foreground truncate max-w-[70px]">
                            {material.midCategory || material.mainCategory || '기타'}
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-[11px] leading-tight line-clamp-3">{material.name}</h3>
                        <p className="font-bold text-primary text-[11px] mt-0.5">
                          {material.price > 0 ? `${material.price.toLocaleString()}원` : '시세변동'}
                        </p>
                      </div>
                      <div className="px-1.5 py-1 bg-muted/30 border-t mt-auto rounded-b-lg">
                        {qtyInCart > 0 ? (
                          <div className="flex items-center justify-between w-full h-7 bg-background border rounded">
                            <button onClick={() => handleUpdateCartQuantity(material, -1)} className="h-full px-2 text-muted-foreground hover:bg-muted rounded-l"><Minus className="h-2.5 w-2.5" /></button>
                            <span className="text-xs font-bold select-none">{qtyInCart}</span>
                            <button onClick={() => handleUpdateCartQuantity(material, 1)} className="h-full px-2 text-muted-foreground hover:bg-muted rounded-r"><Plus className="h-2.5 w-2.5" /></button>
                          </div>
                        ) : (
                          <Button variant="secondary" size="sm" className="w-full h-7 text-[10px] font-semibold" onClick={() => handleUpdateCartQuantity(material, 1)}>
                            <Plus className="h-2.5 w-2.5 mr-0.5" /> 담기
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 요청 현황 */}
          <button
            onClick={() => setIsTrackerCollapsed(!isTrackerCollapsed)}
            className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 rounded-lg border text-xs font-medium text-muted-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">📋 요청 현황</span>
            {isTrackerCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          {!isTrackerCollapsed && (
            <RequestStatusTracker key={`tracker-m-${selectedBranch}-${refreshTrigger}`} selectedBranch={selectedBranch} onEditRequest={handleEditRequest} />
          )}

          {/* 하단 장바구니 영역에 가려지는 부분 보충 패딩 */}
          {cartItems.length > 0 && <div className={isMobileCartExpanded ? "h-[220px]" : "h-[52px]"} />}
        </div>

        {/* ===== 하단 고정 장바구니 패널 ===== */}
        {cartItems.length > 0 && (
          <div className="shrink-0 border-t bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-30">
            {/* 장바구니 헤더 (항상 보임 - 탭하여 접기/펼치기) */}
            <button
              onClick={() => setIsMobileCartExpanded(!isMobileCartExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 active:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">
                  장바구니
                </span>
                <Badge variant="default" className="text-[10px] h-5 px-1.5">
                  {cartItems.length}종 {totalQuantity}개
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary">
                  {totalEstimatedCost.toLocaleString()}원
                </span>
                {isMobileCartExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {/* 장바구니 아이템 리스트 (펼쳤을 때) */}
            {isMobileCartExpanded && (
              <div className="border-t">
                {/* 아이템 리스트 (최대 높이 제한, 스크롤 가능) */}
                <div className="max-h-[160px] overflow-y-auto px-3 py-2 space-y-1.5">
                  {cartItems.map((item) => (
                    <div key={item.materialId} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-2.5 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium line-clamp-2 leading-tight">{item.materialName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.estimatedPrice.toLocaleString()}원 × {item.requestedQuantity}
                          = <span className="font-semibold text-foreground">{(item.estimatedPrice * item.requestedQuantity).toLocaleString()}원</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="flex items-center h-6 bg-background border rounded">
                          <button onClick={() => handleUpdateQuantityDirect(item.materialId, item.requestedQuantity - 1)} className="h-full px-1.5 text-muted-foreground hover:bg-muted rounded-l">
                            <Minus className="h-2.5 w-2.5" />
                          </button>
                          <span className="text-xs font-bold px-1.5 min-w-[20px] text-center">{item.requestedQuantity}</span>
                          <button onClick={() => handleUpdateQuantityDirect(item.materialId, item.requestedQuantity + 1)} className="h-full px-1.5 text-muted-foreground hover:bg-muted rounded-r">
                            <Plus className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <button onClick={() => handleRemoveFromCart(item.materialId)} className="p-1 text-red-400 hover:text-red-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 하단 액션 버튼 */}
                <div className="px-3 py-2 border-t flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => setShowFullCart(true)}
                  >
                    상세편집
                  </Button>
                  <Button
                    className="flex-1 h-9 text-sm font-bold"
                    onClick={handleSubmitRequest}
                    disabled={requestLoading || cartItems.length === 0}
                  >
                    {requestLoading ? '처리중...' : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        요청하기 ({totalEstimatedCost.toLocaleString()}원)
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 모바일 풀스크린 장바구니 편집 (상세편집 버튼 클릭 시) */}
      {showFullCart && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
            <h2 className="text-base font-bold flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              장바구니 상세
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setShowFullCart(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MaterialRequestCart
              items={cartItems}
              onUpdateQuantity={handleUpdateQuantityDirect}
              onUpdateItem={handleUpdateItem}
              onRemoveItem={handleRemoveFromCart}
              onSubmitRequest={() => {
                handleSubmitRequest();
                setShowFullCart(false);
              }}
              totalEstimatedCost={totalEstimatedCost}
              loading={requestLoading}
            />
          </div>
        </div>
      )}
    </>
  );
}
