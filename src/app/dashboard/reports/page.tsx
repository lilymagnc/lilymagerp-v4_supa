"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  DollarSign,
  Building2,
  Package,
  CreditCard,
  Users,
  Calendar,
  Download,
  RefreshCw,
  Activity,
  Target,
  ShoppingCart,
  ArrowRightLeft,
  TrendingDown,
  Truck
} from 'lucide-react';
import { useOrders } from '@/hooks/use-orders';
import { useBranches } from '@/hooks/use-branches';
import { useProducts } from '@/hooks/use-products';
import { useCustomers } from '@/hooks/use-customers';
import { useExpenses } from '@/hooks/use-expenses';
import { useStockHistory } from '@/hooks/use-stock-history';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachMonthOfInterval, startOfYear, endOfYear, isSameMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { YearEndExportDialog } from './components/year-end-export-dialog';

// 통계 데이터 타입 정의
interface SalesStats {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  branchSales: Array<{
    branchId: string;
    branchName: string;
    sales: number;
    orders: number;
  }>;
  productSales: Array<{
    productId: string;
    productName: string;
    sales: number;
    quantity: number;
  }>;
  paymentMethodSales: Array<{
    method: string;
    sales: number;
    orders: number;
  }>;
  dailySales: Array<{
    date: string;
    sales: number;
    orders: number;
  }>;
  monthlyData: Array<{
    month: string;
    sales: number;
    expenses: number;
    profit: number;
  }>;
  totalExpenses: number;
  netProfit: number;
  splitPaymentStats: {
    totalSplitPayments: number;
    totalSplitAmount: number;
    firstPaymentAmount: number;
    secondPaymentAmount: number;
  };
  transferStats: {
    outgoingTransferAmount: number; // 내가 발주(분배유입)
    incomingTransferAmount: number; // 내가 수주(분배수익)
    outgoingTransferCount: number;
    incomingTransferCount: number;
  };
  purchaseStats: {
    totalPurchaseAmount: number;
    totalPurchaseCount: number;
    supplierStats: Array<{
      supplier: string;
      amount: number;
      count: number;
    }>;
    topPurchaseItems: Array<{
      name: string;
      amount: number;
      quantity: number;
    }>;
  };
}

