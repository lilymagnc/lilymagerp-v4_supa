"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Building, DollarSign, Package, Users, TrendingUp, Calendar, CalendarDays, ShoppingCart, CheckSquare, AlertCircle, Clock, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { useCalendar } from "@/hooks/use-calendar";
import { useOrders } from "@/hooks/use-orders";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isToday, startOfYear } from "date-fns";
import { ko } from "date-fns/locale";
import { getWeatherInfo, getWeatherEmoji, WeatherInfo } from "@/lib/weather-service";
import BulletinBoard from '@/components/dashboard/bulletin-board';
import { fetchDailyStats, sanitizeBranchKey } from "@/lib/stats-utils";
import { parseDate } from "@/lib/date-utils";
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

interface BranchSalesData {
  branch: string;
  sales: number;
  color: string;
}

interface DailySalesData {
  date: string;
  sales?: number;
  totalSales?: number;
  branchSales?: { [branchName: string]: number };
  [key: string]: any;
}

interface WeeklySalesData {
  week: string;
  sales?: number;
  totalSales?: number;
  branchSales?: { [branchName: string]: number };
  weekStart?: string;
  weekEnd?: string;
  weekRange?: string;
  [key: string]: any;
}

interface MonthlySalesData {
  month: string;
  sales?: number;
  totalSales?: number;
  branchSales?: { [branchName: string]: number };
}

