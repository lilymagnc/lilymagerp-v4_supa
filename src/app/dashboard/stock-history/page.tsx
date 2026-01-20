"use client";
import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Download, ChevronDown } from "lucide-react";
import { HistoryTable } from "./components/history-table";
import { HistoryFilters } from "./components/history-filters";
import { useBranches } from "@/hooks/use-branches";
import { useStockHistory } from "@/hooks/use-stock-history";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadXLSX } from "@/lib/utils";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

export default function StockHistoryPage() {
  const { branches } = useBranches();
  const { history, loading, deleteHistoryRecord } = useStockHistory();
  const { toast } = useToast();
  const [filters, setFilters] = useState<{
    dateRange: DateRange;
    branch: string;
    type: string;
    itemType: string;
    search: string;
  }>({
    dateRange: { from: new Date(new Date().setMonth(new Date().getMonth() - 1)), to: new Date() },
    branch: "all",
    type: "all",
    itemType: "all",
    search: "",
  });

  const [displayLimit, setDisplayLimit] = useState(50);

  // 필터 변경 시 표시 개수 초기화
  useEffect(() => {
    setDisplayLimit(50);
  }, [filters]);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      if (!item.date) return false;
      const itemDate = new Date(item.date);
      const fromDate = filters.dateRange?.from;
      const toDate = filters.dateRange?.to;
      const inDateRange =
        (!fromDate || itemDate >= fromDate) &&
        (!toDate || itemDate <= toDate);
      const branchMatch = filters.branch === 'all' || item.branch === filters.branch;
      const typeMatch = filters.type === 'all' || item.type === filters.type || (filters.type === "manual_update" && item.type === "manual_update");
      const itemTypeMatch = filters.itemType === 'all' || item.itemType === filters.itemType;
      const searchMatch = item.itemName.toLowerCase().includes(filters.search.toLowerCase());
      return inDateRange && branchMatch && typeMatch && itemTypeMatch && searchMatch;
    });
  }, [filters, history]);

  const displayedHistory = useMemo(() => {
    return filteredHistory.slice(0, displayLimit);
  }, [filteredHistory, displayLimit]);

  const handleExport = () => {
    if (filteredHistory.length === 0) {
      toast({
        variant: "destructive",
        title: "내보낼 데이터 없음",
        description: "목록에 데이터가 없습니다.",
      });
      return;
    }

    // 전체 필터링된 데이터 내보내기 (표시 개수 제한과 무관)
    const dataToExport = filteredHistory.map(item => ({
      '날짜': format(new Date(item.date), 'yyyy-MM-dd HH:mm'),
      '지점': item.branch,
      '품목명': item.itemName,
      '공급업체': item.supplier || '',
      '유형': item.type === 'in' ? '입고' : item.type === 'out' ? '출고' : '수동 수정',
      '수량': item.type === 'in' ? `+${item.quantity}` : item.type === 'out' ? `-${item.quantity}` : `${item.fromStock} -> ${item.toStock}`,
      '단가': item.price || 0,
      '총액': item.totalAmount || 0,
      '처리 후 재고': item.resultingStock,
      '처리자': item.operator,
    }));

    downloadXLSX(dataToExport, "stock_history");
    toast({
      title: "내보내기 성공",
      description: `${dataToExport.length}개의 재고 기록이 XLSX 파일로 다운로드되었습니다.`,
    });
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="재고 변동 기록"
        description="상품 및 자재의 입출고 내역을 추적하고 관리합니다."
      >
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          엑셀 내보내기
        </Button>
      </PageHeader>

      <HistoryFilters
        filters={filters}
        onFiltersChange={setFilters}
        branches={branches}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <HistoryTable history={displayedHistory} onDelete={deleteHistoryRecord} />

          {filteredHistory.length > displayLimit && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setDisplayLimit(prev => prev + 50)}
                className="w-full max-w-xs"
              >
                <ChevronDown className="mr-2 h-4 w-4" />
                더 보기 ({filteredHistory.length - displayLimit}개 남음)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

