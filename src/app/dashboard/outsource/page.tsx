"use client";

import React from "react";
import { PageHeader } from "@/components/page-header";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    ExternalLink,
    TrendingUp,
    Package,
    DollarSign,
    RefreshCw,
    MoreHorizontal,
    FileText,
    Calendar as CalendarIcon,
    Download,
    X,
    ChevronLeft,
    ChevronRight
} from "lucide-react";
import { useOutsourceOrders } from "@/hooks/use-outsource-orders";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { OrderDetailDialog } from "../orders/components/order-detail-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function OutsourcePage() {
    const { orders, loading, stats: totalStats, fetchOutsourceOrders, updateOutsourceStatus } = useOutsourceOrders();
    const { user } = useAuth();
    const { branches } = useBranches();
    const isAdmin = user?.role === '본사 관리자';

    const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    const [selectedBranch, setSelectedBranch] = React.useState<string>("all");

    // Initialize to current month
    const [startDate, setStartDate] = React.useState<Date | undefined>(startOfDay(startOfMonth(new Date())));
    const [endDate, setEndDate] = React.useState<Date | undefined>(endOfDay(endOfMonth(new Date())));

    // Pagination state
    const [displayCount, setDisplayCount] = React.useState(50);

    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 50);
    };

    const handleRowClick = (order: any) => {
        setSelectedOrder(order);
        setIsDetailOpen(true);
    };

    const handlePreviousMonth = () => {
        if (!startDate) return;
        const prevMonth = subMonths(startDate, 1);
        setStartDate(startOfDay(startOfMonth(prevMonth)));
        setEndDate(endOfDay(endOfMonth(prevMonth)));
    };

    const handleNextMonth = () => {
        if (!startDate) return;
        const nextMonth = addMonths(startDate, 1);
        setStartDate(startOfDay(startOfMonth(nextMonth)));
        setEndDate(endOfDay(endOfMonth(nextMonth)));
    };

    const handleCurrentMonth = () => {
        const now = new Date();
        setStartDate(startOfDay(startOfMonth(now)));
        setEndDate(endOfDay(endOfMonth(now)));
    };

    const filteredOrders = React.useMemo(() => {
        return orders.filter(order => {
            if (!order.outsourceInfo?.outsourcedAt) return false;
            const outsourcedDate = (order.outsourceInfo.outsourcedAt as Timestamp).toDate();

            if (startDate && outsourcedDate < startOfDay(startDate)) return false;
            if (endDate && outsourcedDate > endOfDay(endDate)) return false;

            // Branch filtering for admin
            if (isAdmin && selectedBranch !== "all" && order.branchName !== selectedBranch) return false;

            return true;
        });
    }, [orders, startDate, endDate, isAdmin, selectedBranch]);

    // Reset pagination when filter changes
    React.useEffect(() => {
        setDisplayCount(50);
    }, [startDate, endDate, selectedBranch]);

    const partnerStats = React.useMemo(() => {
        const statsMap = new Map<string, {
            partnerName: string,
            count: number,
            revenue: number,
            partnerPrice: number,
            profit: number
        }>();

        filteredOrders.forEach(order => {
            const partnerName = order.outsourceInfo?.partnerName || "미지정";
            const current = statsMap.get(partnerName) || {
                partnerName,
                count: 0,
                revenue: 0,
                partnerPrice: 0,
                profit: 0
            };

            current.count += 1;
            current.revenue += order.summary?.total || 0;
            current.partnerPrice += order.outsourceInfo?.partnerPrice || 0;
            current.profit += order.outsourceInfo?.profit || 0;

            statsMap.set(partnerName, current);
        });

        return Array.from(statsMap.values()).sort((a, b) => b.revenue - a.revenue);
    }, [filteredOrders]);

    const branchStats = React.useMemo(() => {
        const statsMap = new Map<string, {
            branchName: string,
            count: number,
            revenue: number,
            partnerPrice: number,
            profit: number
        }>();

        filteredOrders.forEach(order => {
            const branchName = order.branchName || "미지정";
            const current = statsMap.get(branchName) || {
                branchName,
                count: 0,
                revenue: 0,
                partnerPrice: 0,
                profit: 0
            };

            current.count += 1;
            current.revenue += order.summary?.total || 0;
            current.partnerPrice += order.outsourceInfo?.partnerPrice || 0;
            current.profit += order.outsourceInfo?.profit || 0;

            statsMap.set(branchName, current);
        });

        return Array.from(statsMap.values()).sort((a, b) => b.revenue - a.revenue);
    }, [filteredOrders]);

    const activeStats = React.useMemo(() => {
        const totalCount = filteredOrders.length;
        const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
        const totalPartnerPrice = filteredOrders.reduce((sum, order) => sum + (order.outsourceInfo?.partnerPrice || 0), 0);
        const totalProfit = filteredOrders.reduce((sum, order) => sum + (order.outsourceInfo?.profit || 0), 0);
        const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        return {
            totalCount,
            totalRevenue,
            totalPartnerPrice,
            totalProfit,
            averageMargin
        };
    }, [filteredOrders]);

    const annualRevenue = React.useMemo(() => {
        const currentYear = new Date().getFullYear();
        return orders.filter(order => {
            if (isAdmin && selectedBranch !== "all" && order.branchName !== selectedBranch) {
                return false;
            }
            const orderDate = order.orderDate instanceof Timestamp ? order.orderDate.toDate() : new Date(order.orderDate);
            return orderDate.getFullYear() === currentYear;
        }).reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    }, [orders, selectedBranch, isAdmin]);

    const periodTitle = React.useMemo(() => {
        if (!startDate || !endDate) return "전체 기간";
        if (format(startDate, 'yyyyMM') === format(endDate, 'yyyyMM')) {
            return format(startDate, 'yyyy년 MM월');
        }
        return `${format(startDate, 'yy/MM/dd')} ~ ${format(endDate, 'yy/MM/dd')}`;
    }, [startDate, endDate]);

    const handleDownloadStats = () => {
        const data = partnerStats.map(s => ({
            "업체명": s.partnerName,
            "발주건수": s.count,
            "수주총액": s.revenue,
            "발주가": s.partnerPrice,
            "수수료수익": s.profit,
            "수익률": s.revenue > 0 ? `${((s.profit / s.revenue) * 100).toFixed(1)}%` : "0%"
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "업체별통계");

        const wscols = [{ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        worksheet['!cols'] = wscols;

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(blob, `외부발주_업체별통계_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const handleDownloadOrders = () => {
        const data = filteredOrders.map(order => ({
            "발주일": order.outsourceInfo?.outsourcedAt ? format((order.outsourceInfo.outsourcedAt as Timestamp).toDate(), 'yyyy-MM-dd HH:mm') : '',
            "수주업체": order.outsourceInfo?.partnerName,
            "주문번호": order.orderNumber || '',
            "주문자": order.orderer.name,
            "발주지점": order.branchName,
            "상태": order.outsourceInfo?.status === 'pending' ? '대기' :
                order.outsourceInfo?.status === 'accepted' ? '수락' :
                    order.outsourceInfo?.status === 'completed' ? '완료' : '취소',
            "수주총액": order.summary.total,
            "발주가": order.outsourceInfo?.partnerPrice,
            "수익": order.outsourceInfo?.profit
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "상세발주내역");

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
        saveAs(blob, `외부발주_상세내역_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <PageHeader
                title="외부 발주 관리"
                description="외부 파트너(화원/도매)로 발주된 주문과 수익을 한눈에 관리합니다."
            >
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                        <ChevronLeft className="h-4 w-4" /> 이전달
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCurrentMonth}>
                        이번달
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleNextMonth}>
                        다음달 <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => fetchOutsourceOrders()}>
                        <RefreshCw className="mr-2 h-4 w-4" /> 새로고침
                    </Button>
                </div>
            </PageHeader>

            {/* 필터 섹션 */}
            <Card className="bg-slate-50/50">
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">기간설정:</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[160px] justify-start text-left font-normal",
                                            !startDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {startDate ? format(startDate, "yyyy-MM-dd") : "시작일"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={setStartDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            <span className="text-slate-400">~</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-[160px] justify-start text-left font-normal",
                                            !endDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {endDate ? format(endDate, "yyyy-MM-dd") : "종료일"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={setEndDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                            {(startDate || endDate) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setStartDate(undefined); setEndDate(undefined); }}
                                    className="text-slate-500"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {isAdmin && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-500">지점:</span>
                                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="전체 지점" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">전체 지점</SelectItem>
                                        {branches.filter(b => b.type !== '본사').map((branch) => (
                                            <SelectItem key={branch.id} value={branch.name}>
                                                {branch.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="ml-auto flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownloadStats} disabled={partnerStats.length === 0}>
                                <TrendingUp className="mr-2 h-4 w-4" /> 업체별 통계 (Excel)
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownloadOrders} disabled={filteredOrders.length === 0}>
                                <Download className="mr-2 h-4 w-4" /> 상세 내역 (Excel)
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* 대시보드 요약 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="bg-slate-900 text-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-300">{new Date().getFullYear()}년 총액</CardTitle>
                        <DollarSign className="h-4 w-4 text-slate-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₩{annualRevenue.toLocaleString()}</div>
                        <p className="text-[10px] text-slate-400 mt-1">올해 전체 주문 합계</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">수주 총액</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">₩{activeStats.totalRevenue.toLocaleString()}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">선택 기간 합계</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">수수료 수익</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">₩{activeStats.totalProfit.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">수익률: {activeStats.averageMargin.toFixed(1)}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">총 발주가</CardTitle>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">₩{activeStats.totalPartnerPrice.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">발주 건수</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeStats.totalCount}건</div>
                        {(startDate || endDate) && <p className="text-xs text-muted-foreground mt-1">필터 적용됨</p>}
                    </CardContent>
                </Card>
            </div>

            {/* 차트 시각화 섹션 */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            {periodTitle} 지점별 발주 현황
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={branchStats.slice(0, 5)} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="branchName"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={(value) => `₩${(value / 10000).toLocaleString()}만`}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <RechartsTooltip
                                    formatter={(value: number) => [`₩${value.toLocaleString()}원`, '매출']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                    {branchStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#93c5fd'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Package className="h-4 w-4 text-emerald-500" />
                            {periodTitle} 지점별 수익 분포
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={branchStats}
                                    dataKey="profit"
                                    nameKey="branchName"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    label={({ branchName, percent }) => `${branchName} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {branchStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#6ee7b7'} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value: number) => `₩${value.toLocaleString()}원`} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-7">
                {/* 업체별/지점별 통계 탭 */}
                <Card className="md:col-span-3">
                    <Tabs defaultValue="partners" className="w-full">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="space-y-1">
                                <CardTitle className="text-lg">분류별 통계 요약</CardTitle>
                                <CardDescription>
                                    조건별 수주/발주 현황입니다.
                                </CardDescription>
                            </div>
                            <TabsList className="bg-muted">
                                <TabsTrigger value="partners" className="text-xs">업체별</TabsTrigger>
                                <TabsTrigger value="branches" className="text-xs">지점별</TabsTrigger>
                            </TabsList>
                        </CardHeader>
                        <CardContent>
                            <TabsContent value="partners" className="m-0">
                                <div className="max-h-[350px] overflow-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm border-b">
                                            <TableRow>
                                                <TableHead className="text-xs">업체명</TableHead>
                                                <TableHead className="text-center text-xs">건수</TableHead>
                                                <TableHead className="text-right text-xs">발주가</TableHead>
                                                <TableHead className="text-right text-xs">수익</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {partnerStats.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground">데이터가 없습니다.</TableCell></TableRow>
                                            ) : (
                                                partnerStats.map((s) => (
                                                    <TableRow key={s.partnerName}>
                                                        <TableCell className="font-medium text-xs truncate max-w-[120px]">{s.partnerName}</TableCell>
                                                        <TableCell className="text-center text-xs">{s.count}</TableCell>
                                                        <TableCell className="text-right text-[10px]">₩{s.partnerPrice.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600 text-xs">₩{s.profit.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                            <TabsContent value="branches" className="m-0">
                                <div className="max-h-[350px] overflow-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10 shadow-sm border-b">
                                            <TableRow>
                                                <TableHead className="text-xs">지점명</TableHead>
                                                <TableHead className="text-center text-xs">건수</TableHead>
                                                <TableHead className="text-right text-xs">발주가</TableHead>
                                                <TableHead className="text-right text-xs">수익</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {branchStats.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-4 text-sm text-muted-foreground">데이터가 없습니다.</TableCell></TableRow>
                                            ) : (
                                                branchStats.map((s) => (
                                                    <TableRow key={s.branchName}>
                                                        <TableCell className="font-medium text-xs">{s.branchName}</TableCell>
                                                        <TableCell className="text-center text-xs">{s.count}</TableCell>
                                                        <TableCell className="text-right text-[10px]">₩{s.partnerPrice.toLocaleString()}</TableCell>
                                                        <TableCell className="text-right font-semibold text-green-600 text-xs">₩{s.profit.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>

                {/* 요약 상세 */}
                <Card className="md:col-span-4">
                    <CardHeader>
                        <CardTitle className="text-lg">발주 내역 요약</CardTitle>
                        <CardDescription>
                            {startDate ? format(startDate, 'yyyy년 M월') : ''} 최근 발주된 주문 5건입니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="relative w-full overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>발주일</TableHead>
                                        <TableHead>업체</TableHead>
                                        <TableHead className="text-right">발주가</TableHead>
                                        <TableHead>상태</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={4} className="text-center"><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                                    ) : filteredOrders.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-4">내역 없음</TableCell></TableRow>
                                    ) : (
                                        filteredOrders.slice(0, 5).map((order) => (
                                            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleRowClick(order)}>
                                                <TableCell className="text-[10px] whitespace-nowrap">
                                                    {order.outsourceInfo?.outsourcedAt && format((order.outsourceInfo.outsourcedAt as Timestamp).toDate(), 'MM/dd HH:mm')}
                                                </TableCell>
                                                <TableCell className="font-medium text-xs truncate max-w-[100px]">{order.outsourceInfo?.partnerName}</TableCell>
                                                <TableCell className="text-right text-xs font-medium">₩{order.outsourceInfo?.partnerPrice.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    <Badge variant={order.outsourceInfo?.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] px-2 h-5">
                                                        {order.outsourceInfo?.status === 'pending' ? '대기' :
                                                            order.outsourceInfo?.status === 'accepted' ? '수락' :
                                                                order.outsourceInfo?.status === 'completed' ? '완료' : '취소'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>전체 발주 내역 리스트</CardTitle>
                    <CardDescription>
                        외부 업체로 발주된 모든 주문 상세 내용입니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>발주일 / 주문일</TableHead>
                                <TableHead>배송일시</TableHead>
                                <TableHead>파트너(수주처)</TableHead>
                                <TableHead>주문자</TableHead>
                                <TableHead>발주지점</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead className="text-right">수주총액</TableHead>
                                <TableHead className="text-right">발주가</TableHead>
                                <TableHead className="text-right text-green-600">수익</TableHead>
                                <TableHead className="text-right">작업</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : filteredOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">
                                        내역이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredOrders.slice(0, displayCount).map((order) => (
                                    <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(order)}>
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium text-blue-600">
                                                    {order.outsourceInfo?.outsourcedAt && format((order.outsourceInfo.outsourcedAt as Timestamp).toDate(), 'MM/dd HH:mm')}
                                                </span>
                                                <span className="text-gray-400 text-[10px]">
                                                    {format((order.orderDate as Timestamp).toDate(), 'MM/dd')}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            {order.deliveryInfo ? `${order.deliveryInfo.date} ${order.deliveryInfo.time}` : '-'}
                                        </TableCell>
                                        <TableCell className="font-medium">{order.outsourceInfo?.partnerName}</TableCell>
                                        <TableCell className="text-xs">{order.orderer.name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{order.branchName}</TableCell>
                                        <TableCell>
                                            <Badge variant={order.outsourceInfo?.status === 'completed' ? 'default' : 'secondary'}>
                                                {order.outsourceInfo?.status === 'pending' ? '대기' :
                                                    order.outsourceInfo?.status === 'accepted' ? '수락' :
                                                        order.outsourceInfo?.status === 'completed' ? '완료' : '취소'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">₩{order.summary.total.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-orange-600 font-medium text-xs text-nowrap">₩{order.outsourceInfo?.partnerPrice.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-green-600 font-bold text-xs text-nowrap">₩{order.outsourceInfo?.profit.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button size="icon" variant="ghost">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>발주 상태 변경</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateOutsourceStatus(order.id, 'accepted'); }}>
                                                        발주 수락
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateOutsourceStatus(order.id, 'completed'); }}>
                                                        배송 완료
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); updateOutsourceStatus(order.id, 'canceled'); }}>
                                                        발주 취소
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                            {filteredOrders.length > displayCount && !loading && (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-4">
                                        <Button variant="ghost" onClick={handleLoadMore}>
                                            더 보기 ({Math.min(filteredOrders.length - displayCount, 50)}개 더)
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <OrderDetailDialog
                isOpen={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                order={selectedOrder}
            />
        </div >
    );
}
