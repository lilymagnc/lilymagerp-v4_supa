"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts } from "@/hooks/use-products";
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { Product } from "@/hooks/use-products";
import { Branch } from "@/hooks/use-branches";
import { PageHeader } from "@/components/page-header";
import { ImportButton } from "@/components/import-button";
import { ProductForm } from "./components/product-form";
import { ProductTable } from "./components/product-table";
import { ProductStatsCards } from "./components/product-stats-cards";
import { MultiPrintOptionsDialog } from "@/components/multi-print-options-dialog";
import { ScanLine, Plus, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { exportProductsToExcel } from "@/lib/excel-export";
import { useCategories } from "@/hooks/use-categories"; // 카테고리 훅 추가

export default function ProductsPage() {
  const router = useRouter();
  const {
    products,
    loading,
    hasMore,
    stats,
    loadMore,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkAddProducts,
    fetchProducts,
  } = useProducts();
  const { branches } = useBranches();
  const { user } = useAuth();
  const { getMainCategories } = useCategories(); // 카테고리 목록 가져오기

  const isAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise || "";

  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isMultiPrintDialogOpen, setIsMultiPrintDialogOpen] = useState(false);

  // 사용자가 볼 수 있는 지점 목록
  const availableBranches = useMemo(() => {
    if (isAdmin) {
      return branches; // 본사 관리자는 모든 지점을 볼 수 있음
    } else {
      return branches.filter(branch => branch.name === userBranch); // 지점 직원은 자신의 지점만
    }
  }, [branches, isAdmin, userBranch]);

  // 대분류 카테고리 목록
  const categories = useMemo(() => {
    return getMainCategories();
  }, [getMainCategories]);

  // 자동 지점 필터링 (지점 직원은 자동으로 자신의 지점으로 설정)
  useEffect(() => {
    if (!isAdmin && userBranch && selectedBranch === "all") {
      setSelectedBranch(userBranch);
    }
  }, [isAdmin, userBranch, selectedBranch]);

  // 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    let branchToFetch = selectedBranch;
    if (!isAdmin && userBranch && selectedBranch === "all") {
      branchToFetch = userBranch;
    }

    // 초기 로딩 또는 필터 변경 시 fetch
    fetchProducts({
      branch: branchToFetch,
      mainCategory: selectedCategory
    });
  }, [fetchProducts, selectedBranch, selectedCategory, isAdmin, userBranch]);


  const filteredProducts = useMemo(() => {
    // 서버에서 이미 필터링된 데이터를 가져오므로, 여기서는 검색어 필터링만 수행 (현재 로딩된 데이터 내에서)
    if (!searchTerm) return products;

    return products.filter(product => {
      const matchesSearch = (product.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (product.code?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [products, searchTerm]);

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.docId, data);
      } else {
        await addProduct(data);
      }
      setIsFormOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const currentFilters = useMemo(() => ({
    branch: selectedBranch,
    mainCategory: selectedCategory,
    pageSize: 50
  }), [selectedBranch, selectedCategory]);

  const handleMultiPrintSubmit = (items: { id: string; quantity: number }[], startPosition: number) => {
    const itemsQuery = items.map(item => `${item.id}:${item.quantity}`).join(',');
    const params = new URLSearchParams({
      items: itemsQuery,
      type: 'product',
      start: String(startPosition),
    });
    router.push(`/dashboard/print-labels?${params.toString()}`);
    setIsMultiPrintDialogOpen(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleRefresh = async () => {
    await fetchProducts({
      branch: selectedBranch,
      mainCategory: selectedCategory
    });
  };

  const handleExportToExcel = async () => {
    try {
      const branchText = !isAdmin ? userBranch : (selectedBranch === "all" ? "전체지점" : selectedBranch);
      const filename = `상품목록_${branchText}`;
      await exportProductsToExcel(filteredProducts, filename);
    } catch (error) {
      console.error('엑셀 내보내기 오류:', error);
      alert('엑셀 파일 생성에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="상품 관리"
        description={!isAdmin ? `${userBranch} 지점의 상품 정보를 관리합니다.` : "상품 정보를 관리합니다."}
      >
        <div className="flex gap-2">
          {/* 바코드 스캔 버튼을 헤더의 actions 영역으로 이동 (기존: PageHeader 내부 children에서 외부로 분리 필요? 아니면 PageHeader가 children을 actions로 렌더링하나?) 
            PageHeader 정의를 보면 children이 action area에 렌더링됨.
          */}
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/barcode-scanner')}
          >
            <ScanLine className="mr-2 h-4 w-4" />
            바코드 스캔
          </Button>
          {isAdmin && (
            <>
              <Button onClick={() => setIsFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                상품 추가
              </Button>
              <ImportButton
                onImport={(data) => bulkAddProducts(data, selectedBranch)}
                fileName="products_template.xlsx"
                resourceName="상품"
              />
              <Button
                variant="outline"
                onClick={handleExportToExcel}
                disabled={filteredProducts.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                엑셀 내보내기
              </Button>
              {selectedProducts.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setIsMultiPrintDialogOpen(true)}
                >
                  선택 상품 라벨 출력 ({selectedProducts.length}개)
                </Button>
              )}
            </>
          )}
        </div>
      </PageHeader>

      {/* 상품 통계 카드 (서버 데이터 사용) */}
      <ProductStatsCards
        stats={stats}
        products={filteredProducts}
        selectedBranch={selectedBranch}
        isAdmin={isAdmin}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="상품명 또는 코드로 검색 (현재 목록 내)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        {isAdmin && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-48 text-foreground bg-background border border-input">
              <SelectValue placeholder="지점 선택" className="text-foreground" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              <SelectItem value="all" className="text-popover-foreground">모든 지점</SelectItem>
              {availableBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.name} className="text-popover-foreground">
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="카테고리 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ProductTable
        products={filteredProducts}
        onSelectionChange={setSelectedProducts}
        onEdit={handleEdit}
        onDelete={deleteProduct}
        selectedProducts={selectedProducts}
        isAdmin={isAdmin}
        onRefresh={handleRefresh}
      />

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => loadMore(currentFilters)}
            disabled={loading}
            className="w-full max-w-xs shadow-sm hover:bg-accent"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                로딩 중...
              </div>
            ) : "상품 더 보기"}
          </Button>
        </div>
      )}

      <ProductForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        product={editingProduct}
        branches={availableBranches}
        selectedBranch={!isAdmin ? userBranch : selectedBranch}
      />

      <MultiPrintOptionsDialog
        isOpen={isMultiPrintDialogOpen}
        onOpenChange={setIsMultiPrintDialogOpen}
        onSubmit={handleMultiPrintSubmit}
        itemIds={selectedProducts}
        itemType="product"
      />
    </div>
  );
}
