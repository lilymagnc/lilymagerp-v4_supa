
"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Building, DollarSign, Package, Users, TrendingUp, Calendar, CalendarDays, ShoppingCart, CheckSquare, AlertCircle } from "lucide-react";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { fetchDailyStats } from "@/lib/stats-utils";


interface DashboardStats {
  totalRevenue: number;
  newCustomers: number;
  weeklyOrders: number; // 총 주문 건수에서 주간 주문 건수로 변경
  pendingOrders: number;
  pendingPaymentCount: number; // 미결 주문 건수
  pendingPaymentAmount: number; // 미결 주문 금액
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
  productNames?: string; // 상품명 필드 추가
}

interface BranchSalesData {
  branch: string;
  sales: number;
  color: string;
}

// 14일간 차트 데이터 타입
interface DailySalesData {
  date: string;
  sales?: number; // 가맹점/지점 직원용
  totalSales?: number; // 본사 관리자용
  branchSales?: { [branchName: string]: number }; // 본사 관리자용
  [key: string]: any; // 지점별 매출을 동적 속성으로 추가
}

// 8주간 차트 데이터 타입
interface WeeklySalesData {
  week: string;
  sales?: number; // 가맹점/지점 직원용
  totalSales?: number; // 본사 관리자용
  branchSales?: { [branchName: string]: number }; // 본사 관리자용
  weekStart?: string;
  weekEnd?: string;
  weekRange?: string;
  [key: string]: any; // 지점별 매출을 동적 속성으로 추가
}

// 12개월간 차트 데이터 타입
interface MonthlySalesData {
  month: string;
  sales?: number; // 가맹점/지점 직원용
  totalSales?: number; // 본사 관리자용
  branchSales?: { [branchName: string]: number }; // 본사 관리자용
}

/**
 * 일별 데이터를 주별 데이터로 집계합니다.
 */
