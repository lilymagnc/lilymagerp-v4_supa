"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Building, DollarSign, Package, Users, TrendingUp, Calendar,
  CalendarDays, ShoppingCart, CheckSquare, AlertCircle, Clock, Truck
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { useCalendar } from "@/hooks/use-calendar";
import { useOrders } from "@/hooks/use-orders";
import {
  format, startOfWeek, endOfWeek, parseISO, isToday, startOfYear
} from "date-fns";
import { ko } from "date-fns/locale";
import { getWeatherInfo, WeatherInfo } from "@/lib/weather-service";
import BulletinBoard from '@/components/dashboard/bulletin-board';
import { fetchDailyStats, sanitizeBranchKey } from "@/lib/stats-utils";
import { parseDate as parseDateUtil } from "@/lib/date-utils";

// --- Interfaces ---
interface DashboardStats {
  totalRevenue: number;
  newCustomers: number;
  weeklyOrders: number;
  pendingOrders: number;
  pendingPaymentCount: number;
  pendingPaymentAmount: number;
}

interface Order {
  id: string;
  orderer: {
    name: string;
    contact: string;
    company: string;
    email: string;
  };
  orderDate: any;
  total: number;
  status: string;
  branchName: string;
  productNames?: string;
  items?: any[];
  summary?: any;
  payment?: any;
  deliveryInfo?: any;
  pickupInfo?: any;
  receiptType?: string;
  transferInfo?: any;
}

interface DailySalesData {
  date: string;
  sales?: number;
  totalSales?: number;
  [key: string]: any;
}

// --- Helper Functions (Static) ---
const koreanWeekdays = ['일', '월', '화', '수', '목', '금', '토'];

