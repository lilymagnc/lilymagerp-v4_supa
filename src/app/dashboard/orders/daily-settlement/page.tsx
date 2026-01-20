"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Target, DollarSign, ArrowRightLeft, RefreshCw, ChevronLeft, ChevronRight, FileText, XCircle, Download, Save, ShoppingCart } from "lucide-react";
import { format, subDays, addDays, startOfDay, endOfDay } from "date-fns";
import { useOrders, Order } from "@/hooks/use-orders";
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { useProducts } from "@/hooks/use-products";
import { useSimpleExpenses } from "@/hooks/use-simple-expenses";
import { useDailySettlements } from "@/hooks/use-daily-settlements";
import { Timestamp } from "firebase/firestore";
import { PageHeader } from "@/components/page-header";
import Link from 'next/link';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OrderDetailDialog } from "../components/order-detail-dialog";
import { exportDailySettlementToExcel } from "@/lib/excel-export";
import { SimpleExpenseCategory, SIMPLE_EXPENSE_CATEGORY_LABELS } from "@/types/simple-expense";
import { DailySettlementRecord } from "@/types/daily-settlement";

export default function DailySettlementPage() {
    const { orders, fetchOrdersForSettlement, loading: ordersLoading } = useOrders();
    const { branches, loading: branchesLoading } = useBranches();
    const { products, loading: productsLoading } = useProducts();
    const { expenses, fetchExpenses, calculateStats, loading: expensesLoading } = useSimpleExpenses();
    const { getSettlement, saveSettlement, loading: settlementLoading } = useDailySettlements();
    const { user } = useAuth();

    const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // 정산 데이터 상태
    const [settlementRecord, setSettlementRecord] = useState<DailySettlementRecord | null>(null);
    const [prevSettlementRecord, setPrevSettlementRecord] = useState<DailySettlementRecord | null>(null);
    const [dailyExpenses, setDailyExpenses] = useState<any[]>([]);
    const [vaultDeposit, setVaultDeposit] = useState<number>(0);
    const [manualPreviousBalance, setManualPreviousBalance] = useState<number>(0);

    const isAdmin = user?.role === '본사 관리자';
    const userBranch = user?.franchise;

    // 현재 보고 있는 기준 지점
    const currentTargetBranch = isAdmin ? selectedBranch : userBranch;
    const currentBranchId = branches.find(b => b.name === currentTargetBranch)?.id;

    // 비용 및 정산 데이터 불러오기 (최적화됨)
    useEffect(() => {
        const loadData = async () => {
            if (!currentBranchId || currentTargetBranch === 'all') return;

            const dateFrom = new Date(reportDate + 'T00:00:00');
            const dateTo = new Date(reportDate + 'T23:59:59');
            const prevDate = format(subDays(new Date(reportDate), 1), 'yyyy-MM-dd');

            // 병렬 처리를 통한 로딩 속도 개선
            const [settlementResult, prevSettlementResult, _expensesResult, _ordersResult] = await Promise.all([
                getSettlement(currentBranchId, reportDate),
                getSettlement(currentBranchId, prevDate),
                fetchExpenses({
                    branchId: currentBranchId,
                    dateFrom,
                    dateTo
                }),
                fetchOrdersForSettlement(reportDate)
            ]);

            setSettlementRecord(settlementResult);
            setVaultDeposit(settlementResult?.vaultDeposit || 0);
            setManualPreviousBalance(settlementResult?.previousVaultBalance || 0);
            setPrevSettlementRecord(prevSettlementResult);
        };

        loadData();
    }, [currentBranchId, reportDate, currentTargetBranch, getSettlement, fetchExpenses, fetchOrdersForSettlement]);

    const loading = ordersLoading || branchesLoading || productsLoading || expensesLoading || settlementLoading;

    // 정산 데이터 계산
    const stats = useMemo(() => {
        if (!orders.length) return null;

        // 날짜 필터 생성 (YYYY-MM-DDT00:00:00 형식을 사용하여 로컬 시간 보장)
        const from = new Date(reportDate + 'T00:00:00');
        const to = new Date(reportDate + 'T23:59:59.999');

        // 해당 일자의 주문 필터링
        const dailyOrders = orders.filter(order => {
            const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();
            const isInDate = orderDate >= from && orderDate <= to;
            const isCanceled = order.status === 'canceled';

            if (!isInDate || isCanceled) return false;

            // 전체 보기거나, 내가 관여한 주문인 경우
            if (currentTargetBranch === 'all') return true;

            const isOriginalBranch = order.branchName === currentTargetBranch;
            const isProcessBranch = order.transferInfo?.isTransferred &&
                (order.transferInfo?.status === 'accepted' || order.transferInfo?.status === 'completed') &&
                order.transferInfo?.processBranchName === currentTargetBranch;

            return isOriginalBranch || isProcessBranch;
        });

        // 시간 내림차순 정렬
        dailyOrders.sort((a, b) => {
            const dateA = (a.orderDate as any)?.toDate ? (a.orderDate as any).toDate() : new Date(a.orderDate as any);
            const dateB = (b.orderDate as any)?.toDate ? (b.orderDate as any).toDate() : new Date(b.orderDate as any);
            return dateB.getTime() - dateA.getTime();
        });

        // 2-1. 이월 주문 결제 필터링 (주문은 예전인데 오늘 결제 완료된 건)
        const previousOrderPayments = orders.filter(order => {
            const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();
            const isBeforeToday = orderDate < from;
            const isCanceled = order.status === 'canceled';

            if (!isBeforeToday || isCanceled) return false;

            // 결제 완료일 확인 (payment.completedAt 또는 payment.secondPaymentDate)
            const completedAt = (order.payment as any).completedAt instanceof Timestamp
                ? (order.payment as any).completedAt.toDate()
                : ((order.payment as any).completedAt ? new Date((order.payment as any).completedAt) : null);

            const secondPaymentDate = (order.payment as any).secondPaymentDate instanceof Timestamp
                ? (order.payment as any).secondPaymentDate.toDate()
                : ((order.payment as any).secondPaymentDate ? new Date((order.payment as any).secondPaymentDate) : null);

            const isCompletedToday = completedAt && completedAt >= from && completedAt <= to;
            const isSecondPaidToday = secondPaymentDate && secondPaymentDate >= from && secondPaymentDate <= to;

            if (!isCompletedToday && !isSecondPaidToday) return false;

            // 지분 확인
            if (currentTargetBranch === 'all') return true;
            const isOriginalBranch = order.branchName === currentTargetBranch;
            const isProcessBranch = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;

            return isOriginalBranch || isProcessBranch;
        });

        let totalPayment = 0;   // 기준 지점의 당일 주문 총 결제액
        let outgoingSettle = 0; // 발주 정산액 (내 지분)
        let incomingSettle = 0; // 수주 정산액 (내 지분)
        let netSales = 0;       // 실질 매출 합계
        let prevOrderPaymentTotal = 0; // 이월 주문 수금액

        let pendingAmountToday = 0;
        const pendingOrdersToday: Order[] = [];
        const paidOrdersToday: Order[] = [];

        // 결제수단별 집계
        const paymentStats = {
            card: { count: 0, amount: 0 },
            cash: { count: 0, amount: 0 },
            transfer: { count: 0, amount: 0 },
            others: { count: 0, amount: 0 }
        };

        let deliveryCostCashToday = 0;

        // 배송비 현금 지급액 합산 (정체성 강화: 오늘 주문이거나 오늘 배송비가 수정된 모든 건)
        const processedCashOrderIds = new Set<string>();

        // 함수 정의: 지점 필터링 로직 (중복 방지)
        const isTargetBranchOrder = (order: Order) => {
            if (currentTargetBranch === 'all') return true;
            const target = currentTargetBranch.trim().replace(/\s/g, '');
            const isOriginal = order.branchName?.trim().replace(/\s/g, '') === target;
            const isProcess = order.transferInfo?.isTransferred &&
                (order.transferInfo?.status === 'accepted' || order.transferInfo?.status === 'completed') &&
                order.transferInfo?.processBranchName?.trim().replace(/\s/g, '') === target;
            return isOriginal || isProcess;
        };

        // 1. 당일 주문 전체에서 현금 배송비 추출
        dailyOrders.forEach(order => {
            if (order.actualDeliveryCostCash && isTargetBranchOrder(order)) {
                deliveryCostCashToday += Number(order.actualDeliveryCostCash);
                processedCashOrderIds.add(order.id);
            }
        });

        // 2. 전체 기간 주문 중 오늘 배송비가 수정된 건 추가 합산 (이월 주문 대비)
        orders.forEach(order => {
            if (!order.actualDeliveryCostCash || processedCashOrderIds.has(order.id)) return;
            if (!isTargetBranchOrder(order)) return;

            const updatedAt = (order.deliveryCostUpdatedAt as any)?.toDate
                ? (order.deliveryCostUpdatedAt as any).toDate()
                : (order.deliveryCostUpdatedAt instanceof Date ? order.deliveryCostUpdatedAt : null);

            if (updatedAt && format(updatedAt, 'yyyy-MM-dd') === reportDate) {
                deliveryCostCashToday += Number(order.actualDeliveryCostCash);
                processedCashOrderIds.add(order.id);
            }
        });

        const updatePaymentStats = (order: Order, amount: number) => {
            // 호출 시점에서 이미 '유효한 결제'임이 확인되었다고 가정함
            const method = order.payment.method;
            if (method === 'card') {
                paymentStats.card.count++;
                paymentStats.card.amount += amount;
            } else if (method === 'cash') {
                paymentStats.cash.count++;
                paymentStats.cash.amount += amount;
            } else if (method === 'transfer') {
                paymentStats.transfer.count++;
                paymentStats.transfer.amount += amount;
            } else {
                paymentStats.others.count++;
                paymentStats.others.amount += amount;
            }
        };

        dailyOrders.forEach(order => {
            const total = order.summary.total;
            const isTransferred = order.transferInfo?.isTransferred;
            const transferStatus = order.transferInfo?.status;
            const isValidTransfer = isTransferred && (transferStatus === 'accepted' || transferStatus === 'completed');

            // 실제 결제 상태 확인
            const isPaidGlobal = order.payment?.status === 'paid' || order.payment?.status === 'completed';

            // 결제 시점 확인
            const completedAt = (order.payment as any).completedAt instanceof Timestamp
                ? (order.payment as any).completedAt.toDate()
                : ((order.payment as any).completedAt ? new Date((order.payment as any).completedAt) : null);

            const secondPaymentDate = (order.payment as any).secondPaymentDate instanceof Timestamp
                ? (order.payment as any).secondPaymentDate.toDate()
                : ((order.payment as any).secondPaymentDate ? new Date((order.payment as any).secondPaymentDate) : null);

            // 유효 결제일: to (오늘의 마감시간)보다 작거나 같아야 함
            let isPaidEffective = false;
            if (isPaidGlobal) {
                if (completedAt) {
                    isPaidEffective = completedAt <= to;
                } else if (secondPaymentDate) {
                    isPaidEffective = secondPaymentDate <= to;
                } else {
                    // Timestamp 정보가 없는 경우 (구 데이터 또는 즉시완료 건)
                    isPaidEffective = true;
                }
            }

            const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };

            if (currentTargetBranch === 'all') {
                totalPayment += total;
                if (isPaidEffective) {
                    netSales += total;
                    outgoingSettle += total;
                    updatePaymentStats(order, total);
                    paidOrdersToday.push(order);
                } else {
                    pendingOrdersToday.push(order);
                    pendingAmountToday += total;
                }
            } else {
                const isOriginal = order.branchName === currentTargetBranch;
                const isProcess = isValidTransfer && order.transferInfo?.processBranchName === currentTargetBranch;

                if (isOriginal) {
                    totalPayment += total;
                    if (isPaidEffective) {
                        const share = isValidTransfer ? Math.round(total * (split.orderBranch / 100)) : total;
                        outgoingSettle += share;
                        netSales += share;
                        updatePaymentStats(order, share);
                        paidOrdersToday.push(order);
                    } else {
                        pendingOrdersToday.push(order);
                        const share = isValidTransfer ? Math.round(total * (split.orderBranch / 100)) : total;
                        pendingAmountToday += share;
                    }
                }

                if (isProcess) {
                    if (isPaidEffective) {
                        const share = Math.round(total * (split.processBranch / 100));
                        incomingSettle += share;
                        netSales += share;
                        if (!paidOrdersToday.includes(order)) paidOrdersToday.push(order);
                        // 수주 지점의 결제 수단 집계 반영
                        updatePaymentStats(order, share);
                    }
                    // 수주 지점은 미결 금액 집계 제외 (기존 로직 유지)
                }
            }

            // 배송비 현금 지급액 합산 로직은 위에서 전체 orders 대상으로 통합 처리함
        });

        // 이월 주문 결제 처리
        previousOrderPayments.forEach(order => {
            const total = order.summary.total;
            const isOriginal = order.branchName === currentTargetBranch;
            const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;
            const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };

            let share = 0;
            if (currentTargetBranch === 'all') {
                share = total;
            } else {
                if (isOriginal) {
                    share = order.transferInfo?.isTransferred ? Math.round(total * (split.orderBranch / 100)) : total;
                } else if (isProcess) {
                    share = Math.round(total * (split.processBranch / 100));
                }
            }

            updatePaymentStats(order, share);

            if (currentTargetBranch === 'all') {
                prevOrderPaymentTotal += total;
                netSales += total;
            } else {
                const isOriginal = order.branchName === currentTargetBranch;
                const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;

                const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };

                if (isOriginal) {
                    const share = order.transferInfo?.isTransferred ? Math.round(total * (split.orderBranch / 100)) : total;
                    prevOrderPaymentTotal += share;
                    netSales += share;
                }
                if (isProcess) {
                    const share = Math.round(total * (split.processBranch / 100));
                    prevOrderPaymentTotal += share;
                    netSales += share;
                }
            }
        });

        // 지출(비용) 집계
        // useSimpleExpenses에서 fetch한 expenses 필터링 (currentTargetBranchId 기준)
        // fetchExpenses가 이미 지점/날짜 필터를 적용했다면 그대로 사용 가능
        const expenseSummary = {
            total: 0,
            transport: { count: 0, amount: 0 },
            material: { amount: 0 },
            others: { amount: 0 }
        };

        // filters가 적용된 상태라면 fetch한 expenses가 이미 정확함
        // 하지만 currentTargetBranch가 'all'인 경우 useSimpleExpenses의 expenses는 전체일 수 있음
        const targetExpenses = currentTargetBranch === 'all'
            ? [] // 전체 보기 시에는 개별 지점 시재 파악이 어려우므로 제외하거나 별도 처리
            : ordersLoading ? [] : []; // 실제 값은 아래에서 계산 (훅에서 가져온 expenses 사용)

        return {
            dailyOrders,
            paidOrdersToday,
            previousOrderPayments,
            pendingOrdersToday,
            totalPayment,
            outgoingSettle,
            incomingSettle,
            netSales,
            prevOrderPaymentTotal,
            pendingAmountToday,
            orderCount: dailyOrders.length,
            paymentStats,
            deliveryCostCashToday,
            from,
            to
        };
    }, [orders, reportDate, currentTargetBranch, ordersLoading]);

    // 지출 요약 (매입)
    const summaryExpense = useMemo(() => {
        // useSimpleExpenses에서 fetch한 expenses 필터링
        const filtered = expenses.filter(e => {
            const expenseDate = e.date instanceof Date ? e.date : e.date.toDate();
            // const reportDateObj = new Date(reportDate + 'T00:00:00'); // Unused
            return format(expenseDate, 'yyyy-MM-dd') === reportDate;
        });

        const transport = filtered.filter(e => e.category === SimpleExpenseCategory.TRANSPORT);

        // 외부발주 분리 (설명에 '외부발주'가 포함된 자재비)
        const outsource = filtered.filter(e =>
            e.category === SimpleExpenseCategory.MATERIAL && e.description.includes('외부발주')
        );

        // 순수 자재비 (외부발주 제외)
        const material = filtered.filter(e =>
            e.category === SimpleExpenseCategory.MATERIAL && !e.description.includes('외부발주')
        );

        const other = filtered.filter(e => e.category !== SimpleExpenseCategory.TRANSPORT && e.category !== SimpleExpenseCategory.MATERIAL);

        return {
            total: filtered.reduce((sum, e) => sum + e.amount, 0),
            transport: {
                count: transport.reduce((sum, e) => sum + (e.quantity || 1), 0),
                amount: transport.reduce((sum, e) => sum + e.amount, 0)
            },
            outsource: {
                count: outsource.length,
                amount: outsource.reduce((sum, e) => sum + e.amount, 0),
                items: outsource // 목록 전달
            },
            materialAmount: material.reduce((sum, e) => sum + e.amount, 0),
            otherAmount: other.reduce((sum, e) => sum + e.amount, 0)
        };
    }, [expenses, reportDate]);

    // 금고 현금 계산
    const vaultCash = useMemo(() => {
        const cashSales = stats?.paymentStats.cash.amount || 0;

        // 배송비 현금 지급액 집계: 주문 데이터 기반 + 간편지출(현금) 데이터 기반 통합
        // 지출 내역 중 '운송비'이면서 '현금' 결제인 항목들 합산
        const transportCashExpenses = expenses.filter(e => {
            const expenseDate = e.date instanceof Date ? e.date : e.date.toDate();
            const isInDate = format(expenseDate, 'yyyy-MM-dd') === reportDate;
            const isTransport = e.category === SimpleExpenseCategory.TRANSPORT;
            const isCash = e.paymentMethod === 'cash' || e.description.includes('현금');
            return isInDate && isTransport && isCash;
        });
        const deliveryCostCashFromExpenses = transportCashExpenses.reduce((sum, e) => sum + e.amount, 0);

        // 주문 데이터 기반과 지출 데이터 기반 중 더 큰 값 사용 (지출 데이터가 더 정확하므로 우선권)
        const deliveryCostCash = Math.max(stats?.deliveryCostCashToday || 0, deliveryCostCashFromExpenses);


        // 기타 현금 지출 (운송비 제외, 순수 현금/계좌이체 아닌 현금) 집계
        // 조건: 날짜 일치 AND 운송비 아님 AND (결제수단이 'cash' OR 설명에 '현금' 포함)
        const otherCashExpensesList = expenses.filter(e => {
            const expenseDate = e.date instanceof Date ? e.date : e.date.toDate();
            const isInDate = format(expenseDate, 'yyyy-MM-dd') === reportDate;
            const isNotTransport = e.category !== SimpleExpenseCategory.TRANSPORT;
            const isCash = e.paymentMethod === 'cash' || e.description.includes('현금');
            return isInDate && isNotTransport && isCash;
        });
        const otherCashExpenses = otherCashExpensesList.reduce((sum, e) => sum + e.amount, 0);

        // 이전 잔액 결정: 수동 입력값이 있으면 우선
        const prevBalance = manualPreviousBalance || (prevSettlementRecord ?
            (prevSettlementRecord.previousVaultBalance + (prevSettlementRecord.cashSalesToday || 0) - prevSettlementRecord.vaultDeposit - (prevSettlementRecord.deliveryCostCashToday || 0) - (prevSettlementRecord.cashExpenseToday || 0))
            : 0);
        const remaining = prevBalance + cashSales - vaultDeposit - deliveryCostCash - otherCashExpenses;

        return {
            prevBalance,
            cashSales,
            deliveryCostCash,
            otherCashExpenses,
            vaultDeposit,
            remaining
        };
    }, [stats, manualPreviousBalance, prevSettlementRecord, vaultDeposit, expenses, reportDate]);

    // 정산 저장 핸들러
    const handleSaveSettlement = async () => {
        if (!currentBranchId || currentTargetBranch === 'all') return;

        const success = await saveSettlement({
            branchId: currentBranchId,
            branchName: currentTargetBranch,
            date: reportDate,
            previousVaultBalance: vaultCash.prevBalance,
            cashSalesToday: vaultCash.cashSales,
            deliveryCostCashToday: vaultCash.deliveryCostCash,
            cashExpenseToday: vaultCash.otherCashExpenses,
            vaultDeposit: vaultDeposit,
            createdAt: settlementRecord?.createdAt || undefined
        });

        if (success) {
            // 저장 후 상태 업데이트를 위해 다시 불러오기
            const record = await getSettlement(currentBranchId, reportDate);
            setSettlementRecord(record);
        }
    };

    const handlePrevDay = () => setReportDate(prev => format(subDays(new Date(prev), 1), 'yyyy-MM-dd'));
    const handleNextDay = () => setReportDate(prev => format(addDays(new Date(prev), 1), 'yyyy-MM-dd'));

    if (loading && !branches.length) { // 초기 로딩 시에만 풀스크린 로딩
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <PageHeader
                title="일일 마감 정산"
                description={`${currentTargetBranch === 'all' ? '전체' : currentTargetBranch} 지점의 일일 매출 및 이관 정산 내역입니다.`}
            >
                <div className="flex flex-wrap items-center gap-2">
                    {isAdmin && (
                        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="지점 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 지점</SelectItem>
                                {branches.map(b => (
                                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportDailySettlementToExcel(reportDate, currentTargetBranch, stats)}
                        className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                        disabled={!stats}
                    >
                        <Download className="mr-2 h-4 w-4" />
                        엑셀 다운로드
                    </Button>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" onClick={handlePrevDay}><ChevronLeft className="h-4 w-4" /></Button>
                        <Input
                            type="date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            className="w-[150px]"
                        />
                        <Button variant="outline" size="icon" onClick={handleNextDay}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/orders">
                            주문현황 돌아가기
                        </Link>
                    </Button>
                </div>
            </PageHeader>

            {/* 금고 현금 및 매입 요약 */}
            {currentTargetBranch !== 'all' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-primary/20 shadow-sm">
                        <CardHeader className="bg-primary/5 py-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-primary" />
                                금고 현금 관리 (현금 시재)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-3">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">전일 금고 시재</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            value={vaultCash.prevBalance}
                                            onChange={(e) => setManualPreviousBalance(Number(e.target.value))}
                                            className="h-8 text-sm font-bold"
                                        />
                                    </div>
                                    <p className="text-[9px] text-muted-foreground leading-tight">
                                        {prevSettlementRecord ? '전일 정산 기록에서 불러옴' : '수동 입력 필요'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground">당일 현금 매출 (+)</Label>
                                    <div className="h-8 px-2 flex items-center bg-green-50 rounded-md border border-green-100 font-bold text-green-700 text-sm">
                                        ₩{vaultCash.cashSales.toLocaleString()}
                                    </div>
                                    <p className="text-[9px] text-muted-foreground leading-tight">주문 결제 자동 합산</p>
                                </div>

                                {/* 지출 항목 1열 배치 */}
                                <div className="col-span-2 grid grid-cols-3 gap-2 py-2 border-y border-dashed border-gray-100">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground font-medium">시재 입금 (-)</Label>
                                        <Input
                                            type="number"
                                            value={vaultCash.vaultDeposit}
                                            onChange={(e) => setVaultDeposit(Number(e.target.value))}
                                            className="h-8 text-xs font-bold text-red-600 border-red-200"
                                            placeholder="은행 입금"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-red-700 font-bold">배송비 현금 (-)</Label>
                                        <div className="h-8 px-2 flex items-center bg-red-50 rounded-md border border-red-100 font-bold text-red-600 text-xs">
                                            ₩{vaultCash.deliveryCostCash.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-red-700 font-bold">기타 현금 지출 (-)</Label>
                                        <div className="h-8 px-2 flex items-center bg-red-50 rounded-md border border-red-100 font-bold text-red-600 text-xs">
                                            ₩{vaultCash.otherCashExpenses.toLocaleString()}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1 col-span-2 pt-1">
                                    <Label className="text-xs text-primary font-bold">금고상 잔여 현금 (=)</Label>
                                    <div className="h-10 px-3 flex items-center bg-primary/10 rounded-md border border-primary/20 font-black text-primary text-lg">
                                        ₩{vaultCash.remaining.toLocaleString()}
                                    </div>
                                    <p className="text-[10px] text-primary/70 font-medium tracking-tight">현재 포스기 금고에 있어야 할 금액</p>
                                </div>
                            </div>
                            <Button
                                className="w-full mt-2"
                                onClick={handleSaveSettlement}
                                disabled={settlementLoading}
                            >
                                {settlementLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                오늘의 시재 정산 저장
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-200 shadow-sm">
                        <CardHeader className="bg-orange-50/50 pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-orange-600" />
                                당일 매입 및 지출 요약
                            </CardTitle>
                            <CardDescription>간편지출관리 데이터를 통합 요약합니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-700">총 지출 합계</span>
                                        <span className="text-[10px] text-muted-foreground">당일 모든 지출 항목</span>
                                    </div>
                                    <span className="text-xl font-black text-gray-900">₩{summaryExpense.total.toLocaleString()}</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="flex flex-col p-2 bg-blue-50 rounded border border-blue-100 italic">
                                        <span className="text-[10px] text-blue-600 font-bold">운송비 ({summaryExpense.transport.count}건)</span>
                                        <span className="text-sm font-bold text-blue-800">₩{summaryExpense.transport.amount.toLocaleString()}</span>
                                    </div>

                                    {/* 외부발주 섹션 (내역이 있으면 파트너별 표시) */}
                                    <div className="flex flex-col p-2 bg-orange-50 rounded border border-orange-100">
                                        <span className="text-[10px] text-orange-600 font-bold">외부발주 (매입)</span>
                                        <span className="text-sm font-bold text-orange-800">₩{summaryExpense.outsource.amount.toLocaleString()}</span>
                                        {summaryExpense.outsource.items.length > 0 && (
                                            <div className="mt-1 flex flex-col gap-0.5">
                                                {Object.entries(summaryExpense.outsource.items.reduce((acc, item) => {
                                                    acc[item.supplier] = (acc[item.supplier] || 0) + item.amount;
                                                    return acc;
                                                }, {} as Record<string, number>)).map(([supplier, amount]) => (
                                                    <span key={supplier} className="text-[9px] text-orange-700 flex justify-between">
                                                        <span>{supplier}</span>
                                                        <span>{amount.toLocaleString()}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col p-2 bg-purple-50 rounded border border-purple-100">
                                        <span className="text-[10px] text-purple-600 font-bold">자재비 (기타)</span>
                                        <span className="text-sm font-bold text-purple-800">₩{summaryExpense.materialAmount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col p-2 bg-gray-50 rounded border border-gray-200">
                                        <span className="text-[10px] text-gray-500 font-bold">기타 지출</span>
                                        <span className="text-sm font-bold text-gray-700">₩{summaryExpense.otherAmount.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="mt-2 text-right">
                                    <Button variant="link" size="sm" asChild className="text-blue-600 hover:text-blue-800 p-0 h-auto">
                                        <Link href="/dashboard/simple-expenses" className="flex items-center">
                                            지출 상세 보기 <ChevronRight className="ml-1 h-3 w-3" />
                                        </Link>
                                    </Button>
                                </div>
                            </div >
                        </CardContent >
                    </Card >
                </div >
            )
            }

            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-blue-600 font-medium whitespace-nowrap">오늘 총 매출 (접수 기준)</CardDescription>
                        <CardTitle className="text-2xl font-bold flex items-baseline gap-2">
                            ₩{stats?.totalPayment.toLocaleString()}
                        </CardTitle>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-muted-foreground mr-1">({stats?.orderCount || 0}건)</span>
                            <span className="text-[10px] text-orange-600 font-medium">실질: ₩{stats?.outgoingSettle.toLocaleString()}</span>
                        </div>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>발주 수금액 (내 지분)</CardDescription>
                        <CardTitle className="text-2xl font-bold">₩{stats?.outgoingSettle.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>수주 수익 (이관 지분)</CardDescription>
                        <CardTitle className="text-2xl font-bold">₩{stats?.incomingSettle.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-purple-50/50 border-purple-100">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-purple-600 font-medium">이월 주문 결제 (수금)</CardDescription>
                        <CardTitle className="text-2xl font-bold flex items-baseline gap-2">
                            ₩{stats?.prevOrderPaymentTotal.toLocaleString()}
                            <span className="text-sm font-normal text-muted-foreground">({stats?.previousOrderPayments.length || 0}건)</span>
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-primary font-bold">최종 실질 수익 (당일수금+이월수금)</CardDescription>
                        <CardTitle className="text-2xl font-bold text-primary">₩{stats?.netSales.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* 결제수단별 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card className="border-l-4 border-l-orange-400">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex justify-between items-center">
                            💳 카드 결제
                            <span className="text-xs font-normal text-muted-foreground">{stats?.paymentStats.card.count || 0}건</span>
                        </CardDescription>
                        <CardTitle className="text-xl font-bold text-orange-600">₩{stats?.paymentStats.card.amount.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-l-4 border-l-green-400">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex justify-between items-center">
                            💵 현금 결제
                            <span className="text-xs font-normal text-muted-foreground">{stats?.paymentStats.cash.count || 0}건</span>
                        </CardDescription>
                        <CardTitle className="text-xl font-bold text-green-600">₩{stats?.paymentStats.cash.amount.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-l-4 border-l-blue-400">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex justify-between items-center">
                            🏦 계좌 이체
                            <span className="text-xs font-normal text-muted-foreground">{stats?.paymentStats.transfer.count || 0}건</span>
                        </CardDescription>
                        <CardTitle className="text-xl font-bold text-blue-600">₩{stats?.paymentStats.transfer.amount.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-l-4 border-l-gray-400">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex justify-between items-center">
                            ✨ 기타 결제
                            <span className="text-xs font-normal text-muted-foreground">{stats?.paymentStats.others.count || 0}건</span>
                        </CardDescription>
                        <CardTitle className="text-xl font-bold text-gray-600">₩{stats?.paymentStats.others.amount.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-l-4 border-l-red-500 bg-red-50/10">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold flex justify-between items-center text-red-600">
                            🚩 금일 미결제
                            <span className="text-xs font-normal text-muted-foreground">{stats?.pendingOrdersToday.length || 0}건</span>
                        </CardDescription>
                        <CardTitle className="text-xl font-bold text-red-600">₩{stats?.pendingAmountToday.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        주문 내역 상세
                    </CardTitle>
                    <CardDescription>{reportDate} 주문 현황 및 정산 분배 정보</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[50px]">번호</TableHead>
                                <TableHead>주문시간/번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>결제수단</TableHead>
                                <TableHead>전체금액</TableHead>
                                <TableHead>실질 수익</TableHead>
                                <TableHead>이관/정산 정보</TableHead>
                                <TableHead>상태</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats?.paidOrdersToday.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                        해당 일자의 정산 완료(결제됨)된 주문 내역이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                stats?.paidOrdersToday.map((order, index) => {
                                    const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
                                    let myShare = 0;
                                    let info = "일반 주문";

                                    const isOriginal = order.branchName === currentTargetBranch;
                                    const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;

                                    if (currentTargetBranch === 'all') {
                                        myShare = order.summary.total;
                                        if (order.transferInfo?.isTransferred) {
                                            info = `이관 (${order.branchName} → ${order.transferInfo.processBranchName})`;
                                        }
                                    } else {
                                        if (order.transferInfo?.isTransferred) {
                                            if (isOriginal) {
                                                myShare = Math.round(order.summary.total * (split.orderBranch / 100));
                                            }
                                            if (isProcess) {
                                                myShare += Math.round(order.summary.total * (split.processBranch / 100));
                                            }

                                            // 실제 지분으로 발주/수주 판단
                                            if (myShare > 0) {
                                                if (isOriginal && split.orderBranch > 0) {
                                                    info = `📤 발주 (${split.orderBranch}%)`;
                                                } else if (isProcess && split.processBranch > 0) {
                                                    info = `📥 수주 (${split.processBranch}%)`;
                                                }
                                            } else {
                                                // 지분이 0이면 수주로 표시 (전액 다른 지점으로 넘김)
                                                info = `📥 수주 (0%)`;
                                            }
                                        } else {
                                            myShare = order.summary.total;
                                        }
                                    }

                                    const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();

                                    return (
                                        <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setIsDetailOpen(true);
                                            }}
                                        >
                                            <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-blue-600 font-medium">{format(orderDate, 'HH:mm:ss')}</span>
                                                    <span className="font-mono text-xs">{(order as any).orderNumber || order.id.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{order.orderer.name}</TableCell>
                                            <TableCell className="text-xs">{order.payment.method}</TableCell>
                                            <TableCell className="text-muted-foreground line-through text-[11px]">₩{order.summary.total.toLocaleString()}</TableCell>
                                            <TableCell className="font-bold text-blue-600">₩{myShare.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[11px] font-medium">{info}</span>
                                                    {order.transferInfo?.isTransferred && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {order.transferInfo.originalBranchName} ↔ {order.transferInfo.processBranchName}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={order.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {order.status === 'completed' ? '완료' : '진행중'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-purple-600" />
                        당일 수금 내역 (이월 주문)
                    </CardTitle>
                    <CardDescription>이전 주문 건에 대해 {reportDate}에 결제가 완료된 내역입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[50px]">번호</TableHead>
                                <TableHead>주문일/번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>결제수단</TableHead>
                                <TableHead>전체금액</TableHead>
                                <TableHead>수금액</TableHead>
                                <TableHead>상태</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats?.previousOrderPayments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                        이월 결제 내역이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                stats?.previousOrderPayments.map((order, index) => {
                                    const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
                                    let myShare = 0;
                                    const isOriginal = order.branchName === currentTargetBranch;
                                    const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;

                                    if (currentTargetBranch === 'all') {
                                        myShare = order.summary.total;
                                    } else {
                                        if (isOriginal) {
                                            myShare = order.transferInfo?.isTransferred ? Math.round(order.summary.total * (split.orderBranch / 100)) : order.summary.total;
                                        } else if (isProcess) {
                                            myShare = Math.round(order.summary.total * (split.processBranch / 100));
                                        }
                                    }

                                    const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();

                                    // 수금 시간 추출 (오늘 날짜와 매칭되는 결제 완료 시간)
                                    const completedAt = (order.payment as any).completedAt?.toDate?.() || (order.payment as any).completedAt;
                                    const secondPaymentDate = (order.payment as any).secondPaymentDate?.toDate?.() || (order.payment as any).secondPaymentDate;
                                    let collectionTime = null;
                                    const todayFrom = stats?.from;
                                    const todayTo = stats?.to;

                                    if (todayFrom && todayTo) {
                                        if (completedAt && completedAt >= todayFrom && completedAt <= todayTo) collectionTime = completedAt;
                                        else if (secondPaymentDate && secondPaymentDate >= todayFrom && secondPaymentDate <= todayTo) collectionTime = secondPaymentDate;
                                    }

                                    return (
                                        <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setIsDetailOpen(true);
                                            }}
                                        >
                                            <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground">{format(orderDate, 'yyyy-MM-dd')}</span>
                                                    <span className="font-mono text-xs">{(order as any).orderNumber || order.id.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{order.orderer.name}</TableCell>
                                            <TableCell className="text-xs">{order.payment.method}</TableCell>
                                            <TableCell className="text-muted-foreground line-through text-[11px]">₩{order.summary.total.toLocaleString()}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    {collectionTime && (
                                                        <span className="text-[10px] text-purple-500 font-medium">
                                                            {format(collectionTime, 'HH:mm:ss')} 수금
                                                        </span>
                                                    )}
                                                    <span className="font-bold text-purple-600">₩{myShare.toLocaleString()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={order.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {order.status === 'completed' ? '완료' : '진행중'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500" />
                        금일 미결제 내역
                    </CardTitle>
                    <CardDescription>오늘 접수된 주문 중 아직 결제가 완료되지 않은 내역입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[50px]">번호</TableHead>
                                <TableHead>주문시간/번호</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>전체금액</TableHead>
                                <TableHead>미결금액</TableHead>
                                <TableHead>이관 정보</TableHead>
                                <TableHead>추후 결제 여부</TableHead>
                                <TableHead>상태</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats?.pendingOrdersToday.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                                        오늘 발생한 미결제 내역이 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                stats?.pendingOrdersToday.map((order, index) => {
                                    const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
                                    let myShare = 0;
                                    const isOriginal = order.branchName === currentTargetBranch;
                                    const isValidTransfer = order.transferInfo?.isTransferred && (order.transferInfo?.status === 'accepted' || order.transferInfo?.status === 'completed');

                                    if (currentTargetBranch === 'all') {
                                        myShare = order.summary.total;
                                    } else {
                                        if (isOriginal) {
                                            myShare = isValidTransfer ? Math.round(order.summary.total * (split.orderBranch / 100)) : order.summary.total;
                                        }
                                    }

                                    const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();

                                    // 현재 시점 기준 결제 상태 확인
                                    const currentPaymentStatus = order.payment.status;
                                    const isCurrentlyPaid = currentPaymentStatus === 'paid' || currentPaymentStatus === 'completed';

                                    const completedAtTime = (order.payment as any).completedAt instanceof Timestamp
                                        ? (order.payment as any).completedAt.toDate()
                                        : ((order.payment as any).completedAt ? new Date((order.payment as any).completedAt) : null);

                                    const secondPaymentTime = (order.payment as any).secondPaymentDate instanceof Timestamp
                                        ? (order.payment as any).secondPaymentDate.toDate()
                                        : ((order.payment as any).secondPaymentDate ? new Date((order.payment as any).secondPaymentDate) : null);

                                    const paidTime = completedAtTime || secondPaymentTime;

                                    return (
                                        <TableRow
                                            key={order.id}
                                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                                            onClick={() => {
                                                setSelectedOrder(order);
                                                setIsDetailOpen(true);
                                            }}
                                        >
                                            <TableCell className="text-center text-xs text-muted-foreground">{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-orange-600 font-medium">{format(orderDate, 'HH:mm:ss')}</span>
                                                    <span className="font-mono text-xs">{(order as any).orderNumber || order.id.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{order.orderer.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-[11px]">₩{order.summary.total.toLocaleString()}</TableCell>
                                            <TableCell className="font-bold text-red-600">₩{myShare.toLocaleString()}</TableCell>
                                            <TableCell className="text-xs">
                                                {order.transferInfo?.isTransferred ? (
                                                    <div className="flex flex-col">
                                                        <span>
                                                            {split.orderBranch > 0 && isOriginal ? `📤 발주 (${split.orderBranch}%)` : `📥 수주 (${split.processBranch}%)`}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">{order.transferInfo.processBranchName}</span>
                                                    </div>
                                                ) : '일반'}
                                            </TableCell>
                                            <TableCell>
                                                {isCurrentlyPaid ? (
                                                    <div className="flex flex-col">
                                                        <Badge variant="outline" className="w-fit text-green-600 border-green-200 bg-green-50 mb-1">결제완료</Badge>
                                                        {paidTime && (
                                                            <span className="text-[10px] text-muted-foreground text-xs">
                                                                {format(paidTime, 'MM-dd HH:mm')}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50">미결제</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={order.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                                    {order.status === 'completed' ? '완료' : '진행중'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="bg-gray-50 p-4 rounded-lg border text-sm text-muted-foreground">
                <h4 className="font-bold text-gray-700 mb-2">💡 정산 안내</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li><strong>실질 수익:</strong> 오늘 발생한 주문의 매출액과, 과거 주문에 대해 오늘 수금된 금액을 합산한 총 수익입니다.</li>
                    <li><strong>이월 주문 결제 (수금):</strong> 이전 날짜에 접수된 주문이 미결 상태였으나, 오늘 완결 처리되어 입금된 비중입니다.</li>
                    <li><strong>이관 주문 (📤 발주):</strong> 타 지점에 작업을 맡긴 경우, 설정된 분배율에 따라 수익이 잡힙니다.</li>
                    <li><strong>이관 주문 (📥 수주):</strong> 타 지점의 주문을 받아 작업만 한 경우, 설정된 수익분율에 따라 수익이 잡힙니다.</li>
                    <li>취소된 주문은 정산에 포함되지 않습니다.</li>
                </ul>
            </div>

            <OrderDetailDialog
                isOpen={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                order={selectedOrder}
            />
        </div >
    );
}