function calculateWeeklyStats(statsData: any[], startDate: string, endDate: string, isAllBranches: boolean, branchFilter?: string) {
  const weeklyMap: { [key: string]: any } = {};

  statsData.forEach(day => {
    if (day.date < startDate || day.date > endDate) return;

    const dateObj = parseISO(day.date);
    const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 });
    // RRRR-II (ISO week)를 사용하여 연도 전환 시 정렬 문제 해결
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
        Object.entries(day.branches).forEach(([bName, bStat]: [string, any]) => {
          const amount = bStat.settledAmount || 0;
          weeklyMap[weekKey].branchSales[bName] = (weeklyMap[weekKey].branchSales[bName] || 0) + amount;
          weeklyMap[weekKey][bName] = (weeklyMap[weekKey][bName] || 0) + amount;
        });
      }
    } else if (branchFilter) {
      const bKey = branchFilter.replace(/\./g, '_');
      const bStat = day.branches?.[bKey];
      weeklyMap[weekKey].sales += bStat?.settledAmount || 0;
    }
  });

  return Object.values(weeklyMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/**
 * 일별 데이터를 월별 데이터로 집계합니다.
 */
function calculateMonthlyStats(statsData: any[], startDate: string, endDate: string, isAllBranches: boolean, branchFilter?: string) {
  const monthlyMap: { [key: string]: any } = {};

  statsData.forEach(day => {
    if (day.date < startDate || day.date > endDate) return;

    const monthKey = day.date.substring(0, 7); // yyyy-MM

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
        Object.entries(day.branches).forEach(([bName, bStat]: [string, any]) => {
          if (!monthlyMap[monthKey].branchSales) monthlyMap[monthKey].branchSales = {};
          const amount = bStat.settledAmount || 0;
          monthlyMap[monthKey].branchSales[bName] = (monthlyMap[monthKey].branchSales[bName] || 0) + amount;
          monthlyMap[monthKey][bName] = (monthlyMap[monthKey][bName] || 0) + amount;
        });
      }
    } else if (branchFilter) {
      const bKey = branchFilter.replace(/\./g, '_');
      const bStat = day.branches?.[bKey];
      monthlyMap[monthKey].sales += bStat?.settledAmount || 0;
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

  // 한국어 요일 배열
  const koreanWeekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 사용자 권한에 따른 지점 필터링
  const isAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise;

  // 본사 관리자용 지점 필터링 상태
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('전체');

  // 사용자가 볼 수 있는 지점 목록
  const availableBranches = useMemo(() => {
    if (isAdmin) {
      return branches.filter(b => b.type !== '본사'); // 본사 관리자는 모든 지점 (본사 제외)
    } else {
      return branches.filter(branch => branch.name === userBranch); // 지점 직원은 자신의 지점만
    }
  }, [branches, isAdmin, userBranch]);

  // 현재 필터링된 지점 (본사 관리자는 선택된 지점, 지점 사용자는 자신의 지점)
  const currentFilteredBranch = useMemo(() => {
    if (isAdmin) {
      return selectedBranchFilter === '전체' ? null : selectedBranchFilter;
    } else {
      return userBranch;
    }
  }, [isAdmin, selectedBranchFilter, userBranch]);

  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    newCustomers: 0,
    weeklyOrders: 0, // 총 주문 건수에서 주간 주문 건수로 변경
    pendingOrders: 0,
    pendingPaymentCount: 0,
    pendingPaymentAmount: 0
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [allOrdersCache, setAllOrdersCache] = useState<any[]>([]);

  // 주문 상세보기 다이얼로그 상태
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailDialogOpen, setOrderDetailDialogOpen] = useState(false);

  // 차트별 데이터 상태
  const [dailySales, setDailySales] = useState<DailySalesData[]>([]);
  const [weeklySales, setWeeklySales] = useState<WeeklySalesData[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySalesData[]>([]);

  // 차트별 날짜 필터링 상태
  const [dailyStartDate, setDailyStartDate] = useState(format(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [dailyEndDate, setDailyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [weeklyStartDate, setWeeklyStartDate] = useState(format(new Date(Date.now() - 56 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));
  const [weeklyEndDate, setWeeklyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [monthlyStartDate, setMonthlyStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1), 'yyyy-MM-dd'));
  const [monthlyEndDate, setMonthlyEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 기존 날짜 상태 (다른 용도로 사용)
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedWeek, setSelectedWeek] = useState(format(new Date(), 'yyyy-\'W\'ww'));
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  // 날씨 정보 상태
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null);
  const [statsEmpty, setStatsEmpty] = useState(false);

  // 주문 데이터를 캘린더 이벤트로 변환 (일정관리와 동일한 로직)
  const convertOrdersToEvents = useMemo(() => {
    const pickupDeliveryEvents: any[] = [];

    orders.forEach(order => {
      // 지점 필터링 (자신의 지점 + 이관받은 주문)
      if (currentFilteredBranch) {
        const isOwnBranch = order.branchName === currentFilteredBranch;
        const isTransferredToMe = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentFilteredBranch;
        if (!isOwnBranch && !isTransferredToMe) {
          return;
        }
      }

      // 픽업 예약 처리 (즉시픽업 제외, 처리 중이거나 완료된 주문)
      if (order.pickupInfo && order.receiptType === 'pickup_reservation' && (order.status === 'processing' || order.status === 'completed')) {
        // date와 time 필드를 조합하여 날짜 객체 생성
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

      // 배송 예약 처리 (즉시픽업 제외, 처리 중이거나 완료된 주문)
      if (order.deliveryInfo && order.receiptType === 'delivery_reservation' && (order.status === 'processing' || order.status === 'completed')) {
        // date와 time 필드를 조합하여 날짜 객체 생성
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

  // 오늘과 내일의 일정 데이터 (수동 일정 + 배송/픽업 이벤트)
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

  // 매장별 색상 정의
  const branchColors = [
    '#FF8C00', '#32CD32', '#4682B4', '#DAA520', '#FF6347', '#9370DB', '#20B2AA', '#FF69B4'
  ];

  const getBranchColor = (index: number) => {
    return branchColors[index % branchColors.length];
  };

  // 차트별 날짜 필터링 핸들러
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

  // 기존 날짜 변경 핸들러 (다른 용도)
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  // 지점 필터링 변경 핸들러
  const handleBranchFilterChange = (branch: string) => {
    setSelectedBranchFilter(branch);
  };

  // 주문 상세보기 핸들러
  const handleOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setOrderDetailDialogOpen(true);
  };

  // 주문 상세보기 다이얼로그 닫기
  const handleCloseOrderDetail = () => {
    setSelectedOrder(null);
    setOrderDetailDialogOpen(false);
  };

  // 날씨 정보 가져오기
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

    // 30분마다 날씨 정보 업데이트
    const weatherInterval = setInterval(fetchWeatherData, 30 * 60 * 1000);

    return () => clearInterval(weatherInterval);
  }, []);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user || branches.length === 0) return;

      // 지점 소속 사용자의 경우 소속 정보가 로드될 때까지 대기
      if (user.role !== '본사 관리자' && !user.franchise) return;

      setLoading(true);
      try {
        const branchFilter = currentFilteredBranch || undefined;
        const now = new Date();
        const yearStartStr = format(startOfYear(now), 'yyyy-MM-dd');
        const weekStartStr = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const todayStr = format(now, 'yyyy-MM-dd');

        // 1. 최근 주문 10개 (개별 예외 처리)
        try {
          let recentQ;
          if (isAdmin && !branchFilter) {
            recentQ = query(
              collection(db, "orders"),
              orderBy("orderDate", "desc"),
              limit(10)
            );
          } else {
            const bName = branchFilter || userBranch;
            if (bName) {
              // 지점 전용/필터링: 지점 본인 주문 + 지점으로 이관된 주문 모두 필요
              // Firestore OR 쿼리 제한으로 인해 두 쿼리를 병합하거나 넉넉히 가져와서 필터링
              // 여기서는 간단하게 본인 주문 우선으로 가져오되, 이관 주문도 포함되도록 처리 (정확도를 위해 병합 쿼리 사용)
              const q1 = query(
                collection(db, "orders"),
                where("branchName", "==", bName),
                orderBy("orderDate", "desc"),
                limit(10)
              );
              const q2 = query(
                collection(db, "orders"),
                where("transferInfo.processBranchName", "==", bName),
                orderBy("orderDate", "desc"),
                limit(10)
              );

              const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
              const combined = [...snap1.docs, ...snap2.docs].map(doc => ({
                id: doc.id,
                ...doc.data()
              })).sort((a: any, b: any) => {
                const dateA = a.orderDate?.toDate ? a.orderDate.toDate() : new Date(a.orderDate);
                const dateB = b.orderDate?.toDate ? b.orderDate.toDate() : new Date(b.orderDate);
                return dateB.getTime() - dateA.getTime();
              }).slice(0, 10);

              const recentOrdersData = combined.map((order: any) => {
                let productNames = '상품 정보 없음';
                const items = order.items || order.products || [];
                if (Array.isArray(items) && items.length > 0) {
                  productNames = items.map((item: any) => item.name || item.productName || '상품명 없음').join(', ');
                }
                return {
                  id: order.id,
                  orderer: order.orderer || { name: '정보 없음' },
                  orderDate: order.orderDate,
                  total: order.summary?.total || order.total || 0,
                  status: order.status,
                  branchName: order.branchName,
                  productNames
                } as Order;
              });
              setRecentOrders(recentOrdersData);
              recentQ = null; // 이미 처리됨
            }
          }

          if (recentQ) {
            const recentSnapshot = await getDocs(recentQ);
            const recentOrdersData = recentSnapshot.docs.map(doc => {
              const order = doc.data() as any;
              let productNames = '상품 정보 없음';
              const items = order.items || order.products || [];
              if (Array.isArray(items) && items.length > 0) {
                productNames = items.map((item: any) => item.name || item.productName || '상품명 없음').join(', ');
              }
              return {
                id: doc.id,
                orderer: order.orderer || { name: '정보 없음' },
                orderDate: order.orderDate,
                total: order.summary?.total || order.total || 0,
                status: order.status,
                branchName: order.branchName,
                productNames
              } as Order;
            });
            setRecentOrders(recentOrdersData);
          }
        } catch (err) {
          console.error("Recent orders fetch failed:", err);
        }

        // 2. 미처리 주문 및 미결제 정보
        let pendingOrders = 0;
        let pendingPaymentCount = 0;
        let pendingPaymentAmount = 0;

        try {
          let activeQ;
          if (isAdmin && !branchFilter) {
            // 관리자 전용: 전체 대기 주문
            activeQ = query(
              collection(db, "orders"),
              where("status", "in", ["pending", "processing"])
            );
          } else {
            const bName = branchFilter || userBranch;
            if (bName) {
              // 지점 전용/필터링: 지점 본인 주문 + 지점으로 이관된 주문 모두 필요
              const q1 = query(
                collection(db, "orders"),
                where("branchName", "==", bName),
                where("status", "in", ["pending", "processing"])
              );
              const q2 = query(
                collection(db, "orders"),
                where("transferInfo.processBranchName", "==", bName),
                where("status", "in", ["pending", "processing"])
              );

              const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
              const uniqueDocs = new Map();
              [...snap1.docs, ...snap2.docs].forEach(doc => uniqueDocs.set(doc.id, doc.data()));

              uniqueDocs.forEach((order: any) => {
                pendingOrders++;
                if (order.payment?.status === 'pending') {
                  pendingPaymentCount++;
                  pendingPaymentAmount += (order.summary?.total || order.total || 0);
                }
              });
              activeQ = null; // 이미 처리됨
            }
          }

          if (activeQ) {
            const activeSnapshot = await getDocs(activeQ);
            activeSnapshot.docs.forEach(doc => {
              const order = doc.data() as any;
              pendingOrders++;
              if (order.payment?.status === 'pending') {
                pendingPaymentCount++;
                pendingPaymentAmount += (order.summary?.total || order.total || 0);
              }
            });
          }
        } catch (err) {
          console.error("Active orders fetch failed (Index might be missing):", err);
        }

        // 3. 통계 데이터 (dailyStats)
        try {
          const earliestDate = [dailyStartDate, weeklyStartDate, monthlyStartDate, yearStartStr].sort()[0];
          const statsData = await fetchDailyStats(earliestDate, todayStr);

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
                const branchStat = day.branches?.[branchFilter.replace(/\./g, '_')];
                if (branchStat) {
                  if (isThisYear) totalRevenue += branchStat.revenue || 0;
                  if (isThisWeek) {
                    weeklyOrders += branchStat.orderCount || 0;
                  }
                }
              } else {
                if (isThisYear) totalRevenue += day.totalRevenue || 0;
                if (isThisWeek) {
                  weeklyOrders += day.totalOrderCount || 0;
                }
              }
            });

            setStats(prev => ({
              ...prev,
              totalRevenue,
              weeklyOrders,
              pendingOrders, // 위에서 계산된 값 사용
              pendingPaymentCount,
              pendingPaymentAmount
            }));

            // 차트 데이터 가공
            const dailyChartStats = statsData.filter((d: any) => d.date >= dailyStartDate);
            const dailyData = dailyChartStats.map((day: any) => {
              const dateObj = parseISO(day.date);
              const weekday = koreanWeekdays[dateObj.getDay()];
              const label = `${format(dateObj, 'M/d')} (${weekday})`;

              if (isAdmin && !branchFilter) {
                const flattenedBranches: any = {};
                if (day.branches) {
                  Object.entries(day.branches).forEach(([bName, bStat]: [string, any]) => {
                    const originalName = bName.replace(/_/g, '.');
                    flattenedBranches[originalName] = bStat.settledAmount || 0;
                  });
                }
                return {
                  date: label,
                  totalSales: day.totalSettledAmount || 0,
                  branchSales: day.branches,
                  ...flattenedBranches
                };
              } else {
                const bName = branchFilter || userBranch;
                const bStat = day.branches?.[bName?.replace(/\./g, '_')] || { settledAmount: 0 };
                return {
                  date: label,
                  sales: bStat.settledAmount || 0
                };
              }
            });
            setDailySales(dailyData as any);

            const weeklyData = calculateWeeklyStats(statsData, weeklyStartDate, weeklyEndDate, isAdmin && !branchFilter, branchFilter || userBranch);
            setWeeklySales(weeklyData as any);

            const monthlyData = calculateMonthlyStats(statsData, monthlyStartDate, monthlyEndDate, isAdmin && !branchFilter, branchFilter || userBranch);
            setMonthlySales(monthlyData as any);
          }
        } catch (err) {
          console.error("Stats fetching failed:", err);
        }

        // 4. 고객 수
        try {
          if (isAdmin && !branchFilter) {
            const custSnap = await getDocs(collection(db, 'customers'));
            const count = custSnap.size;
            setStats(prev => ({ ...prev, newCustomers: count }));
          } else {
            const bName = branchFilter || userBranch;
            if (bName) {
              const custQ = query(collection(db, 'customers'), where('branch', '==', bName));
              const custSnap = await getDocs(custQ);
              const count = custSnap.size;
              setStats(prev => ({ ...prev, newCustomers: count }));
            }
          }
        } catch (err) {
          console.error("Customer fetch failed:", err);
        }

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user, branches, currentFilteredBranch, dailyStartDate, dailyEndDate, weeklyStartDate, weeklyEndDate, monthlyStartDate, monthlyEndDate]);

  const formatCurrency = (value: number) => `₩${value.toLocaleString()}`;

  const formatDate = (date: any) => {
    if (!date) return '날짜 없음';
    if (date.toDate) {
      return date.toDate().toLocaleDateString('ko-KR');
    }
    return new Date(date).toLocaleDateString('ko-KR');
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

  // 차트용 커스텀 툴팁
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
            // 본사 관리자용: 지점별 매출 + 총액 표시
            <div>
              {payload.map((entry: any, index: number) => (
                <p key={index} className="text-sm" style={{ color: entry.color }}>
                  {entry.name}: {formatCurrency(entry.value)}
                </p>
              ))}
              {/* 총액 계산 및 표시 */}
              {payload.length > 1 && (
                <div className="border-t pt-2 mt-2">
                  <p className="text-sm font-semibold text-gray-800">
                    총액: {formatCurrency(payload.reduce((sum: number, entry: any) => sum + entry.value, 0))}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // 가맹점/지점 직원용: 자신의 지점 매출 표시
            <p className="text-sm" style={{ color: payload[0].color }}>
              매출: {formatCurrency(payload[0].value)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // 대시보드 제목 생성
  const getDashboardTitle = () => {
    if (isAdmin) {
      if (currentFilteredBranch) {
        return `${currentFilteredBranch} 대시보드`;
      } else {
        return '전체 대시보드';
      }
    } else {
      return `${userBranch} 대시보드`;
    }
  };

  // 대시보드 설명 생성
  const getDashboardDescription = () => {
    if (isAdmin) {
      if (currentFilteredBranch) {
        return `${currentFilteredBranch}의 현재 상태를 한 눈에 파악하세요.`;
      } else {
        return '시스템의 현재 상태를 한 눈에 파악하세요.';
      }
    } else {
      return `${userBranch}의 현재 상태를 한 눈에 파악하세요.`;
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

      {/* 본사 관리자용 지점 필터링 드롭다운 */}
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