function calculateWeeklyStats(statsData: any[], startDate: string, endDate: string, isAllBranches: boolean, branchFilter?: string, branches: any[] = []) {
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
        week: format(weekStart, 'RRRR년 II주차'),
        sortKey: weekKey,
        totalSales: 0,
        sales: 0,
        branchSales: {},
        weekRange: `${weekStartLabel} ~ ${weekEndLabel}`
      };
    }

    if (isAllBranches) {
      weeklyMap[weekKey].totalSales += day.totalSettledAmount || 0;
      if (day.branches) {
        Object.entries(day.branches).forEach(([bKey, bStat]: [string, any]) => {
          const amount = bStat.settledAmount || 0;
          // 지점명을 찾아서 정확한 속성명으로 설정 (Recharts 연동용)
          const branch = branches.find(b => sanitizeBranchKey(b.name) === bKey);
          const actualBranchName = branch ? branch.name : bKey.replace(/_/g, '.');

          weeklyMap[weekKey][actualBranchName] = (weeklyMap[weekKey][actualBranchName] || 0) + amount;
          weeklyMap[weekKey].branchSales[actualBranchName] = (weeklyMap[weekKey].branchSales[actualBranchName] || 0) + amount;
        });
      }
    } else if (branchFilter) {
      const bKey = sanitizeBranchKey(branchFilter);
      const bStat = day.branches?.[bKey];
      const amount = bStat?.settledAmount || 0;
      weeklyMap[weekKey].sales += amount;
      // isAdmin 모드에서 특정 지점 선택 시에도 브랜치명 속성을 넣어줘야 차트에 표시됨
      weeklyMap[weekKey][branchFilter] = (weeklyMap[weekKey][branchFilter] || 0) + amount;
    }
  });

  return Object.values(weeklyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

function calculateMonthlyStats(statsData: any[], startDate: string, endDate: string, isAllBranches: boolean, branchFilter?: string, branches: any[] = []) {
  const monthlyMap: { [key: string]: any } = {};

  statsData.forEach(day => {
    if (day.date < startDate || day.date > endDate) return;

    const monthKey = day.date.substring(0, 7);

    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = {
        month: format(parseISO(day.date), 'yyyy년 M월'),
        sortKey: monthKey,
        totalSales: 0,
        sales: 0,
        branchSales: {}
      };
    }

    if (isAllBranches) {
      monthlyMap[monthKey].totalSales += day.totalSettledAmount || 0;
      if (day.branches) {
        Object.entries(day.branches).forEach(([bKey, bStat]: [string, any]) => {
          const amount = bStat.settledAmount || 0;
          // 지점명을 찾아서 정확한 속성명으로 설정 (Recharts 연동용)
          const branch = branches.find(b => sanitizeBranchKey(b.name) === bKey);
          const actualBranchName = branch ? branch.name : bKey.replace(/_/g, '.');

          monthlyMap[monthKey][actualBranchName] = (monthlyMap[monthKey][actualBranchName] || 0) + amount;
          monthlyMap[monthKey].branchSales[actualBranchName] = (monthlyMap[monthKey].branchSales[actualBranchName] || 0) + amount;
        });
      }
    } else if (branchFilter) {
      const bKey = sanitizeBranchKey(branchFilter);
      const bStat = day.branches?.[bKey];
      const amount = bStat?.settledAmount || 0;
      monthlyMap[monthKey].sales += amount;
      // isAdmin 모드에서 특정 지점 선택 시에도 브랜치명 속성을 넣어줘야 차트에 표시됨
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

  const koreanWeekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 권한 판정 로그 추가 (디버깅용)
  useEffect(() => {
    if (user) {
      console.log('현재 로그인 사용자 정보:', {
        role: user.role,
        franchise: user.franchise,
        email: user.email
      });
    }
  }, [user]);

  const isAdmin = useMemo(() => {
    if (!user?.role) return false;
    const role = user.role.trim();
    const email = user.email?.toLowerCase();

    // 이메일 기반 강제 판정 (AuthProvider와 동기화)
    if (email === 'lilymag0301@gmail.com') return true;

    return role === '본사 관리자' || role.includes('본사') && role.includes('관리자');
  }, [user?.role, user?.email]);

  const userBranch = user?.franchise;

  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('전체');

  const availableBranches = useMemo(() => {
    if (isAdmin) {
      // 본사 관리자면 '본사' 타입을 제외한 모든 지점
      const filtered = branches.filter(b => b.type !== '본사');
      console.log('본사 관리자용 지점 목록:', filtered.map(b => b.name));
      return filtered;
    } else {
      const filtered = branches.filter(branch => branch.name === userBranch);
      return filtered;
    }
  }, [branches, isAdmin, userBranch]);

  const currentFilteredBranch = useMemo(() => {
    if (isAdmin) {
      // 본사 관리자는 대시보드에서 항상 전체 데이터를 봅니다.
      return null;
    } else {
      return userBranch;
    }
  }, [isAdmin, userBranch]);

  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    newCustomers: 0,
    weeklyOrders: 0,
    pendingOrders: 0,
    pendingPaymentCount: 0,
    pendingPaymentAmount: 0
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [allOrdersCache, setAllOrdersCache] = useState<any[]>([]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);

  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [weeklySales, setWeeklySales] = useState<WeeklySalesData[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySalesData[]>([]);

  const [dailyStartDate, setDailyStartDate] = useState(format(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [dailyEndDate, setDailyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [weeklyStartDate, setWeeklyStartDate] = useState(format(new Date(Date.now() - 56 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [weeklyEndDate, setWeeklyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [monthlyStartDate, setMonthlyStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1), 'yyyy-MM-dd'));
  const [monthlyEndDate, setMonthlyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedWeek, setSelectedWeek] = useState(format(new Date(), 'yyyy-\'W\'ww'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [statsEmpty, setStatsEmpty] = useState(false);

  const convertOrdersToEvents = useMemo(() => {
    const pickupDeliveryEvents: any[] = [];

    orders.forEach(order => {
      if (currentFilteredBranch) {
        const isOwnBranch = order.branchName === currentFilteredBranch;
        const isTransferredToMe = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentFilteredBranch;
        if (!isOwnBranch && !isTransferredToMe) {
          return;
        }
      }

      if (order.pickupInfo && order.receiptType === 'pickup_reservation' && (order.status === 'processing' || order.status === 'completed')) {
        const pickupDateStr = order.pickupInfo.date;
        const pickupTimeStr = order.pickupInfo.time;
        if (pickupDateStr && pickupTimeStr) {
          const pickupDate = new Date(`${pickupDateStr}T${pickupTimeStr}`);
          if (!isNaN(pickupDate.getTime())) {
            pickupDeliveryEvents.push({
              id: `pickup-${order.id}`,
              title: `픽업: ${order.orderer?.name || '고객'} (${order.branchName})`,
              startDate: pickupDate,
              endDate: pickupDate,
              type: 'pickup',
              orderId: order.id,
              branchName: order.branchName,
              customerName: order.orderer?.name || '고객'
            });
          }
        }
      }

      if (order.deliveryInfo && order.receiptType === 'delivery_reservation' && (order.status === 'processing' || order.status === 'completed')) {
        const deliveryDateStr = order.deliveryInfo.date;
        const deliveryTimeStr = order.deliveryInfo.time;
        if (deliveryDateStr && deliveryTimeStr) {
          const deliveryDate = new Date(`${deliveryDateStr}T${deliveryTimeStr}`);
          if (!isNaN(deliveryDate.getTime())) {
            pickupDeliveryEvents.push({
              id: `delivery-${order.id}`,
              title: `배송: ${order.orderer?.name || '고객'} (${order.branchName})`,
              startDate: deliveryDate,
              endDate: deliveryDate,
              type: 'delivery',
              orderId: order.id,
              branchName: order.branchName,
              customerName: order.orderer?.name || '고객'
            });
          }
        }
      }
    });

    return pickupDeliveryEvents;
  }, [orders, isAdmin, userBranch, currentFilteredBranch]);

  const todayAndTomorrowEvents = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const allEvents = [...calendarEvents, ...convertOrdersToEvents];

    return allEvents.filter(event => {
      const eventDate = new Date(event.startDate);
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

      return eventDateOnly.getTime() === todayOnly.getTime() ||
        eventDateOnly.getTime() === tomorrowOnly.getTime();
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [calendarEvents, convertOrdersToEvents]);

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

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  const handleBranchFilterChange = (branch: string) => {
    setSelectedBranchFilter(branch);
  };

  const handleOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailDialogOpen(true);
  };

  const handleCloseOrderDetail = () => {
    setSelectedOrder(null);
    setOrderDetailDialogOpen(false);
  };

  useEffect(() => {
    async function fetchWeatherData() {
      try {
        const weather = await getWeatherInfo();
        setWeatherInfo(weather);
      } catch (error) {
        console.error('날씨 정보 가져오기 실패:', error);
      }
    }

    fetchWeatherData();

    const weatherInterval = setInterval(fetchWeatherData, 30 * 60 * 1000);

    return () => clearInterval(weatherInterval);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || branches.length === 0) return;

      setLoading(true);
      try {
        const branchFilter = currentFilteredBranch || undefined;
        const now = new Date();
        const yearStartStr = format(startOfYear(now), 'yyyy-MM-dd');
        const weekStartStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const todayStr = format(now, 'yyyy-MM-dd');

        const fetchRecentOrders = async () => {
          let queryBuilder = supabase
            .from('orders')
            .select('*')
            .order('order_date', { ascending: false })
            .limit(10);

          if (!isAdmin || branchFilter) {
            const bName = branchFilter || userBranch;
            if (bName) {
              queryBuilder = queryBuilder.or(`branch_name.eq.${bName},transfer_info->>processBranchName.eq.${bName}`);
            }
          }
          const { data, error } = await queryBuilder;
          if (error) throw error;

          return (data || []).map((row: any) => {
            let productNames = '상품 정보 없음';
            const items = row.items || [];
            if (Array.isArray(items) && items.length > 0) {
              productNames = items.map((item: any) => item.name || item.productName || '상품명 없음').join(', ');
            }
            return {
              id: row.id,
              orderer: row.orderer || { name: '정보 없음' },
              orderDate: parseDate(row.order_date),
              total: row.summary?.total || 0,
              status: row.status,
              branchName: row.branch_name,
              productNames,
              items: row.items,
              summary: row.summary,
              payment: row.payment,
              deliveryInfo: row.delivery_info,
              pickupInfo: row.pickup_info,
              receiptType: row.receipt_type,
              transferInfo: row.transfer_info
            } as Order;
          });
        };

        const fetchPendingStats = async () => {
          let queryBuilder = supabase
            .from('orders')
            .select('id, status, payment, summary, branch_name, transfer_info')
            .in('status', ['pending', 'processing', '대기', '준비중', '처리중']);

          if (!isAdmin || branchFilter) {
            const bName = branchFilter || userBranch;
            if (bName) {
              queryBuilder = queryBuilder.or(`branch_name.eq.${bName},transfer_info->>processBranchName.eq.${bName}`);
            }
          }

          const { data, error } = await queryBuilder;
          if (error) throw error;

          let pOrders = 0;
          let pPaymentCount = 0;
          let pPaymentAmount = 0;

          if (data) {
            data.forEach((order: any) => {
              pOrders++;
              if (order.payment?.status === 'pending') {
                pPaymentCount++;
                pPaymentAmount += (order.summary?.total || 0);
              }
            });
          }
          return { pOrders, pPaymentCount, pPaymentAmount };
        };

        const fetchStats = async () => {
          const earliestDate = [dailyStartDate, weeklyStartDate, monthlyStartDate, yearStartStr].sort()[0];
          return await fetchDailyStats(earliestDate, todayStr);
        };

        const fetchCustomerCount = async () => {
          let countQuery = supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('is_deleted', false);

          if (!isAdmin || branchFilter) {
            const bName = branchFilter || userBranch;
            if (bName) {
              countQuery = countQuery.eq('branch', bName);
            }
          }
          const { count, error } = await countQuery;
          if (error) throw error;
          return count || 0;
        };

        // 병렬 실행
        const results = await Promise.allSettled([
          fetchRecentOrders(),
          fetchPendingStats(),
          fetchStats(),
          fetchCustomerCount()
        ]);

        // 1. 최근 주문 결과 처리
        if (results[0].status === 'fulfilled') {
          setRecentOrders(results[0].value);
        } else {
          console.error("Recent orders fetch failed:", results[0].reason);
        }

        // 2. 미처리 주문 결과 처리
        if (results[1].status === 'fulfilled') {
          const { pOrders, pPaymentCount, pPaymentAmount } = results[1].value;
          setStats(prev => ({
            ...prev,
            pendingOrders: pOrders,
            pendingPaymentCount: pPaymentCount,
            pendingPaymentAmount: pPaymentAmount
          }));
        } else {
          console.error("Active orders fetch failed:", results[1].reason);
        }

        // 3. 통계 데이터 처리
        if (results[2].status === 'fulfilled') {
          const statsData = results[2].value;

          if (statsData.length === 0) {
            setStatsEmpty(true);
          } else {
            setStatsEmpty(false);

            let totalRevenue = 0;
            let weeklyOrders = 0;

            statsData.forEach((day: any) => {
              const isThisYear = day.date >= yearStartStr;
              const isThisWeek = day.date >= weekStartStr;

              if (branchFilter) {
                const bKey = branchFilter.replace(/\./g, '_').replace(/ /g, '_');
                const branchStat = day.branches?.[bKey];
                if (branchStat) {
                  if (isThisYear) totalRevenue += branchStat.settledAmount || 0;
                  if (isThisWeek) {
                    weeklyOrders += branchStat.orderCount || 0;
                  }
                }
              } else {
                if (isThisYear) totalRevenue += day.totalSettledAmount || 0;
                if (isThisWeek) {
                  weeklyOrders += day.totalOrderCount || 0;
                }
              }
            });

            setStats(prev => ({
              ...prev,
              totalRevenue,
              weeklyOrders,
              // pending 값들은 위에서 처리됨
            }));

            // 기간 내의 모든 날짜 생성 (데이터가 없는 날도 표시하기 위함)
            const dailyData: DailySalesData[] = [];
            let currentDate = parseISO(dailyStartDate);
            const endDate = parseISO(dailyEndDate);

            while (currentDate <= endDate) {
              const dateStr = format(currentDate, 'yyyy-MM-dd');
              const day = statsData.find((d: any) => d.date === dateStr) || { date: dateStr, totalSettledAmount: 0, branches: {} };

              const weekday = koreanWeekdays[currentDate.getDay()];
              const label = `${format(currentDate, 'M/d')} (${weekday})`;

              const result: any = { date: label, totalSales: day.totalSettledAmount || 0 };

              // 지점별 매칭
              if (day.branches) {
                Object.entries(day.branches).forEach(([bKey, bStat]: [string, any]) => {
                  const amount = bStat.settledAmount || 0;
                  const nameWithDots = bKey.replace(/_/g, '.');
                  result[nameWithDots] = amount;
                  const nameWithSpaces = bKey.replace(/_/g, ' ');
                  result[nameWithSpaces] = amount;
                  result[bKey] = amount;
                });
              }

              if (!isAdmin || branchFilter) {
                const bName = branchFilter || userBranch;
                if (bName) {
                  const bKey = bName.replace(/\./g, '_').replace(/ /g, '_');
                  const bStat = day.branches?.[bKey] || { settledAmount: 0 };
                  result.sales = bStat.settledAmount || 0;
                }
              }

              dailyData.push(result);
              currentDate = new Date(currentDate.setDate(currentDate.getDate() + 1));
            }
            setDailySales(dailyData);

            const weeklyData = calculateWeeklyStats(statsData, weeklyStartDate, weeklyEndDate, isAdmin && (!branchFilter || branchFilter === '전체'), branchFilter || userBranch, branches);
            setWeeklySales(weeklyData as any);

            const monthlyData = calculateMonthlyStats(statsData, monthlyStartDate, monthlyEndDate, isAdmin && (!branchFilter || branchFilter === '전체'), branchFilter || userBranch, branches);
            setMonthlySales(monthlyData as any);
          }
        } else {
          console.error("Stats fetching failed:", results[2].reason);
        }

        // 4. 고객 수 처리
        if (results[3].status === 'fulfilled') {
          setStats(prev => ({ ...prev, newCustomers: results[3].value }));
        } else {
          console.error("Customer fetch failed:", results[3].reason);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, branches, currentFilteredBranch, dailyStartDate, dailyEndDate, weeklyStartDate, weeklyEndDate, monthlyStartDate, monthlyEndDate]);

  const formatCurrency = (value: number) => `₩${value.toLocaleString()}`;

  const formatDate = (date: any) => {
    const parsed = parseDate(date);
    if (!parsed) return '날짜 없음';
    return parsed.toLocaleDateString('ko-KR');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { text: string; color: string } } = {
      'completed': { text: '완료', color: 'bg-green-100 text-green-800' },
      'processing': { text: '처리중', color: 'bg-blue-100 text-blue-800' },
      'pending': { text: '대기', color: 'bg-yellow-100 text-yellow-800' },
      'cancelled': { text: '취소', color: 'bg-red-100 text-red-800' }
    };
    const statusInfo = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
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
  };

  const getDashboardTitle = () => {
    if (isAdmin) {
      if (currentFilteredBranch && currentFilteredBranch !== '전체') {
        return `${currentFilteredBranch} 대시보드`;
      } else {
        return '전체 대시보드';
      }
    } else {
      return userBranch ? `${userBranch} 대시보드` : '나의 대시보드';
    }
  };

  const getDashboardDescription = () => {
    if (isAdmin) {
      if (currentFilteredBranch && currentFilteredBranch !== '전체') {
        return `${currentFilteredBranch}의 현재 상태를 한 눈에 파악하세요.`;
      } else {
        return '시스템 전체의 현재 상태를 한 눈에 파악하세요.';
      }
    } else {
      return userBranch ? `${userBranch}의 현재 상태를 한 눈에 파악하세요.` : '현재 상태를 한 눈에 파악하세요.';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-h-screen overflow-y-auto">
        <PageHeader
          title={getDashboardTitle()}
          description={getDashboardDescription()}
        />
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-screen overflow-y-auto">
      <PageHeader
        title={getDashboardTitle()}
        description={getDashboardDescription()}
      />
      <BulletinBoard />

      {/* 통계 데이터 없음 알림 */}
      {statsEmpty && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-amber-800">
                <AlertCircle className="h-6 w-6 shrink-0" />
                <div>
                  <p className="font-bold">통계 데이터가 생성되지 않았습니다.</p>
                  <p className="text-sm">대시보드 차트와 전체 통계를 보려면 최초 1회 데이터 집계 작업이 필요합니다.</p>
                </div>
              </div>
              <Button
                onClick={() => router.push('/dashboard/settings?tab=performance')}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              >
                지금 집계하기
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* 메뉴바 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                className="border-orange-500 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                onClick={() => router.push('/dashboard/calendar')}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                일정관리
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={() => router.push('/dashboard/checklist')}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                체크리스트
              </Button>
              {/* 향후 다른 메뉴 버튼들을 여기에 추가할 수 있습니다 */}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 본사 관리자용 지점 필터링 드롭다운 제거 (요청에 따라 통합 데이터만 표시) */}
      {/* 
      {isAdmin && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="text-sm font-medium text-gray-700">지점 선택:</label>
              <Select value={selectedBranchFilter} onValueChange={handleBranchFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="지점을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="전체">전체 지점</SelectItem>
                  {availableBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-gray-500">
                {currentFilteredBranch ? `${currentFilteredBranch} 데이터` : '전체 지점 데이터'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      */}

      {/* 상단 통계 카드 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              {isAdmin
                ? (currentFilteredBranch ? `${currentFilteredBranch} 년 매출` : '총 년 매출')
                : `${userBranch} 년 매출`
              }
            </CardTitle>
            <DollarSign className="h-4 w-4 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs opacity-90 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              {new Date().getFullYear()}년 매출 현황
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              {isAdmin
                ? (currentFilteredBranch ? `${currentFilteredBranch} 고객` : '등록 고객')
                : `${userBranch} 고객`
              }
            </CardTitle>
            <Users className="h-4 w-4 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newCustomers}</div>
            <p className="text-xs opacity-90 flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" />
              {isAdmin && !currentFilteredBranch ? '전체 등록 고객' : '등록된 고객'}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              {isAdmin
                ? (currentFilteredBranch ? `${currentFilteredBranch} 주문` : '총 주문')
                : `${userBranch} 주문`
              }
            </CardTitle>
            <ShoppingCart className="h-4 w-4 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyOrders.toLocaleString()}</div>
            <p className="text-xs opacity-90">이번 주 주문 건수</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              {isAdmin
                ? (currentFilteredBranch ? `${currentFilteredBranch} 대기` : '처리 대기')
                : `${userBranch} 대기`
              }
            </CardTitle>
            <Calendar className="h-4 w-4 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            <p className="text-xs opacity-90">처리 필요한 주문</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium opacity-90">
              {isAdmin
                ? (currentFilteredBranch ? `${currentFilteredBranch} 미결` : '미결 주문')
                : `${userBranch} 미결`
              }
            </CardTitle>
            <Package className="h-4 w-4 opacity-90" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingPaymentCount}</div>
            <p className="text-xs opacity-90">{formatCurrency(stats.pendingPaymentAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 섹션 - 그리드 레이아웃으로 변경 */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
        {/* 일별 매출 현황 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  {isAdmin
                    ? (currentFilteredBranch ? `${currentFilteredBranch} 일별 매출` : '일별 지점별 매출 현황')
                    : `${userBranch} 일별 매출`
                  }
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {isAdmin && !currentFilteredBranch
                    ? '선택된 기간 지점별 매출 비율'
                    : '선택된 기간 매출 트렌드'
                  }
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Input
                  type="date"
                  value={dailyStartDate}
                  onChange={(e) => handleDailyDateChange(e.target.value, dailyEndDate)}
                  className="w-full sm:w-32"
                />
                <span className="text-sm text-gray-500">~</span>
                <Input
                  type="date"
                  value={dailyEndDate}
                  onChange={(e) => handleDailyDateChange(dailyStartDate, e.target.value)}
                  className="w-full sm:w-32"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              {isAdmin ? (
                currentFilteredBranch ? (
                  // 본사 관리자가 특정 지점 선택 시: 해당 지점의 단일 매출 차트
                  <BarChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sales" radius={[4, 4, 0, 0]} fill="#3B82F6" />
                  </BarChart>
                ) : (
                  // 본사 관리자용: 지점별 매출 비율 차트
                  <BarChart data={dailySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    {availableBranches.map((branch, index) => (
                      <Bar
                        key={branch.id}
                        dataKey={branch.name}
                        stackId="a"
                        radius={[4, 4, 0, 0]}
                        fill={getBranchColor(index)}
                      />
                    ))}
                  </BarChart>
                )
              ) : (
                // 가맹점/지점 직원용: 자신의 지점 매출 차트
                <BarChart data={dailySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={12} />
                  <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sales" radius={[4, 4, 0, 0]} fill="#3B82F6" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 주간 매출 현황 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-green-600" />
                  {isAdmin
                    ? (currentFilteredBranch ? `${currentFilteredBranch} 주간 매출` : '주간 지점별 매출 현황')
                    : `${userBranch} 주간 매출`
                  }
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {isAdmin && !currentFilteredBranch
                    ? '선택된 기간 지점별 매출 비율'
                    : '선택된 기간 매출 트렌드'
                  }
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Input
                  type="date"
                  value={weeklyStartDate}
                  onChange={(e) => handleWeeklyDateChange(e.target.value, weeklyEndDate)}
                  className="w-full sm:w-32"
                />
                <span className="text-sm text-gray-500">~</span>
                <Input
                  type="date"
                  value={weeklyEndDate}
                  onChange={(e) => handleWeeklyDateChange(weeklyStartDate, e.target.value)}
                  className="w-full sm:w-32"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              {isAdmin ? (
                // 본사 관리자용: 지점별 매출 비율 차트
                <BarChart data={weeklySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" fontSize={12} />
                  <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  {availableBranches.map((branch, index) => (
                    <Bar
                      key={branch.id}
                      dataKey={branch.name}
                      stackId="a"
                      radius={[4, 4, 0, 0]}
                      fill={getBranchColor(index)}
                    />
                  ))}
                </BarChart>
              ) : (
                // 가맹점/지점 직원용: 자신의 지점 매출 차트
                <BarChart data={weeklySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" fontSize={12} />
                  <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sales" radius={[4, 4, 0, 0]} fill="#10B981" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 월별 매출 현황 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5 text-purple-600" />
                {isAdmin
                  ? (currentFilteredBranch ? `${currentFilteredBranch} 월별 매출` : '월별 지점별 매출 현황')
                  : `${userBranch} 월별 매출`
                }
              </CardTitle>
              <p className="text-sm text-gray-600">
                {isAdmin && !currentFilteredBranch
                  ? '선택된 기간 지점별 매출 비율'
                  : '선택된 기간 매출 트렌드'
                }
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Input
                type="date"
                value={monthlyStartDate}
                onChange={(e) => handleMonthlyDateChange(e.target.value, monthlyEndDate)}
                className="w-full sm:w-32"
              />
              <span className="text-sm text-gray-500">~</span>
              <Input
                type="date"
                value={monthlyEndDate}
                onChange={(e) => handleMonthlyDateChange(monthlyStartDate, e.target.value)}
                className="w-full sm:w-32"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            {isAdmin ? (
              // 본사 관리자용: 지점별 매출 비율 차트
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                {availableBranches.map((branch, index) => (
                  <Bar
                    key={branch.id}
                    dataKey={branch.name}
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                    fill={getBranchColor(index)}
                  />
                ))}
              </BarChart>
            ) : (
              // 가맹점/지점 직원용: 자신의 지점 매출 차트
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis tickFormatter={(value) => `₩${(value / 1000000).toFixed(1)}M`} fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="sales" radius={[4, 4, 0, 0]} fill="#8B5CF6" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 일정 및 픽업/배송 현황 섹션 추가 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* 오늘의 주요 일정 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-orange-600" />
              오늘 & 내일 일정
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-orange-600 text-xs"
              onClick={() => router.push('/dashboard/calendar')}
            >
              전체보기
            </Button>
          </CardHeader>
          <CardContent>
            {todayAndTomorrowEvents.length > 0 ? (
              <div className="space-y-3">
                {todayAndTomorrowEvents.slice(0, 5).map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-orange-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-10 rounded-full ${event.type === 'pickup' ? 'bg-blue-400' :
                        event.type === 'delivery' ? 'bg-purple-400' : 'bg-orange-400'
                        }`} />
                      <div>
                        <p className="font-bold text-sm">{event.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(event.startDate), 'HH:mm')}
                          </span>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {event.type === 'pickup' ? '픽업' : event.type === 'delivery' ? '배송' : '기타'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => event.orderId && handleOrderDetail(orders.find(o => o.id === event.orderId) as any)}
                    >
                      상세
                    </Button>
                  </div>
                ))}
                {todayAndTomorrowEvents.length > 5 && (
                  <p className="text-center text-xs text-gray-400 mt-2">
                    외 {todayAndTomorrowEvents.length - 5}개의 일정이 더 있습니다.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Calendar className="h-12 w-12 opacity-20 mb-2" />
                <p className="text-sm">예정된 일정이 없습니다.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 요약 카드 (픽업/배송) */}
        <div className="space-y-4">
          <Card className="bg-blue-50/50 border-blue-100">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-blue-800">픽업 대기</CardTitle>
              <Package className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-blue-900">
                {todayAndTomorrowEvents.filter(e => e.type === 'pickup' && isToday(new Date(e.startDate))).length}
                <span className="text-sm font-medium ml-1">건</span>
              </div>
              <p className="text-xs text-blue-600/70 mt-1">오늘 처리해야 할 픽업</p>
            </CardContent>
          </Card>

          <Card className="bg-purple-50/50 border-purple-100">
            <CardHeader className="py-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-purple-800">배송 대기</CardTitle>
              <Truck className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-purple-900">
                {todayAndTomorrowEvents.filter(e => e.type === 'delivery' && isToday(new Date(e.startDate))).length}
                <span className="text-sm font-medium ml-1">건</span>
              </div>
              <p className="text-xs text-purple-600/70 mt-1">오늘 처리해야 할 배송</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 최근 주문 목록 (실제 데이터) - 테이블 형태로 개선 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isAdmin
              ? (currentFilteredBranch ? `${currentFilteredBranch} 최근 주문` : '최근 주문')
              : `${userBranch} 최근 주문`
            }
          </CardTitle>
          <p className="text-sm text-gray-600">실시간 주문 현황</p>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">주문ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">주문자</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">상품명</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">주문일</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">출고지점</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">상태</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">금액</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="text-sm font-mono text-gray-500">#{order.id.slice(-6)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{order.orderer?.name || '주문자 정보 없음'}</p>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-sm text-gray-600 truncate" title={order.productNames}>
                          {order.productNames || '상품 정보 없음'}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-600">{formatDate(order.orderDate)}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm">{order.branchName}</p>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-bold">{formatCurrency(order.total)}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleOrderDetail(order)}
                        >
                          상세보기
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">주문 데이터가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 주문 상세보기 다이얼로그 */}
      <Dialog open={orderDetailDialogOpen} onOpenChange={handleCloseOrderDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              주문 상세 정보
            </DialogTitle>
            <DialogDescription>
              선택된 주문의 상세 정보를 확인합니다.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder ? (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">주문 ID</p>
                  <p className="font-mono text-lg">#{selectedOrder.id.slice(-6)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">주문 상태</p>
                  <div>{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">주문일</p>
                  <p>{formatDate(selectedOrder.orderDate)}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">출고지점</p>
                  <p>{selectedOrder.branchName}</p>
                </div>
              </div>

              {/* 주문자 정보 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">주문자 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">이름</p>
                    <p>{selectedOrder.orderer?.name || '정보 없음'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">연락처</p>
                    <p>{selectedOrder.orderer?.contact || '정보 없음'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">회사</p>
                    <p>{selectedOrder.orderer?.company || '정보 없음'}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">이메일</p>
                    <p>{selectedOrder.orderer?.email || '정보 없음'}</p>
                  </div>
                </div>
              </div>

              {/* 상품 정보 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">상품 정보</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm">{selectedOrder.productNames || '상품 정보 없음'}</p>
                </div>
              </div>

              {/* 금액 정보 */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">금액 정보</h3>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(selectedOrder.total)}
                  </p>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="border-t pt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCloseOrderDetail}
                >
                  닫기
                </Button>
                <Button
                  onClick={() => {
                    // 주문 관리 페이지로 이동
                    window.location.href = `/dashboard/orders`;
                  }}
                >
                  주문 관리로 이동
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">주문 상세를 불러올 수 없습니다.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