export default function StatsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('month'); // 'week', 'month', 'quarter', 'year'
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd')); // 일일 리포트용 날짜
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [comparisonStats, setComparisonStats] = useState<{ yesterday: number; lastMonth: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const { orders, loading: ordersLoading } = useOrders();
  const { branches, loading: branchesLoading } = useBranches();
  const { products, loading: productsLoading } = useProducts();
  const { customers, loading: customersLoading } = useCustomers();
  const { expenses, loading: expensesLoading } = useExpenses();
  const { history: stockHistory, loading: historyLoading } = useStockHistory();

  // 날짜 범위 계산
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'week':
        return {
          from: startOfWeek(now, { locale: ko }),
          to: endOfWeek(now, { locale: ko })
        };
      case 'month':
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        return { from: quarterStart, to: quarterEnd };
      case 'year':
        return {
          from: new Date(now.getFullYear(), 0, 1),
          to: new Date(now.getFullYear(), 11, 31)
        };
      default:
        return {
          from: startOfMonth(now),
          to: endOfMonth(now)
        };
    }
  };

  // 통계 데이터 계산
  const calculateStats = () => {
    if (!orders.length || !branches.length || !products.length) return null;

    const { from, to } = getDateRange();
    const selectedBranchData = branches.find(b => b.id === selectedBranch);
    const selectedBranchName = selectedBranchData?.name;

    const filteredOrders = orders.filter(order => {
      const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();
      const isInDateRange = orderDate >= from && orderDate <= to;

      // 해당 지점이 발주했거나 수주한 주문인 경우 포함
      // ID 기반 매칭뿐만 아니라 이름 기반 매칭도 추가 (ID 중복 문제 해결)
      const isOriginalBranch = order.branchId === selectedBranch || (selectedBranchName && order.branchName === selectedBranchName);
      const isProcessBranch = order.transferInfo?.isTransferred &&
        (order.transferInfo?.processBranchId === selectedBranch || (selectedBranchName && order.transferInfo?.processBranchName === selectedBranchName));
      const isInBranch = selectedBranch === 'all' || isOriginalBranch || isProcessBranch;

      return isInDateRange && isInBranch && order.status !== 'canceled';
    });

    // 기본 통계
    const totalSales = filteredOrders.reduce((sum, order) => sum + order.summary.total, 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // 지점별/상품별/결제수단별/일별 집계 통합 처리
    const branchSalesMap = new Map();
    const productSalesMap = new Map();
    const paymentMethodMap = new Map();
    const dailySalesMap = new Map();

    filteredOrders.forEach(order => {
      const totalAmount = order.summary.total;
      const transfer = order.transferInfo?.isTransferred && (order.transferInfo.status === 'accepted' || order.transferInfo.status === 'completed')
        ? order.transferInfo
        : null;
      const split = transfer ? (transfer.amountSplit || { orderBranch: 100, processBranch: 0 }) : { orderBranch: 100, processBranch: 0 };

      const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();
      const dateKey = format(orderDate, 'yyyy-MM-dd');

      // 1. 발주 지점 지분 정산
      const orderBranchId = order.branchId;
      const orderBranchName = order.branchName || '지점 미지정';
      const orderBranchSales = Math.round(totalAmount * (split.orderBranch / 100));

      // 2. 수주 지점 지분 정산
      const processBranchId = transfer?.processBranchId;
      const processBranchName = transfer?.processBranchName;
      const processBranchSales = Math.round(totalAmount * (split.processBranch / 100));

      // 지점별 매출 맵 업데이트
      // 이름 기반으로 그룹화하여 표시
      if (selectedBranch === 'all' || orderBranchId === selectedBranch || (selectedBranchName && orderBranchName === selectedBranchName)) {
        const b = branchSalesMap.get(orderBranchName) || { branchId: orderBranchId, branchName: orderBranchName, sales: 0, orders: 0 };
        b.sales += orderBranchSales;
        b.orders += 1;
        branchSalesMap.set(orderBranchName, b);
      }

      if (processBranchId && (selectedBranch === 'all' || processBranchId === selectedBranch || (selectedBranchName && processBranchName === selectedBranchName))) {
        if (processBranchSales > 0 || (selectedBranch !== 'all' && (processBranchId === selectedBranch || (selectedBranchName && processBranchName === selectedBranchName)))) {
          const b = branchSalesMap.get(processBranchName) || { branchId: processBranchId, branchName: processBranchName, sales: 0, orders: 0 };
          b.sales += processBranchSales;
          b.orders += 1;
          branchSalesMap.set(processBranchName, b);
        }
      }

      // 현재 컨텍스트(선택된 지점)에서의 실질 수익 계산 (일별/상품별/결제수단별 집계용)
      let contextSales = 0;
      let participated = false;

      if (selectedBranch === 'all') {
        contextSales = totalAmount; // 전체 보기 시에는 100%
        participated = true;
      } else {
        if (orderBranchId === selectedBranch || (selectedBranchName && orderBranchName === selectedBranchName)) {
          contextSales += orderBranchSales;
          participated = true;
        }
        if (processBranchId === selectedBranch || (selectedBranchName && processBranchName === selectedBranchName)) {
          contextSales += processBranchSales;
          participated = true;
        }
      }

      if (participated) {
        // 일별 매출
        const d = dailySalesMap.get(dateKey) || { date: dateKey, sales: 0, orders: 0 };
        d.sales += contextSales;
        d.orders += 1;
        dailySalesMap.set(dateKey, d);

        // 상품별 매출
        order.items.forEach(item => {
          const product = products.find(p => p.id === item.id);
          if (product) {
            const p = productSalesMap.get(item.id) || { productId: item.id, productName: product.name, sales: 0, quantity: 0 };
            const itemOriginalSales = item.price * item.quantity;
            const itemContextSales = selectedBranch === 'all' ? itemOriginalSales : Math.round(itemOriginalSales * (contextSales / (totalAmount || 1)));
            p.sales += itemContextSales;
            p.quantity += item.quantity;
            productSalesMap.set(item.id, p);
          }
        });

        // 결제수단별 매출
        const method = order.payment.method;
        if (method) {
          const pm = paymentMethodMap.get(method) || { method, sales: 0, orders: 0 };
          pm.sales += contextSales;
          pm.orders += 1;
          paymentMethodMap.set(method, pm);
        }
      }
    });

    // 분할결제 통계 (단순 건수/전체금액 기록 - 필터링된 주문 기준)
    const splitPaymentOrders = filteredOrders.filter(order => order.payment.isSplitPayment);
    const splitPaymentStats = {
      totalSplitPayments: splitPaymentOrders.length,
      totalSplitAmount: splitPaymentOrders.reduce((sum, order) => sum + order.summary.total, 0),
      firstPaymentAmount: splitPaymentOrders.reduce((sum, order) => sum + (order.payment.firstPaymentAmount || 0), 0),
      secondPaymentAmount: splitPaymentOrders.reduce((sum, order) => sum + (order.payment.secondPaymentAmount || 0), 0)
    };

    // 이관 통계 계산 (분배율 반영)
    let outgoingTransferAmount = 0;
    let incomingTransferAmount = 0;
    let outgoingTransferCount = 0;
    let incomingTransferCount = 0;

    filteredOrders.forEach(order => {
      const isTransferred = order.transferInfo?.isTransferred;
      if (!isTransferred) return;

      const transferStatus = order.transferInfo?.status;
      if (transferStatus !== 'accepted' && transferStatus !== 'completed') return;

      const orderBranchId = order.transferInfo?.originalBranchId;
      const processBranchId = order.transferInfo?.processBranchId;
      const amountSplit = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
      const totalAmount = order.summary.total;

      // 내가 발주 지점인 경우 (outgoing)
      if (orderBranchId === order.branchId) {
        outgoingTransferCount++;
        // 발주지점 매출 = 전체금액 * (발주분배율 / 100)
        // 사용자가 100:0 이라고 했으므로 기본은 100% 다 가져감
        outgoingTransferAmount += Math.round(totalAmount * (amountSplit.orderBranch / 100));
      }
      // 내가 수주 지점인 경우 (incoming)
      else if (processBranchId === order.branchId) {
        incomingTransferCount++;
        // 수주지점 매출 = 전체금액 * (수주분배율 / 100)
        // 기본 0% 라면 매출에 잡히지 않음
        incomingTransferAmount += Math.round(totalAmount * (amountSplit.processBranch / 100));
      }
    });

    // 지출 통계 계산
    const filteredExpenses = expenses.filter(expense => {
      const expenseDate = expense.createdAt?.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
      const isInDateRange = expenseDate >= from && expenseDate <= to;
      const isInBranch = selectedBranch === 'all' || expense.branchId === selectedBranch;

      // 승인되거나 지급된 지출만 포함
      return isInDateRange && isInBranch && (expense.status === 'approved' || expense.status === 'paid');
    });

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.totalAmount, 0);

    // 연간 월별 데이터 집계 (차트용)
    const monthlyDataMap = new Map();
    if (dateRange === 'year') {
      const months = eachMonthOfInterval({ start: from, end: to });
      months.forEach(m => {
        const monthKey = format(m, 'yyyy-MM');
        monthlyDataMap.set(monthKey, { month: format(m, 'MM월'), sales: 0, expenses: 0, profit: 0 });
      });

      // 매출 가산
      filteredOrders.forEach(order => {
        const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();
        const monthKey = format(orderDate, 'yyyy-MM');
        if (monthlyDataMap.has(monthKey)) {
          const data = monthlyDataMap.get(monthKey);

          // 실질 매출 계산 (이관 포함)
          let contextSales = 0;
          const totalAmount = order.summary.total;
          const transfer = order.transferInfo?.isTransferred && (order.transferInfo.status === 'accepted' || order.transferInfo.status === 'completed')
            ? order.transferInfo
            : null;
          const split = transfer ? (transfer.amountSplit || { orderBranch: 100, processBranch: 0 }) : { orderBranch: 100, processBranch: 0 };

          if (selectedBranch === 'all') {
            contextSales = totalAmount;
          } else {
            if (order.branchId === selectedBranch || (selectedBranchName && order.branchName === selectedBranchName))
              contextSales += Math.round(totalAmount * (split.orderBranch / 100));
            if (transfer?.processBranchId === selectedBranch || (selectedBranchName && transfer?.processBranchName === selectedBranchName))
              contextSales += Math.round(totalAmount * (split.processBranch / 100));
          }

          data.sales += contextSales;
        }
      });

      // 지출 가산
      filteredExpenses.forEach(expense => {
        const expenseDate = expense.createdAt?.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
        const monthKey = format(expenseDate, 'yyyy-MM');
        if (monthlyDataMap.has(monthKey)) {
          const data = monthlyDataMap.get(monthKey);
          data.expenses += expense.totalAmount;
        }
      });

      // 순이익 계산
      monthlyDataMap.forEach(data => {
        data.profit = data.sales - data.expenses;
      });
    }

    // 최종 실질 매출 계산 (이미 분배율이 적용된 집계 데이터의 합)
    let netTotalSales = 0;
    dailySalesMap.forEach(d => { netTotalSales += d.sales; });

    return {
      totalSales: netTotalSales,
      totalExpenses,
      netProfit: netTotalSales - totalExpenses,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? netTotalSales / totalOrders : 0,
      branchSales: Array.from(branchSalesMap.values()).sort((a, b) => b.sales - a.sales),
      productSales: Array.from(productSalesMap.values()).sort((a, b) => b.sales - a.sales).slice(0, 10),
      paymentMethodSales: Array.from(paymentMethodMap.values()).sort((a, b) => b.sales - a.sales),
      dailySales: Array.from(dailySalesMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      monthlyData: Array.from(monthlyDataMap.values()),
      splitPaymentStats,
      transferStats: {
        outgoingTransferAmount,
        incomingTransferAmount,
        outgoingTransferCount,
        incomingTransferCount
      },
      purchaseStats: calculatePurchaseStats(from, to, selectedBranchName)
    };
  };

  // 매입 통계 별도 계산
  const calculatePurchaseStats = (from: Date, to: Date, branchName?: string) => {
    const purchases = stockHistory.filter(h => {
      const date = new Date(h.date);
      const isInDateRange = date >= from && date <= to;
      const isInBranch = !branchName || h.branch === branchName;
      return isInDateRange && isInBranch && h.type === 'in';
    });

    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const totalPurchaseCount = purchases.length;

    const supplierMap = new Map();
    const itemMap = new Map();

    purchases.forEach(p => {
      const supplier = p.supplier || '미지정';
      const amount = p.totalAmount || 0;

      const s = supplierMap.get(supplier) || { supplier, amount: 0, count: 0 };
      s.amount += amount;
      s.count += 1;
      supplierMap.set(supplier, s);

      const itemName = p.itemName;
      const item = itemMap.get(itemName) || { name: itemName, amount: 0, quantity: 0 };
      item.amount += amount;
      item.quantity += p.quantity;
      itemMap.set(itemName, item);
    });

    return {
      totalPurchaseAmount,
      totalPurchaseCount,
      supplierStats: Array.from(supplierMap.values()).sort((a, b) => b.amount - a.amount),
      topPurchaseItems: Array.from(itemMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 10)
    };
  };

  // 통계 데이터 업데이트
  useEffect(() => {
    if (!ordersLoading && !branchesLoading && !productsLoading && !expensesLoading && !historyLoading) {
      const newStats = calculateStats();
      setStats(newStats);

      // 어제 매출 비교 로직 추가
      const yesterday = subDays(new Date(), 1);
      const yesterdayOrders = orders.filter(order => {
        const orderDate = order.orderDate instanceof Date ? order.orderDate : order.orderDate.toDate();
        return format(orderDate, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd') && order.status !== 'canceled';
      });
      const yesterdaySales = yesterdayOrders.reduce((sum, order) => sum + order.summary.total, 0);
      setComparisonStats({ yesterday: yesterdaySales, lastMonth: 0 }); // 단순화를 위해 어제 매출만 계산

      setLoading(false);
    }
  }, [orders, branches, products, dateRange, selectedBranch, reportDate]);

  // 결제수단 한글 변환
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'card': return '카드';
      case 'cash': return '현금';
      case 'transfer': return '계좌이체';
      case 'mainpay': return '메인페이';
      case 'shopping_mall': return '쇼핑몰';
      case 'epay': return '이페이';
      default: return method;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">통계 데이터를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">통계 대시보드</h1>
          <p className="text-muted-foreground mt-1">
            매출, 상품, 결제수단별 종합 통계를 확인하세요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">이번 주</SelectItem>
              <SelectItem value="month">이번 달</SelectItem>
              <SelectItem value="quarter">이번 분기</SelectItem>
              <SelectItem value="year">올해</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 지점</SelectItem>
              {branches.map(branch => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <YearEndExportDialog />
        </div>
      </div>

      {/* 주요 지표 카드 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">실질 매출</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">₩{stats.totalSales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                VAT 별도: ₩{Math.round(stats.totalSales / 1.1).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 지출액</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₩{stats.totalExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                신청 및 지급 완료 기준
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">실질 순이익</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-green-600' : 'text-red-700'}`}>
                ₩{stats.netProfit.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                이익률: {stats.totalSales > 0 ? ((stats.netProfit / stats.totalSales) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">평균 주문금액</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₩{Math.round(stats.averageOrderValue).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                주문당 평균 금액
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 메인 통계 탭 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            개요
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            매출 분석
          </TabsTrigger>
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            상품 분석
          </TabsTrigger>
          <TabsTrigger value="settlement" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            정산 분석
          </TabsTrigger>
          <TabsTrigger value="purchase" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            매입 분석
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            결제 분석
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 지점별 매출 차트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  지점별 매출 현황
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.branchSales.length > 0 ? (
                  <div className="space-y-4">
                    {stats.branchSales.map((branch, index) => (
                      <div key={branch.branchId} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${index * 40}, 70%, 50%)` }} />
                          <span className="text-sm font-medium">{branch.branchName}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">₩{branch.sales.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{branch.orders}건</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    매출 데이터가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 결제수단별 매출 차트 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  결제수단별 매출
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.paymentMethodSales.length > 0 ? (
                  <div className="space-y-4">
                    {stats.paymentMethodSales.map((payment, index) => (
                      <div key={payment.method} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }} />
                          <span className="text-sm font-medium">{getPaymentMethodText(payment.method)}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">₩{payment.sales.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">{payment.orders}건</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    결제 데이터가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="sales" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 기간별 매출 추이 */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  {dateRange === 'year' ? '월별 수익 추이' : '일별 매출 추이'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && (dateRange === 'year' ? stats.monthlyData.length > 0 : stats.dailySales.length > 0) ? (
                  <div className="space-y-6">
                    {dateRange === 'year' ? (
                      <div className="space-y-4">
                        {stats.monthlyData.map((data) => (
                          <div key={data.month} className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                              <span>{data.month}</span>
                              <div className="flex gap-4">
                                <span className="text-blue-600">매출: ₩{data.sales.toLocaleString()}</span>
                                <span className="text-red-500">지출: ₩{data.expenses.toLocaleString()}</span>
                                <span className="font-bold">이익: ₩{data.profit.toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full flex overflow-hidden">
                              <div
                                className="bg-blue-500 h-full"
                                style={{ width: `${stats.totalSales > 0 ? (data.sales / stats.totalSales * 100) : 0}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {stats.dailySales.slice(-10).map((day) => (
                          <div key={day.date} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{format(new Date(day.date), 'MM/dd (E)', { locale: ko })}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm">₩{day.sales.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{day.orders}건</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    데이터가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settlement" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                  이관 발주 내역 (Outgoing)
                </CardTitle>
                <CardDescription>타 지점에 주문을 이관하여 발생한 비용/수익</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-muted-foreground">총 이관 발주</p>
                      <p className="text-2xl font-bold">{stats?.transferStats.outgoingTransferCount}건</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">발주 지점 실질 수익</p>
                      <p className="text-2xl font-bold text-blue-600">₩{stats?.transferStats.outgoingTransferAmount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
                    * 우리 지점에서 접수한 주문을 타 지점으로 보냈을 때, 설정된 분배율에 따라 우리 지점에 남는 최종 수익입니다.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  이관 수주 내역 (Incoming)
                </CardTitle>
                <CardDescription>타 지점으로부터 주문을 받아 처리한 수익</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-muted-foreground">총 이관 수주</p>
                      <p className="text-2xl font-bold">{stats?.transferStats.incomingTransferCount}건</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">수주 지점 실질 수익</p>
                      <p className="text-2xl font-bold text-green-600">₩{stats?.transferStats.incomingTransferAmount.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded-lg">
                    * 타 지점에서 접수한 주문을 우리 지점이 대신 처리했을 때, 설정된 분배율에 따라 우리 지점이 가지는 정산 수익입니다.
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>분할결제 상제 현황</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">전체 분할결제</p>
                    <p className="text-xl font-bold">{stats?.splitPaymentStats.totalSplitPayments}건</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-700">선결제 합계</p>
                    <p className="text-xl font-bold text-green-700">₩{stats?.splitPaymentStats.firstPaymentAmount.toLocaleString()}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-sm text-orange-700">후결제(미결) 합계</p>
                    <p className="text-xl font-bold text-orange-700">₩{stats?.splitPaymentStats.secondPaymentAmount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="purchase" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">총 매입액</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  ₩{stats?.purchaseStats.totalPurchaseAmount.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  총 {stats?.purchaseStats.totalPurchaseCount}건의 입고/매입
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">주요 거래처</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">
                  {stats?.purchaseStats.supplierStats[0]?.supplier || '-'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  최대 매입처 기준
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">매입 건당 평균</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ₩{stats?.purchaseStats.totalPurchaseCount ? Math.round(stats.purchaseStats.totalPurchaseAmount / stats.purchaseStats.totalPurchaseCount).toLocaleString() : 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  1회 매입 시 평균 지출액
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  거래처별 매입 분포
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.purchaseStats.supplierStats.map((s, index) => (
                    <div key={s.supplier} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">
                          {index + 1}
                        </div>
                        <span className="text-sm font-medium">{s.supplier}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">₩{s.amount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{s.count}건</div>
                      </div>
                    </div>
                  ))}
                  {stats?.purchaseStats.supplierStats.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">매입 데이터가 없습니다.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  많이 매입한 자재 TOP 10
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.purchaseStats.topPurchaseItems.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium truncate max-w-[150px]">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">₩{item.amount.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{item.quantity}개</div>
                      </div>
                    </div>
                  ))}
                  {stats?.purchaseStats.topPurchaseItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">매입 데이터가 없습니다.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                인기 상품 TOP 10
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats && stats.productSales.length > 0 ? (
                <div className="space-y-4">
                  {stats.productSales.map((product, index) => (
                    <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{product.productName}</div>
                          <div className="text-sm text-muted-foreground">{product.quantity}개 판매</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">₩{product.sales.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">
                          평균 ₩{Math.round(product.sales / product.quantity).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  상품 데이터가 없습니다
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 분할결제 상세 분석 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  분할결제 분석
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.splitPaymentStats.totalSplitPayments > 0 ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-700">선결제</span>
                      <span className="font-bold text-green-700">₩{stats.splitPaymentStats.firstPaymentAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                      <span className="text-sm font-medium text-orange-700">후결제</span>
                      <span className="font-bold text-orange-700">₩{stats.splitPaymentStats.secondPaymentAmount.toLocaleString()}</span>
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      총 {stats.splitPaymentStats.totalSplitPayments}건의 분할결제
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    분할결제 데이터가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 결제수단 상세 분석 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  결제수단 상세
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats && stats.paymentMethodSales.length > 0 ? (
                  <div className="space-y-3">
                    {stats.paymentMethodSales.map((payment) => {
                      const percentage = stats.totalSales > 0 ? (payment.sales / stats.totalSales * 100) : 0;
                      return (
                        <div key={payment.method} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{getPaymentMethodText(payment.method)}</span>
                            <span className="text-sm font-bold">₩{payment.sales.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{payment.orders}건</span>
                            <span>{percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    결제 데이터가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}