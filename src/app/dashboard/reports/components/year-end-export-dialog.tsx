"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export function YearEndExportDialog() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [includeSales, setIncludeSales] = useState(true);
    const [includeExpenses, setIncludeExpenses] = useState(true);
    const { toast } = useToast();

    const handleExport = async () => {
        if (!includeSales && !includeExpenses) {
            toast({
                variant: "destructive",
                title: "오류",
                description: "최소한 하나의 데이터 항목을 선택해주세요.",
            });
            return;
        }

        try {
            setLoading(true);
            const workbook = XLSX.utils.book_new();
            const year = parseInt(selectedYear);
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year, 11, 31, 23, 59, 59);

            // 1. 매출 데이터 가져오기 (Orders)
            if (includeSales) {
                toast({ title: "데이터 준비 중...", description: "매출 데이터를 불러오고 있습니다." });

                const { data: orders, error: ordersError } = await supabase
                    .from("orders")
                    .select("*")
                    .gte("order_date", startDate.toISOString())
                    .lte("order_date", endDate.toISOString())
                    .order("order_date", { ascending: false });

                if (ordersError) throw ordersError;

                const ordersData = (orders || []).map(doc => {
                    return {
                        "주문번호": doc.id,
                        "주문일자": formatDate(doc.order_date),
                        "지점명": doc.branch_name || "",
                        "고객명": doc.orderer?.name || "",
                        "연락처": doc.orderer?.contact || "",
                        "상품명": doc.product_names || (doc.items?.map((i: any) => i.name).join(", ") || ""),
                        "결제금액": doc.summary?.total || 0,
                        "결제상태": getStatusText(doc.payment?.status || doc.status),
                        "결제수단": getPaymentMethodText(doc.payment?.method)
                    };
                });

                // 1-1. 전체 주문 내역 시트
                const wsOrders = XLSX.utils.json_to_sheet(ordersData);
                XLSX.utils.book_append_sheet(workbook, wsOrders, `${year}년_주문내역`);

                // 1-2. 월별 매출 집계
                const monthlyStats = aggregateMonthlySales(orders || []);
                const wsMonthly = XLSX.utils.json_to_sheet(monthlyStats);
                XLSX.utils.book_append_sheet(workbook, wsMonthly, `${year}년_월별매출`);

                // 1-3. 지점별 매출 집계
                const branchStats = aggregateBranchSales(orders || []);
                const wsBranch = XLSX.utils.json_to_sheet(branchStats);
                XLSX.utils.book_append_sheet(workbook, wsBranch, `${year}년_지점별매출`);
            }

            // 2. 지출 데이터 가져오기 (ExpenseRequests)
            if (includeExpenses) {
                toast({ title: "데이터 준비 중...", description: "지출 데이터를 불러오고 있습니다." });

                const { data: expenses, error: expensesError } = await supabase
                    .from("expense_requests")
                    .select("*")
                    .in("status", ["paid", "approved"])
                    .gte("created_at", startDate.toISOString())
                    .lte("created_at", endDate.toISOString())
                    .order("created_at", { ascending: false });

                if (expensesError) throw expensesError;

                const expensesData = (expenses || []).map(doc => {
                    return {
                        "문서번호": doc.request_number,
                        "신청일자": formatDate(doc.created_at),
                        "지점명": doc.branch_name || "",
                        "신청자": doc.requester_name || "",
                        "제목": doc.title || "",
                        "총금액": doc.total_amount || 0,
                        "상태": getStatusText(doc.status),
                        "지출항목": doc.items?.map((i: any) => `${i.description}(${i.amount})`).join(", ") || ""
                    };
                });

                const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
                XLSX.utils.book_append_sheet(workbook, wsExpenses, `${year}년_지출내역`);
            }

            // 파일 다운로드
            const fileName = `LilyMag_연말결산자료_${year}년_${format(new Date(), "yyyyMMdd")}.xlsx`;
            XLSX.writeFile(workbook, fileName);

            toast({
                title: "다운로드 완료",
                description: "연말 결산 자료가 성공적으로 다운로드되었습니다.",
            });
            setOpen(false);

        } catch (error) {
            console.error("Export failed:", error);
            toast({
                variant: "destructive",
                title: "내보내기 실패",
                description: "데이터를 내보내는 중 오류가 발생했습니다.",
            });
        } finally {
            setLoading(false);
        }
    };

    // 헬퍼 함수들
    const formatDate = (date: any) => {
        if (!date) return "";
        const d = new Date(date);
        return format(d, "yyyy-MM-dd");
    };

    const getStatusText = (status: string) => {
        const map: Record<string, string> = {
            paid: "결제완료/지급완료",
            completed: "완료",
            pending: "대기",
            approved: "승인",
            rejected: "반려",
            canceled: "취소"
        };
        return map[status] || status;
    };

    const getPaymentMethodText = (method: string) => {
        const map: Record<string, string> = {
            card: "카드",
            cash: "현금",
            transfer: "계좌이체"
        };
        return map[method] || method;
    };

    const aggregateMonthlySales = (rows: any[]) => {
        const monthly: Record<string, number> = {};
        rows.forEach(data => {
            const date = new Date(data.order_date);
            const monthKey = `${date.getMonth() + 1}월`;

            let amount = data.summary?.total || 0;

            // 이관된 주문인 경우 분배율 적용 (여기서는 전체 매출 관점이므로 발주지점 기준으로 계산)
            // 지점별 합계와 일관성을 위해 각 주문의 '실질 매출'을 합산
            if (data.transferInfo?.isTransferred && (data.transferInfo.status === 'accepted' || data.transferInfo.status === 'completed')) {
                const split = data.transferInfo.amountSplit || { orderBranch: 100, processBranch: 0 };
                // 월별 전체 매출은 시스템 전체 관점이므로 전체 금액을 유지하되, 
                // 지점별 합산과 맞추기 위해 여기서는 단순 합산이 아닌 분배된 금액의 합 방식을 고려할 수도 있음.
                // 일반적인 월별 매출은 주문 발생액 전체로 보는 경우가 많으므로 그대로 유지하거나, 
                // 사용자의 의도에 따라 지점별 실질 매출의 합으로 표현.
                // 여기서는 지점별 합계와 맞추기 위해 지점별 실질 매출의 합으로 계산 (어차피 합은 전체와 동일)
            }

            monthly[monthKey] = (monthly[monthKey] || 0) + amount;
        });
        return Object.entries(monthly).map(([month, sales]) => ({ "월": month, "매출액": sales }));
    };

    const aggregateBranchSales = (rows: any[]) => {
        const branch: Record<string, number> = {};
        rows.forEach(data => {
            const originalBranchName = data.branch_name || "미지정";
            const totalAmount = data.summary?.total || 0;

            if (data.transfer_info?.isTransferred && (data.transfer_info.status === 'accepted' || data.transfer_info.status === 'completed')) {
                const split = data.transfer_info.amount_split || { orderBranch: 100, processBranch: 0 };
                const processBranchName = data.transfer_info.processBranchName;

                // 발주지점 매출 가산
                const orderBranchSales = Math.round(totalAmount * (split.orderBranch / 100));
                branch[originalBranchName] = (branch[originalBranchName] || 0) + orderBranchSales;

                // 수주지점 매출 가산 (있을 경우만)
                if (processBranchName) {
                    const processBranchSales = Math.round(totalAmount * (split.processBranch / 100));
                    branch[processBranchName] = (branch[processBranchName] || 0) + processBranchSales;
                }
            } else {
                // 일반 주문
                branch[originalBranchName] = (branch[originalBranchName] || 0) + totalAmount;
            }
        });
        return Object.entries(branch).map(([name, sales]) => ({ "지점명": name, "실질매출액": sales }));
    };

    // 연도 옵션 생성 (최근 5년)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    내보내기
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>연말 결산 데이터 내보내기</DialogTitle>
                    <DialogDescription>
                        선택한 연도의 모든 데이터를 엑셀 파일로 다운로드합니다.
                        지점별, 월별 분석 자료가 포함됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>대상 연도</Label>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map(year => (
                                    <SelectItem key={year} value={year}>{year}년</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-4">
                        <Label>포함할 데이터</Label>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="includeSales"
                                    checked={includeSales}
                                    onCheckedChange={(c) => setIncludeSales(!!c)}
                                />
                                <label htmlFor="includeSales" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    매출 내역 (주문 정보, 월별/지점별 통계)
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="includeExpenses"
                                    checked={includeExpenses}
                                    onCheckedChange={(c) => setIncludeExpenses(!!c)}
                                />
                                <label htmlFor="includeExpenses" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    지출 내역 (비용 신청 정보)
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
                        취소
                    </Button>
                    <Button onClick={handleExport} disabled={loading} className="gap-2">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                        엑셀 다운로드
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
