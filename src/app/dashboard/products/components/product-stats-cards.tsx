"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingBag, TrendingUp, AlertTriangle, XCircle, Layers } from "lucide-react";

interface ProductStatsCardsProps {
  stats?: {
    total: number;
    lowStock: number;
    outOfStock: number;
    totalStock: number;
  };
  products?: any[]; // Keep for backward compatibility or if needed for other things
  selectedBranch?: string;
  isAdmin?: boolean;
}

export function ProductStatsCards({ stats, selectedBranch, isAdmin }: ProductStatsCardsProps) {
  // If no stats provided (legacy), display skeleton or nothing? 
  // We assume stats are provided now.
  const currentStats = stats || { total: 0, lowStock: 0, outOfStock: 0, totalStock: 0 };

  return (
    <div className="grid gap-4 md:grid-cols-4 mb-6">
      {/* 총 상품 수 */}
      <Card className="border-t-4 border-t-primary shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">전체 상품 수</CardTitle>
          <Layers className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currentStats.total}건</div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedBranch === "all" ? "전체 지점 등록 상품" : `${selectedBranch} 등록 상품`}
          </p>
        </CardContent>
      </Card>

      {/* 재고 총 수량 */}
      <Card className="border-t-4 border-t-blue-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">재고 총 수량</CardTitle>
          <Package className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{currentStats.totalStock.toLocaleString()}개</div>
          <p className="text-xs text-muted-foreground mt-1">모든 상품의 합산 재고</p>
        </CardContent>
      </Card>

      {/* 재고 부족 */}
      <Card className="border-t-4 border-t-yellow-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">재고 부족</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{currentStats.lowStock}건</div>
          <p className="text-xs text-muted-foreground mt-1">재고 10개 미만 상품</p>
        </CardContent>
      </Card>

      {/* 품절 상품 */}
      <Card className="border-t-4 border-t-red-500 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">품절 상품</CardTitle>
          <XCircle className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{currentStats.outOfStock}건</div>
          <p className="text-xs text-muted-foreground mt-1">현재 재고가 없는 상품</p>
        </CardContent>
      </Card>
    </div>
  );
}