function calculateWeeklyStats(
  statsData: any[],
  startDate: string,
  endDate: string,
  isAllBranches: boolean,
  branchFilter: string | null,
  branches: any[]
) {
  const weeklyMap: { [key: string]: any } = {};

  statsData.forEach(day => {
    if (day.date < startDate || day.date > endDate) return;

    const dateObj = parseISO(day.date);
    const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'RRRR-II');

    if (!weeklyMap[weekKey]) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekStartLabel = format(weekStart, 'M/d');
      const weekEndLabel = format(weekEnd, 'M/d');

      weeklyMap[weekKey] = {
        week: `${weekStartLabel} - ${weekEndLabel}`,
        sortKey: weekKey,
        weekRange: `${format(weekStart, 'yyyy-MM-dd')} ~ ${format(weekEnd, 'yyyy-MM-dd')}`,
        sales: 0,
        totalSales: 0
      };
    }

    if (isAllBranches) {
      weeklyMap[weekKey].sales += day.totalSettledAmount || 0;
      if (day.branches) {
        Object.entries(day.branches).forEach(([bKey, bStat]: [string, any]) => {
          const amount = bStat.settledAmount || 0;
          const branchName = bKey.replace(/_/g, '.');
          weeklyMap[weekKey][branchName] = (weeklyMap[weekKey][branchName] || 0) + amount;
        });
      }
    } else if (branchFilter) {
      const bKey = sanitizeBranchKey(branchFilter);
      const bStat = day.branches?.[bKey];
      const amount = bStat?.settledAmount || 0;
      weeklyMap[weekKey].sales += amount;
      weeklyMap[weekKey][branchFilter] = (weeklyMap[weekKey][branchFilter] || 0) + amount;
    }
  });

  return Object.values(weeklyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function calculateMonthlyStats(
  statsData: any[],
  startDate: string,
  endDate: string,
  isAllBranches: boolean,
  branchFilter: string | null,
  branches: any[]
) {
  const monthlyMap: { [key: string]: any } = {};

  statsData.forEach(day => {
    if (day.date < startDate || day.date > endDate) return;

    const dateObj = parseISO(day.date);
    const monthKey = format(dateObj, 'yyyy-MM');
    const monthLabel = format(dateObj, 'M월');

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: monthLabel,
        sortKey: monthKey,
        sales: 0,
        totalSales: 0
      };
    }

    if (isAllBranches) {
      monthlyMap[monthKey].sales += day.totalSettledAmount || 0;
      if (day.branches) {
        Object.entries(day.branches).forEach(([bKey, bStat]: [string, any]) => {
          const amount = bStat.settledAmount || 0;
          const branchName = bKey.replace(/_/g, '.');
          monthlyMap[monthKey][branchName] = (monthlyMap[monthKey][branchName] || 0) + amount;
        });
      }
    } else if (branchFilter) {
      const bKey = sanitizeBranchKey(branchFilter);
      const bStat = day.branches?.[bKey];
      const amount = bStat?.settledAmount || 0;
      monthlyMap[monthKey].sales += amount;
      monthlyMap[monthKey][branchFilter] = (monthlyMap[monthKey][branchFilter] || 0) + amount;
    }
  });

  return Object.values(monthlyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export default function DashboardPage() {
  const router = useRouter();
  const { branches } = useBranches();
  const { user } = useAuth();
  const { events: calendarEvents } = useCalendar();
  const { orders } = useOrders();

  // --- Auth & Role Logic (Early Exit/Memo) ---
  const isAdmin = useMemo(() => {
    if (!user?.role) return false;
    const role = user.role.trim();
    const email = user.email?.toLowerCase();
    return (
      (role as any) === '본사 관리자' ||
      (role as any) === 'admin' ||
      (role as any) === 'hq_manager' ||
      email === 'lilymag0301@gmail.com'
    );
  }, [user?.role, user?.email]);

  const userBranch = user?.franchise || "";

  // --- State Definitions ---
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    newCustomers: 0,
    weeklyOrders: 0,
    pendingOrders: 0,
    pendingPaymentCount: 0,
    pendingPaymentAmount: 0,
  });

  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);
  const [statsEmpty, setStatsEmpty] = useState(false);

  // 차트 데이터 상태
  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [weeklySales, setWeeklySales] = useState<any[]>([]);
  const [monthlySales, setMonthlySales] = useState<any[]>([]);

  // 날짜 필터 상태
  const [dailyStartDate, setDailyStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd'));
  const [dailyEndDate, setDailyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weeklyStartDate, setWeeklyStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 28)), 'yyyy-MM-dd'));
  const [weeklyEndDate, setWeeklyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monthlyStartDate, setMonthlyStartDate] = useState(format(new Date(new Date().setMonth(new Date().getMonth() - 5)), 'yyyy-MM-dd'));
  const [monthlyEndDate, setMonthlyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('전체');

  // --- Callbacks & Utilities ---
  const formatCurrency = useCallback((value: number) => `₩${value.toLocaleString()}`, []);

  const formatDate = useCallback((date: any) => {
    const parsed = parseDateUtil(date);
    if (!parsed) return '날짜 없음';
    return format(parsed, 'yyyy-MM-dd');
  }, []);

  const getStatusBadge = useCallback((status: string) => {
    const statusMap: { [key: string]: { text: string; color: string } } = {
      'completed': { text: '완료', color: 'bg-green-100 text-green-800' },
      'processing': { text: '처리중', color: 'bg-blue-100 text-blue-800' },
      'pending': { text: '대기', color: 'bg-yellow-101 text-yellow-800' },
      'canceled': { text: '취소', color: 'bg-red-101 text-red-800' },
    };
    const result = statusMap[status] || { text: status, color: 'bg-gray-101 text-gray-800' };
    return <Badge className={result.color}>{result.text}</Badge>;
  }, []);

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const payloadData = payload[0]?.payload;
      const rangeText = payloadData?.weekRange;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium mb-2">{label}</p>
          {rangeText && (
            <p className="text-xs text-gray-500 mb-2">{rangeText}</p>
          )}
          {isAdmin ? (
            <div>
              {payload.map((entry: any, index: number) => (
                <p key={index} className="text-sm" style={{ color: entry.color }}>
                  {entry.name}: {formatCurrency(entry.value)}
                </p>
              ))}
              {payload.length > 1 && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-sm font-semibold text-gray-800">
                    총액: {formatCurrency(payload.reduce((sum: number, entry: any) => sum + entry.value, 0))}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: payload[0].color }}>
              매출: {formatCurrency(payload[0].value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  }, [isAdmin, formatCurrency]);

  const handleCloseOrderDetail = useCallback(() => {
    setOrderDetailDialogOpen(false);
    setSelectedOrder(null);
  }, []);

  // --- Memoized Values ---
  const availableBranches = useMemo(() => {
    if (isAdmin) {
      return branches.filter(b => b.type !== '본사');
    } else {
      return branches.filter(branch => branch.name === userBranch);
    }
  }, [branches, isAdmin, userBranch]);

  const currentFilteredBranch = useMemo(() => {
    if (isAdmin) {
      return selectedBranchFilter === '전체' ? null : selectedBranchFilter;
    } else {
      return userBranch;
    }
  }, [isAdmin, selectedBranchFilter, userBranch]);

  const todayAndTomorrowEvents = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const convertOrdersToEvents = orders.map(order => ({
      id: `order-${order.id}`,
      title: `${order.orderer?.name || '주문자'} - ${order.productNames || '상품'}`,
      startDate: order.deliveryInfo?.date || order.pickupInfo?.date || order.orderDate,
      type: order.pickupInfo ? 'pickup' : 'delivery',
      orderId: order.id
    }));

    const allEvents = [...calendarEvents, ...convertOrdersToEvents];

    return allEvents.filter(event => {
      const eventDate = new Date(event.startDate);
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

      return eventDateOnly.getTime() === todayOnly.getTime() ||
        eventDateOnly.getTime() === tomorrowOnly.getTime();
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [calendarEvents, orders]);

  const branchColors = [
    '#FF8C00', '#32CD32', '#4682B4', '#DAA520', '#FF6347', '#9370DB', '#20B2AA', '#FF69B4'
  ];

  const getBranchColor = (index: number) => {
    return branchColors[index % branchColors.length];
  };

  const handleDailyDateChange = (startDate: string, endDate: string) => {
    setDailyStartDate(startDate);
    setDailyEndDate(endDate);
  };

  const handleWeeklyDateChange = (startDate: string, endDate: string) => {
    setWeeklyStartDate(startDate);
    setWeeklyEndDate(endDate);
  };

  const handleMonthlyDateChange = (startDate: string, endDate: string) => {
    setMonthlyStartDate(startDate);
    setMonthlyEndDate(endDate);
  };

  const handleOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailDialogOpen(true);
  };

  // --- Data Fetching Logic (Unified Supabase Engine) ---
  const fetchDashboardData = useCallback(async () => {
    if (!user || (branches.length === 0 && !isAdmin)) return;

    setLoading(true);
    try {
      const branchFilter = currentFilteredBranch;
      const now = new Date();
      const yearStartStr = format(startOfYear(now), 'yyyy-MM-dd');
      const todayStr = format(now, 'yyyy-MM-dd');

      // 1. 최근 주문 (Limit 10)
      const fetchRecentOrders = async () => {
        let queryBuilder = supabase
          .from('orders')
          .select('*')
          .order('order_date', { ascending: false })
          .limit(10);

        if (branchFilter) {
          queryBuilder = queryBuilder.or(`branch_name.eq.${branchFilter},transfer_info->>processBranchName.eq.${branchFilter}`);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;

        return (data || []).map((row: any) => {
          let productNames = '상품 정보 없음';
          const items = row.items || [];
          if (Array.isArray(items) && items.length > 0) {
            productNames = items.slice(0, 2).map((item: any) => item.name || item.productName || '상품명').join(', ');
            if (items.length > 2) productNames += ` 외 ${items.length - 2}건`;
          }
          return {
            ...row,
            id: row.id,
            orderDate: parseDateUtil(row.order_date),
            total: row.summary?.total || 0,
            productNames
          } as Order;
        });
      };

      // 2. 대기 및 미결 통계 (Head Count Only for Efficiency)
      const fetchPendingStats = async () => {
        let pendingOrdersQuery = supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing', '대기', '준비중', '처리중']);

        if (branchFilter) {
          pendingOrdersQuery = pendingOrdersQuery.or(`branch_name.eq.${branchFilter},transfer_info->>processBranchName.eq.${branchFilter}`);
        }

        let pendingPaymentQuery = supabase
          .from('orders')
          .select('summary')
          .in('payment->>status', ['pending', '미결', '대기'])
          .not('status', 'eq', 'canceled');

        if (branchFilter) {
          pendingPaymentQuery = pendingPaymentQuery.or(`branch_name.eq.${branchFilter},transfer_info->>processBranchName.eq.${branchFilter}`);
        }

        const [pendingCountRes, paymentRes] = await Promise.all([
          pendingOrdersQuery,
          pendingPaymentQuery
        ]);

        const pOrders = pendingCountRes.count || 0;
        const pPaymentCount = paymentRes.data?.length || 0;
        const pPaymentAmount = paymentRes.data?.reduce((acc: number, curr: any) => acc + (Number(curr.summary?.total) || 0), 0) || 0;

        return { pOrders, pPaymentCount, pPaymentAmount };
      };

      // 3. 서버 측 집계된 통계 데이터 (daily_stats 테이블 활용)
      const fetchStats = async () => {
        const earliestDate = [dailyStartDate, weeklyStartDate, monthlyStartDate, yearStartStr].sort()[0];
        return await fetchDailyStats(earliestDate, todayStr);
      };

      // 4. 고객 수
      const fetchCustomerCount = async () => {
        let countQuery = supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('is_deleted', false);

        if (branchFilter) {
          countQuery = countQuery.eq('branch', branchFilter);
        }
        const { count, error } = await countQuery;
        if (error) throw error;
        return count || 0;
      };

      const results = await Promise.allSettled([
        fetchRecentOrders(),
        fetchPendingStats(),
        fetchStats(),
        fetchCustomerCount()
      ]);

      // Handle Results
      if (results[0].status === 'fulfilled') setRecentOrders(results[0].value);
      if (results[1].status === 'fulfilled') {
        const { pOrders, pPaymentCount, pPaymentAmount } = results[1].value;
        setStats(prev => ({ ...prev, pendingOrders: pOrders, pendingPaymentCount: pPaymentCount, pendingPaymentAmount: pPaymentAmount }));
      }
      if (results[3].status === 'fulfilled') setStats(prev => ({ ...prev, newCustomers: results[3].value }));

      if (results[2].status === 'fulfilled') {
        const statsData = results[2].value;
        if (statsData.length === 0) {
          setStatsEmpty(true);
        } else {
          setStatsEmpty(false);
          let totalRevenue = 0;
          let weeklyOrders = 0;
          const weekStartStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

          statsData.forEach((day: any) => {
            const isThisYear = day.date >= yearStartStr;
            const isThisWeek = day.date >= weekStartStr;

            if (branchFilter) {
              const bKey = sanitizeBranchKey(branchFilter);
              const branchStat = day.branches?.[bKey];
              if (branchStat) {
                if (isThisYear) totalRevenue += branchStat.settledAmount || 0;
                if (isThisWeek) weeklyOrders += branchStat.orderCount || 0;
              }
            } else {
              if (isThisYear) totalRevenue += day.totalSettledAmount || 0;
              if (isThisWeek) weeklyOrders += day.totalOrderCount || 0;
            }
          });

          setStats(prev => ({ ...prev, totalRevenue, weeklyOrders }));

          // Process Chart Data
          const statsMap = new Map();
          statsData.forEach(d => statsMap.set(d.date, d));

          const dailyData: DailySalesData[] = [];
          let currentD = parseISO(dailyStartDate);
          const endD = parseISO(dailyEndDate);

          while (currentD <= endD) {
            const dateStr = format(currentD, 'yyyy-MM-dd');
            const day = statsMap.get(dateStr) || { date: dateStr, totalSettledAmount: 0, branches: {} };
            const weekday = koreanWeekdays[currentD.getDay()];
            const label = `${format(currentD, 'M/d')} (${weekday})`;
            const result: any = { date: label, totalSales: day.totalSettledAmount || 0 };

            if (day.branches) {
              Object.entries(day.branches).forEach(([bKey, bStat]: [string, any]) => {
                result[bKey.replace(/_/g, '.')] = bStat.settledAmount || 0;
              });
            }

            if (branchFilter) {
              const bKey = sanitizeBranchKey(branchFilter);
              result.sales = day.branches?.[bKey]?.settledAmount || 0;
            }

            dailyData.push(result);
            currentD = new Date(currentD.setDate(currentD.getDate() + 1));
          }
          setDailySales(dailyData);

          setWeeklySales(calculateWeeklyStats(statsData, weeklyStartDate, weeklyEndDate, !branchFilter, branchFilter, branches));
          setMonthlySales(calculateMonthlyStats(statsData, monthlyStartDate, monthlyEndDate, !branchFilter, branchFilter, branches));
        }
      }
    } catch (error) {
      console.error("Dashboard Data Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }, [user, branches, currentFilteredBranch, dailyStartDate, dailyEndDate, weeklyStartDate, weeklyEndDate, monthlyStartDate, monthlyEndDate, isAdmin]);

  // --- Effects ---
  useEffect(() => {
    async function fetchWeatherData() {
      try {
        const weather = await getWeatherInfo();
        setWeatherInfo(weather);
      } catch (e) { }
    }
    fetchWeatherData();
    const weatherInterval = setInterval(fetchWeatherData, 30 * 60 * 1000);
    return () => clearInterval(weatherInterval);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // 실시간 동기화 (Debounced/Throttled via single channel)
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_stats' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(() => { });
    };
  }, [fetchDashboardData]);

  // --- Render Helpers ---
  const getDashboardTitle = () => {
    if (isAdmin) return currentFilteredBranch ? `${currentFilteredBranch} 대시보드` : '전체 대시보드';
    return userBranch ? `${userBranch} 대시보드` : '나의 대시보드';
  };

  if (loading) {
    return (
      <div className="space-y-4 max-h-screen overflow-y-auto">
        <PageHeader title={getDashboardTitle()} description="데이터를 불러오는 중입니다..." />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse h-32 bg-gray-50"></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-screen overflow-y-auto pb-10">
      <PageHeader
        title={getDashboardTitle()}
        description={currentFilteredBranch ? `${currentFilteredBranch}의 현황입니다.` : '시스템 전체 현황입니다.'}
      />
      <BulletinBoard />

      {statsEmpty && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertCircle className="h-6 w-6" />
                <div>
                  <p className="font-bold">통계 데이터가 없습니다.</p>
                  <p className="text-sm">설정에서 데이터 집계를 실행해주세요.</p>
                </div>
              </div>
              <Button onClick={() => router.push('/dashboard/settings?tab=performance')} className="bg-amber-600">집계 실행</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메뉴 바 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/calendar')} className="border-orange-500 text-orange-600">
              <CalendarDays className="h-4 w-4 mr-2" /> 일정관리
            </Button>
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/checklist')} className="border-blue-500 text-blue-600">
              <CheckSquare className="h-4 w-4 mr-2" /> 체크리스트
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 상단 통계 카드 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">연 매출</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs mt-1 opacity-80">{new Date().getFullYear()}년 누적</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">누적 고객</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newCustomers.toLocaleString()}명</div>
            <p className="text-xs mt-1 opacity-80">등록된 총 고객 수</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">주간 주문</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyOrders.toLocaleString()}건</div>
            <p className="text-xs mt-1 opacity-80">이번 주 발생 주문</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">처리 대기</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}건</div>
            <p className="text-xs mt-1 opacity-80">미결/처리중 주문</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardHeader className="pb-2"><CardTitle className="text-sm opacity-90">미결 금액</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pendingPaymentAmount)}</div>
            <p className="text-xs mt-1 opacity-80">{stats.pendingPaymentCount}건의 미결제</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 섹션 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" /> 일별 매출</CardTitle>
            <div className="flex gap-1">
              <Input type="date" value={dailyStartDate} onChange={(e) => handleDailyDateChange(e.target.value, dailyEndDate)} className="w-28 text-xs h-8" />
              <Input type="date" value={dailyEndDate} onChange={(e) => handleDailyDateChange(dailyStartDate, e.target.value)} className="w-28 text-xs h-8" />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailySales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis tickFormatter={(val) => `${(val / 10000).toFixed(0)}만`} fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                {isAdmin && !currentFilteredBranch ? (
                  availableBranches.map((b, i) => <Bar key={b.id} dataKey={b.name} stackId="a" fill={getBranchColor(i)} />)
                ) : (
                  <Bar dataKey="sales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-5 w-5 text-green-600" /> 주간 매출</CardTitle>
            <div className="flex gap-1">
              <Input type="date" value={weeklyStartDate} onChange={(e) => handleWeeklyDateChange(e.target.value, weeklyEndDate)} className="w-28 text-xs h-8" />
              <Input type="date" value={weeklyEndDate} onChange={(e) => handleWeeklyDateChange(weeklyStartDate, e.target.value)} className="w-28 text-xs h-8" />
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklySales}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" fontSize={10} />
                <YAxis tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`} fontSize={10} />
                <Tooltip content={<CustomTooltip />} />
                {isAdmin && !currentFilteredBranch ? (
                  availableBranches.map((b, i) => <Bar key={b.id} dataKey={b.name} stackId="a" fill={getBranchColor(i)} />)
                ) : (
                  <Bar dataKey="sales" fill="#10B981" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 일정 섹션 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-5 w-5 text-orange-600" /> 오늘 & 내일 일정</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/calendar')} className="text-xs">전체보기</Button>
          </CardHeader>
          <CardContent>
            {todayAndTomorrowEvents.length > 0 ? (
              <div className="space-y-2">
                {todayAndTomorrowEvents.slice(0, 5).map((ev: any) => (
                  <div key={ev.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-1 h-8 rounded ${ev.type === 'pickup' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                      <div>
                        <p className="text-sm font-bold">{ev.title}</p>
                        <p className="text-xs text-gray-500">{format(new Date(ev.startDate), 'HH:mm')} | {ev.type === 'pickup' ? '픽업' : '배송'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => ev.orderId && handleOrderDetail(orders.find(o => o.id === ev.orderId) as any)}>상세</Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-gray-400 text-sm">일정이 없습니다.</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-blue-800">픽업 대기</p>
                  <p className="text-3xl font-black text-blue-900">{todayAndTomorrowEvents.filter(e => e.type === 'pickup' && isToday(new Date(e.startDate))).length}건</p>
                </div>
                <Package className="h-8 w-8 text-blue-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50/50 border-purple-100">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-purple-800">배송 대기</p>
                  <p className="text-3xl font-black text-purple-900">{todayAndTomorrowEvents.filter(e => e.type === 'delivery' && isToday(new Date(e.startDate))).length}건</p>
                </div>
                <Truck className="h-8 w-8 text-purple-300" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 최근 주문 목록 */}
      <Card>
        <CardHeader><CardTitle>최근 주문 현황</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">이름</th>
                  <th className="py-2">상품</th>
                  <th className="py-2">지점</th>
                  <th className="py-2">상태</th>
                  <th className="py-2 text-right">금액</th>
                  <th className="py-2 text-center">작업</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-medium">{order.orderer?.name}</td>
                    <td className="py-3 text-gray-600 truncate max-w-[200px]">{order.productNames}</td>
                    <td className="py-3">{order.branchName}</td>
                    <td className="py-3">{getStatusBadge(order.status)}</td>
                    <td className="py-3 text-right font-bold">{formatCurrency(order.total)}</td>
                    <td className="py-3 text-center">
                      <Button variant="outline" size="sm" onClick={() => handleOrderDetail(order)}>상세</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 주문 상세 다이얼로그 */}
      <Dialog open={orderDetailDialogOpen} onOpenChange={handleCloseOrderDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>주문 상세 정보</DialogTitle>
            <DialogDescription>선택된 주문의 상세 내역입니다.</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-gray-500">주문 ID</p><p className="font-mono">#{selectedOrder.id.slice(-6)}</p></div>
                <div><p className="text-gray-500">상태</p>{getStatusBadge(selectedOrder.status)}</div>
                <div><p className="text-gray-500">주문일</p><p>{formatDate(selectedOrder.orderDate)}</p></div>
                <div><p className="text-gray-500">지점</p><p>{selectedOrder.branchName}</p></div>
              </div>
              <div className="border-t pt-2">
                <p className="font-bold mb-1">주문자 정보</p>
                <p className="text-sm">{selectedOrder.orderer?.name} ({selectedOrder.orderer?.contact})</p>
                <p className="text-xs text-gray-500">{selectedOrder.orderer?.company}</p>
              </div>
              <div className="border-t pt-2">
                <p className="font-bold mb-1">결제 금액</p>
                <p className="text-xl font-black text-blue-600">{formatCurrency(selectedOrder.total)}</p>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={handleCloseOrderDetail}>닫기</Button>
                <Button onClick={() => window.location.href = `/dashboard/orders`}>관리 페이지로 이동</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
