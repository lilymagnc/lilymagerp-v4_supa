
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Printer, Search, Download, FileUp, ScanLine, Layers, Package, AlertTriangle, XCircle } from "lucide-react";
import { MaterialTable } from "./components/material-table";
import { MaterialForm, MaterialFormValues } from "./components/material-form";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { MultiPrintOptionsDialog } from "@/components/multi-print-options-dialog";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches } from "@/hooks/use-branches";
import { useMaterials } from "@/hooks/use-materials";
import { useCategories } from "@/hooks/use-categories";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadXLSX } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { ImportButton } from "@/components/import-button";

export default function MaterialsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isMultiPrintDialogOpen, setIsMultiPrintDialogOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedMainCategory, setSelectedMainCategory] = useState("all");
  const [selectedMidCategory, setSelectedMidCategory] = useState("all");

  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const { branches } = useBranches();
  const {
    materials,
    loading: materialsLoading,
    hasMore,
    stats,
    loadMore,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    bulkAddMaterials,
    fetchMaterials,
    updateMaterialIds,
    rebuildCategories
  } = useMaterials();
  const { getMainCategories, getMidCategories, fetchCategories } = useCategories();

  const isHeadOfficeAdmin = user?.role === '본사 관리자';
  const isAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise;

  // 필터가 변경될 때마다 데이터를 다시 가져옴
  useEffect(() => {
    // 지점 직원의 경우 초기 branch 설정을 반영하기 위해
    let branchToFetch = selectedBranch;
    if (!isAdmin && userBranch && selectedBranch === "all") {
      branchToFetch = userBranch;
    }

    fetchMaterials({
      branch: branchToFetch,
      mainCategory: selectedMainCategory,
      midCategory: selectedMidCategory,
    });
  }, [fetchMaterials, selectedBranch, selectedMainCategory, selectedMidCategory, isAdmin, userBranch]);

  // 사용자가 볼 수 있는 지점 목록
  const availableBranches = useMemo(() => {
    if (isAdmin) {
      return branches; // 본사 관리자는 모든 지점을 볼 수 있음
    } else {
      return branches.filter(branch => branch.name === userBranch); // 지점 직원은 자신의 지점만
    }
  }, [branches, isAdmin, userBranch]);

  // 자동 지점 필터링 (지점 직원은 자동으로 자신의 지점으로 설정)
  useEffect(() => {
    if (!isAdmin && userBranch && selectedBranch === "all") {
      setSelectedBranch(userBranch);
    }
  }, [isAdmin, userBranch, selectedBranch]);

  const mainCategories = useMemo(() => {
    return getMainCategories();
  }, [getMainCategories]);

  const midCategories = useMemo(() => {
    return getMidCategories(selectedMainCategory === "all" ? undefined : selectedMainCategory);
  }, [getMidCategories, selectedMainCategory]);

  const filteredMaterials = useMemo(() => {
    // 이미 fetchMaterials에서 필터링이 완료된 상태이므로 검색어 필터링만 수행
    if (!searchTerm) return materials;
    return materials.filter(material =>
      (material.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (material.id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [materials, searchTerm]);

  const handleAdd = () => {
    setSelectedMaterial(null);
    setIsFormOpen(true);
  };

  const handleEdit = (material: any) => {
    setSelectedMaterial(material);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: MaterialFormValues) => {
    if (selectedMaterial) {
      await updateMaterial(selectedMaterial.docId, selectedMaterial.id, data);
    } else {
      await addMaterial(data);
    }
    setIsFormOpen(false);
    setSelectedMaterial(null);
  };

  const handleDelete = async (docId: string) => {
    await deleteMaterial(docId);
  };

  const handleDownloadCurrentList = () => {
    if (filteredMaterials.length === 0) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '다운로드할 데이터가 없습니다.',
      });
      return;
    }
    downloadXLSX(filteredMaterials, `자재목록_${new Date().toLocaleDateString()}`);
  };

  const handleImport = async (data: any[]) => {
    await bulkAddMaterials(data, selectedBranch === 'all' ? '' : selectedBranch);
  };

  const handleMultiPrintSubmit = (items: { id: string; quantity: number }[], startPosition: number) => {
    const itemsQuery = items.map(item => `${item.id}:${item.quantity}`).join(',');
    const params = new URLSearchParams({
      items: itemsQuery,
      type: 'material',
      start: String(startPosition),
    });
    router.push(`/dashboard/print-labels?${params.toString()}`);
    setIsMultiPrintDialogOpen(false);
  };

  const handleRefresh = async () => {
    await fetchMaterials();
  };

  const handleRebuildCategories = async () => {
    await rebuildCategories();
    await fetchCategories();
  };

  const currentFilters = useMemo(() => ({
    branch: selectedBranch,
    mainCategory: selectedMainCategory,
    midCategory: selectedMidCategory,
    pageSize: 50
  }), [selectedBranch, selectedMainCategory, selectedMidCategory]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="자재 관리"
        description={!isAdmin ? `${userBranch} 지점의 자재 정보를 관리합니다.` : "자재 정보를 관리하고 재고를 추적하세요."}
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/barcode-scanner')}
          >
            <ScanLine className="mr-2 h-4 w-4" />
            바코드 스캔
          </Button>
          {isHeadOfficeAdmin && (
            <>
              <Button onClick={handleAdd}>
                <PlusCircle className="mr-2 h-4 w-4" />
                자재 추가
              </Button>
              <Button
                variant="outline"
                onClick={updateMaterialIds}
                disabled={materialsLoading}
              >
                ID 업데이트
              </Button>
              <Button
                variant="outline"
                onClick={handleRebuildCategories}
                disabled={materialsLoading}
              >
                <Layers className="mr-2 h-4 w-4" />
                카테고리 동기화
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* 요약 통계 카드 섹션 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-t-4 border-t-primary shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 자재 종류</CardTitle>
            <Layers className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTypes}종</div>
            <p className="text-xs text-muted-foreground mt-1">현재 필터링된 자재 가짓수</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">재고 총 수량</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStock.toLocaleString()}개</div>
            <p className="text-xs text-muted-foreground mt-1">모든 자재의 합산 재고</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-yellow-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">재고 부족</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}건</div>
            <p className="text-xs text-muted-foreground mt-1">재고 10개 미만 품목</p>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-red-500 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">품절 항목</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.outOfStock}건</div>
            <p className="text-xs text-muted-foreground mt-1">현재 재고가 없는 품목</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>검색 및 필터</CardTitle>
          <CardDescription>
            자재 이름이나 ID로 검색하고 카테고리별로 필터링할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="자재 이름 또는 ID 검색..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="지점 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 지점</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedMainCategory} onValueChange={setSelectedMainCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="대분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 대분류</SelectItem>
                {mainCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMidCategory} onValueChange={setSelectedMidCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="중분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 중분류</SelectItem>
                {midCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCurrentList}
              disabled={filteredMaterials.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              현재 목록 다운로드
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMultiPrintDialogOpen(true)}
              disabled={selectedMaterials.length === 0}
            >
              <Printer className="mr-2 h-4 w-4" />
              선택 항목 라벨 출력
            </Button>

            {isHeadOfficeAdmin && (
              <ImportButton
                onImport={handleImport}
                templateData={[
                  {
                    id: "MAT001",
                    name: "예시 자재",
                    mainCategory: "대분류",
                    midCategory: "중분류",
                    price: 10000,
                    supplier: "공급업체",
                    size: "크기",
                    color: "색상",
                    stock: 100
                  }
                ]}
                fileName="materials_template"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <MaterialTable
          materials={filteredMaterials}
          onSelectionChange={setSelectedMaterials}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefresh={handleRefresh}
        />

        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => loadMore(currentFilters)}
              disabled={materialsLoading}
              className="w-full max-w-xs shadow-sm hover:bg-accent"
            >
              {materialsLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  로딩 중...
                </div>
              ) : "자재 더 보기"}
            </Button>
          </div>
        )}
      </div>

      <MaterialForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleFormSubmit}
        material={selectedMaterial}
        branches={availableBranches}
        selectedBranch={!isAdmin ? userBranch : selectedBranch}
      />

      <MultiPrintOptionsDialog
        isOpen={isMultiPrintDialogOpen}
        onOpenChange={setIsMultiPrintDialogOpen}
        onSubmit={handleMultiPrintSubmit}
        itemIds={selectedMaterials}
        itemType="material"
      />
    </div>
  );
}
