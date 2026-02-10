"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { updateDailyStats } from '@/lib/stats-utils';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { isSettled, isCanceled } from '@/lib/order-utils';

// Simplified version for the form
interface OrderItemForm {
  id: string;
  name: string;
  quantity: number;
  price: number;
  source?: 'excel_upload' | 'manual';
  originalData?: string;
}

export interface OrderData {
  branchId: string;
  branchName: string;
  orderNumber?: string;
  orderDate: Date | string | any;
  status: 'processing' | 'completed' | 'canceled';
  items: OrderItemForm[];
  summary: {
    subtotal: number;
    discountAmount: number;
    discountRate: number;
    deliveryFee: number;
    pointsUsed?: number;
    pointsEarned?: number;
    total: number;
  };
  orderer: {
    id?: string;
    name: string;
    contact: string;
    company: string;
    email: string;
  };
  isAnonymous: boolean;
  registerCustomer: boolean;
  orderType: "store" | "phone" | "naver" | "kakao" | "etc";
  receiptType: "store_pickup" | "pickup_reservation" | "delivery_reservation";
  payment: {
    method: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple";
    status: PaymentStatus;
    completedAt?: any;
    isSplitPayment?: boolean;
    firstPaymentAmount?: number;
    firstPaymentDate?: any;
    firstPaymentMethod?: string;
    secondPaymentAmount?: number;
    secondPaymentDate?: any;
    secondPaymentMethod?: string;
  };
  pickupInfo: {
    date: string;
    time: string;
    pickerName: string;
    pickerContact: string;
  } | null;
  deliveryInfo: {
    date: string;
    time: string;
    recipientName: string;
    recipientContact: string;
    address: string;
    district: string;
    itemSize?: 'small' | 'medium' | 'large';
    isExpress?: boolean;
    driverAffiliation?: string;
    driverName?: string;
    driverContact?: string;
    completionPhotoUrl?: string;
    completedAt?: any;
    completedBy?: string;
  } | null;
  actualDeliveryCost?: number;
  actualDeliveryCostCash?: number;
  deliveryCostStatus?: 'pending' | 'completed';
  deliveryCostUpdatedAt?: any;
  deliveryCostUpdatedBy?: string;
  deliveryCostReason?: string;
  deliveryProfit?: number;
  message: {
    type: "card" | "ribbon" | "none";
    content: string;
    sender?: string;
  };
  request: string;
  source?: 'excel_upload' | 'manual';
  outsourceInfo?: {
    isOutsourced: boolean;
    partnerId: string;
    partnerName: string;
    partnerPrice: number;
    profit: number;
    status: 'pending' | 'accepted' | 'completed' | 'canceled';
    notes?: string;
    outsourcedAt: any;
    updatedAt?: any;
  };
}

export interface Order extends Omit<OrderData, 'orderDate'> {
  id: string;
  orderDate: any;
  transferInfo?: {
    isTransferred: boolean;
    transferId?: string;
    originalBranchId?: string;
    originalBranchName?: string;
    processBranchId?: string;
    processBranchName?: string;
    transferDate?: any;
    transferReason?: string;
    transferBy?: string;
    transferByUser?: string;
    status?: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
    amountSplit?: {
      orderBranch: number;
      processBranch: number;
    };
    notes?: string;
    acceptedAt?: any;
    rejectedAt?: any;
    completedAt?: any;
    cancelledAt?: any;
  };
  outsourceInfo?: {
    isOutsourced: boolean;
    partnerId: string;
    partnerName: string;
    partnerPrice: number;
    profit: number;
    status: 'pending' | 'accepted' | 'completed' | 'canceled';
    notes?: string;
    outsourcedAt: any;
    updatedAt?: any;
  };
  extraData?: any;
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
  completedBy?: string;
}

export type PaymentStatus = "paid" | "pending" | "completed" | "split_payment";


export function useOrders(initialFetch = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(initialFetch);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Track the most recent fetch parameters to reuse them in the realtime re-fetch
  const lastFetchParamsRef = useRef<{
    type: 'default' | 'range' | 'all' | 'calendar' | 'schedule';
    days?: number;
    start?: Date;
    end?: Date;
  }>({ type: 'default', days: 7 });

  // Ref to track user role/branch to avoid unnecessary re-renders in callbacks
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const mapRowToOrder = (row: any): Order => ({
    id: row.id,
    branchId: row.branch_id,
    branchName: row.branch_name,
    orderNumber: row.order_number,
    orderDate: row.order_date,
    status: row.status,
    items: row.items || [],
    summary: row.summary || {},
    orderer: row.orderer || {},
    isAnonymous: row.is_anonymous || false,
    registerCustomer: row.register_customer || row.extra_data?.register_customer || false,
    orderType: row.order_type || row.extra_data?.order_type || "etc",
    receiptType: row.receipt_type,
    payment: row.payment || {},
    pickupInfo: row.pickup_info,
    deliveryInfo: row.delivery_info,
    actualDeliveryCost: row.actual_delivery_cost ?? row.extra_data?.actualDeliveryCost ?? row.extra_data?.actual_delivery_cost,
    actualDeliveryCostCash: row.actual_delivery_cost_cash ?? row.extra_data?.actualDeliveryCostCash ?? row.extra_data?.actual_delivery_cost_cash,
    deliveryCostStatus: row.delivery_cost_status ?? row.extra_data?.deliveryCostStatus ?? row.extra_data?.delivery_cost_status,
    deliveryCostUpdatedAt: row.delivery_cost_updated_at ?? row.extra_data?.deliveryCostUpdatedAt ?? row.extra_data?.delivery_cost_updated_at,
    deliveryCostUpdatedBy: row.delivery_cost_updated_by ?? row.extra_data?.deliveryCostUpdatedBy ?? row.extra_data?.delivery_cost_updated_by,
    deliveryCostReason: row.delivery_cost_reason ?? row.extra_data?.deliveryCostReason ?? row.extra_data?.delivery_cost_reason,
    deliveryProfit: row.delivery_profit ?? row.extra_data?.deliveryProfit ?? row.extra_data?.delivery_profit,
    message: (() => {
      const msg = (row.message && Object.keys(row.message).length > 0) ? row.message : (row.extra_data?.message || {});
      if (msg.type === 'ribbon' && !msg.content) {
        if (msg.ribbon_left || msg.ribbon_right) {
          msg.content = msg.ribbon_right || '';
          msg.sender = msg.ribbon_left || '';
        } else if (msg.start || msg.end) {
          msg.content = msg.end || '';
          msg.sender = msg.start || '';
        }
      }
      return msg;
    })(),
    request: row.request || row.extra_data?.request || '',
    source: row.source || row.extra_data?.source,
    transferInfo: row.transfer_info || row.extra_data?.transfer_info,
    outsourceInfo: row.outsource_info || row.extra_data?.outsource_info,
    extraData: row.extra_data
  });

  const fetchCalendarOrders = useCallback(async (baseDate: Date) => {
    try {
      setLoading(true);
      lastFetchParamsRef.current = { type: 'calendar', start: baseDate };

      const startFilterDate = subDays(startOfDay(baseDate), 35).toISOString().split('T')[0];
      let query = supabase
        .from('orders')
        .select('*')
        .or(`pickup_info->>date.gte.${startFilterDate},delivery_info->>date.gte.${startFilterDate},order_date.gte.${startFilterDate}`);

      // Branch filtering
      const isAdmin =
        (userRef.current?.role as any) === '본사 관리자' ||
        (userRef.current?.role as any) === 'admin' ||
        (userRef.current?.role as any) === 'hq_manager' ||
        userRef.current?.email?.toLowerCase() === 'lilymag0301@gmail.com';

      if (!isAdmin && userRef.current?.branchName && userRef.current?.branchName !== '미정') {
        query = query.or(`branch_name.eq.${userRef.current.branchName},transfer_info->>processBranchName.eq.${userRef.current.branchName}`);
      }

      const { data, error } = await query
        .order('order_date', { ascending: false })
        .limit(2000);

      if (error) throw error;
      const ordersData = (data || []).map(mapRowToOrder);
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('캘린더 주문 로딩 오류:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrdersBySchedule = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setLoading(true);
      const startStr = startOfDay(startDate).toISOString().split('T')[0];
      const endStr = endOfDay(endDate).toISOString().split('T')[0];

      // Fetch pickup orders in range
      const { data: pickupData, error: pickupError } = await supabase
        .from('orders')
        .select('*')
        .gte('pickup_info->>date', startStr)
        .lte('pickup_info->>date', endStr);

      if (pickupError) throw pickupError;

      // Fetch delivery orders in range
      const { data: deliveryData, error: deliveryError } = await supabase
        .from('orders')
        .select('*')
        .gte('delivery_info->>date', startStr)
        .lte('delivery_info->>date', endStr);

      if (deliveryError) throw deliveryError;

      // Merge and deduplicate
      const allOrders = [...(pickupData || []), ...(deliveryData || [])];
      const uniqueOrdersMap = new Map();
      allOrders.forEach(o => uniqueOrdersMap.set(o.id, o));
      const uniqueOrders = Array.from(uniqueOrdersMap.values());

      const ordersData = uniqueOrders.map(mapRowToOrder);

      // Sort by date (pickup or delivery)
      ordersData.sort((a, b) => {
        const dateA = a.pickupInfo?.date || a.deliveryInfo?.date || '';
        const dateB = b.pickupInfo?.date || b.deliveryInfo?.date || '';
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return (b.pickupInfo?.time || b.deliveryInfo?.time || '').localeCompare(a.pickupInfo?.time || a.deliveryInfo?.time || '');
      });

      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('Schedule orders fetch error:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);


  const fetchOrders = useCallback(async (days: number = 7) => {
    // Abort previous request if exists
    const controller = new AbortController();
    const signal = controller.signal;

    try {
      // Set current fetch params for re-sync
      lastFetchParamsRef.current = { type: 'default', days };

      // Only show full-page loading skeleton if we have no orders or it's the very first fetch
      if (orders.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const startDate = subDays(startOfDay(new Date()), days).toISOString();

      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      const isAdmin =
        (userRef.current?.role as any) === '본사 관리자' ||
        (userRef.current?.role as any) === 'admin' ||
        (userRef.current?.role as any) === 'hq_manager' ||
        userRef.current?.email?.toLowerCase() === 'lilymag0301@gmail.com';
      const branchName = userRef.current?.branchName;

      while (hasMore) {
        if (signal.aborted) throw new Error('Aborted');

        let query = supabase
          .from('orders')
          .select('*')
          .or(`order_date.gte.${startDate},payment->>completedAt.gte.${startDate},transfer_info->>acceptedAt.gte.${startDate}`);

        // Server-side branch filter
        if (!isAdmin && branchName && branchName !== '미정') {
          query = query.or(`branch_name.eq.${branchName},transfer_info->>processBranchName.eq.${branchName}`);
        }

        const { data, error } = await query
          .order('order_date', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1)
          .abortSignal(signal);

        if (error) throw error;
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          if (data.length < pageSize) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }

        if (allData.length >= 5000) break;
      }

      if (!signal.aborted) {
        const mappedOrders = allData.map(mapRowToOrder);
        setOrders(mappedOrders);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError' && error.message !== 'Aborted') {
        console.error('주문 데이터 로딩 오류:', error);
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  const fetchOrdersByRange = useCallback(async (start: Date, end: Date) => {
    try {
      lastFetchParamsRef.current = { type: 'range', start, end };

      if (orders.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const rangeStart = startOfDay(start).toISOString();
      const rangeEnd = endOfDay(end).toISOString();

      let allOrders: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      const isAdmin =
        (userRef.current?.role as any) === '본사 관리자' ||
        (userRef.current?.role as any) === 'admin' ||
        (userRef.current?.role as any) === 'hq_manager' ||
        userRef.current?.email?.toLowerCase() === 'lilymag0301@gmail.com';
      const branchName = userRef.current?.branchName;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('orders')
          .select('*')
          .gte('order_date', rangeStart)
          .lte('order_date', rangeEnd);

        // Server-side branch filter
        if (!isAdmin && branchName && branchName !== '미정') {
          query = query.or(`branch_name.eq.${branchName},transfer_info->>processBranchName.eq.${branchName}`);
        }

        const { data, error } = await query
          .order('order_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allOrders = [...allOrders, ...data];

          if (data.length < pageSize) {
            hasMore = false; // End of data
          } else {
            page++; // Next page
          }
        } else {
          hasMore = false; // No more data
        }

        // Safety break
        if (allOrders.length >= 20000) {
          console.warn('[Period Load] Safety limit reached (20k rows)');
          break;
        }
      }


      const ordersData = (allOrders || []).map(mapRowToOrder);
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('Range 주문 로딩 오류:', error);
      setOrders([]);
      return [];
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [orders.length]);

  const fetchAllOrders = useCallback(async () => {
    try {
      if (orders.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false })
        .limit(10000);

      if (error) throw error;
      const ordersData = (data || []).map(mapRowToOrder);
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('전체 주문 로딩 오류:', error);
      return [];
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [orders.length]);

  const fetchOrdersByCustomer = useCallback(async (customerId: string, startDate?: Date, endDate?: Date) => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*')
        .eq('orderer->>id', customerId)
        .order('order_date', { ascending: false });

      if (startDate) query = query.gte('order_date', startOfDay(startDate).toISOString());
      if (endDate) query = query.lte('order_date', endOfDay(endDate).toISOString());

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(mapRowToOrder);
    } catch (error) {
      console.error('고객 주문 조회 오류:', error);
      toast({ variant: 'destructive', title: '조회 실패', description: '고객 주문 내역을 불러오지 못했습니다.' });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchOrdersForSettlement = useCallback(async (targetDateStr: string, startDateStr?: string) => {
    try {
      setLoading(true);
      lastFetchParamsRef.current = { type: 'default', days: 30 }; // Approximate for settlement re-sync

      const end = `${targetDateStr}T23:59:59.999`;
      // Buffer of 1 day before the target/start date to handle UTC/KST overlap
      const effectiveStart = startDateStr
        ? `${subDays(new Date(startDateStr), 1).toISOString().split('T')[0]}T00:00:00`
        : `${subDays(new Date(targetDateStr), 1).toISOString().split('T')[0]}T00:00:00`;


      let query = supabase
        .from('orders')
        .select('*')
        .or(`order_date.gte.${effectiveStart},payment->>completedAt.gte.${effectiveStart},transfer_info->>acceptedAt.gte.${effectiveStart}`)
        .filter('order_date', 'lte', end);

      const isAdmin =
        (userRef.current?.role as any) === '본사 관리자' ||
        (userRef.current?.role as any) === 'admin' ||
        (userRef.current?.role as any) === 'hq_manager' ||
        userRef.current?.email?.toLowerCase() === 'lilymag0301@gmail.com';
      const branchName = userRef.current?.branchName;

      if (!isAdmin && branchName && branchName !== '미정') {
        query = query.or(`branch_name.eq.${branchName},transfer_info->>processBranchName.eq.${branchName}`);
      }

      const { data, error } = await query
        .order('order_date', { ascending: false })
        .limit(5000);

      if (error) throw error;
      const ordersData = (data || []).map(mapRowToOrder);

      setOrders(prev => {
        const existingIds = new Set(ordersData.map(o => o.id));
        const filteredPrev = prev.filter(o => !existingIds.has(o.id));
        return [...ordersData, ...filteredPrev];
      });

      return ordersData;
    } catch (error) {
      console.error("정산 데이터 로딩 오류:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialFetch) {
      fetchOrders();
    }

    const triggerRefresh = () => {
      const params = lastFetchParamsRef.current;
      switch (params.type) {
        case 'range':
          if (params.start && params.end) fetchOrdersByRange(params.start, params.end);
          break;
        case 'calendar':
          if (params.start) fetchCalendarOrders(params.start);
          break;
        case 'all':
          fetchAllOrders();
          break;
        default:
          fetchOrders(params.days || 7);
      }
    };

    let debounceTimer: NodeJS.Timeout | null = null;

    // --- [Real-time Subscription] Act like Firebase (Atomic Updates) ---
    const channel = supabase
      .channel('orders-realtime-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const isAdmin =
            (userRef.current?.role as any) === '본사 관리자' ||
            (userRef.current?.role as any) === 'admin' ||
            (userRef.current?.role as any) === 'hq_manager' ||
            userRef.current?.email?.toLowerCase() === 'lilymag0301@gmail.com';
          const myBranch = userRef.current?.branchName;

          // 지점 권한 필터링
          if (!isAdmin && myBranch && myBranch !== '미정') {
            const row = payload.new as any || payload.old as any;
            if (row) {
              const isMine = row.branch_name === myBranch ||
                row.transfer_info?.processBranchName === myBranch;
              if (!isMine) return;
            }
          }

          // [핵심] 원자적 업데이트 (Atomic Update) - 전체 다시 불러오지 않고 메모리에서 교체
          if (payload.eventType === 'INSERT') {
            const mapped = mapRowToOrder(payload.new);
            setOrders(prev => [mapped, ...prev].slice(0, 5000)); // 최대 갯수 유지
          } else if (payload.eventType === 'UPDATE') {
            const mapped = mapRowToOrder(payload.new);
            setOrders(prev => prev.map(o => o.id === mapped.id ? mapped : o));
          } else if (payload.eventType === 'DELETE') {
            setOrders(prev => prev.filter(o => o.id === (payload.old as any).id));
          }

          // 서버와의 최종 동기화를 위해 백그라운드에서 지연 갱신 (선택 사항)
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            // triggerRefresh(); // 주석 처리: 실시간 원자 업데이트만으로도 충분하도록 설계
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);

      // 채널 클린업: 
      // 연결이 완료되기 전 해제가 발생할 경우의 경고 로그를 방지하기 위해 지연 처리
      if (channel) {
        setTimeout(() => {
          try {
            supabase.removeChannel(channel).catch(() => { });
          } catch (e) {
            // 조용히 처리
          }
        }, 0);
      }
    };
  }, [fetchOrders, fetchOrdersByRange, fetchCalendarOrders, fetchAllOrders, initialFetch]);

  // 실시간 동기화 (Background Silent Refresh)
  useEffect(() => {
    if (!initialFetch) return;

    let debounceTimer: NodeJS.Timeout;

    const channel = supabase
      .channel('orders-realtime-global')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => {
          // 실시간 업데이트 시에는 setLoading(true)를 하지 않고 배경에서 로드한다.
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            // fetchOrders() 내부에 setLoading(true)가 있으면 안 되므로 
            // 배경 로드용 별도 플래그나 로직이 필요할 수 있음.
            // 여기서는 fetchOrders를 직접 호출하되, 무거운 초기화는 방지.
            fetchOrders();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) {
        // 즉시 해제보다 약간의 여유를 두어 웹소켓 엉킴 방지
        setTimeout(() => {
          supabase.removeChannel(channel).catch(() => { });
        }, 100);
      }
    };
    // 의존성 배열을 극도로 단순화하여 무한 재연결 방지
  }, [initialFetch, fetchOrders]);

  const addOrder = async (orderData: OrderData): Promise<string | null> => {
    setLoading(true);
    try {
      const orderId = crypto.randomUUID();
      const orderDate = new Date(orderData.orderDate);
      const isImmediatePickup = orderData.receiptType === 'store_pickup';
      const status = isImmediatePickup ? 'completed' : orderData.status;

      const orderPayload = {
        id: orderId,
        order_number: orderData.orderNumber || `ORD-${Date.now()}`,
        status: status,
        receipt_type: orderData.receiptType,
        branch_id: orderData.branchId,
        branch_name: orderData.branchName,
        order_date: orderDate.toISOString(),
        orderer: orderData.orderer,
        delivery_info: orderData.deliveryInfo,
        pickup_info: orderData.pickupInfo,
        summary: orderData.summary,
        payment: {
          ...orderData.payment,
          completedAt: isSettled({ status: orderData.status, payment: orderData.payment }) ? new Date().toISOString() : null
        },
        items: orderData.items,
        message: orderData.message,
        request: orderData.request,
        source: orderData.source,
        is_anonymous: orderData.isAnonymous,
        register_customer: orderData.registerCustomer,
        order_type: orderData.orderType
      };

      const { error } = await supabase.from('orders').insert([orderPayload]);
      if (error) throw error;

      // Logic for stock updates, customer registration, etc.
      if (orderData.registerCustomer && !orderData.isAnonymous) {
        await registerCustomerFromOrder(orderData);
      } else if (orderData.orderer.id && (orderData.summary.pointsUsed || 0) > 0) {
        await deductCustomerPoints(orderData.orderer.id, orderData.summary.pointsUsed || 0);
      }

      const isExcelUpload = orderData.source === 'excel_upload' || orderData.items.some(item => item.source === 'excel_upload');

      for (const item of orderData.items) {
        if (!item.id || item.quantity <= 0) continue;

        if (!isExcelUpload) {
          // Normal order: Update stock
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', item.id)
            .eq('branch', orderData.branchName)
            .single();

          if (product) {
            const currentStock = product.stock || 0;
            const newStock = currentStock - item.quantity;
            await supabase.from('products').update({ stock: newStock }).eq('id', item.id).eq('branch', orderData.branchName);

            await supabase.from('stock_history').insert([{
              id: crypto.randomUUID(),
              type: 'out',
              item_type: 'product',
              item_id: item.id,
              item_name: item.name,
              quantity: item.quantity,
              from_stock: currentStock,
              to_stock: newStock,
              branch: orderData.branchName,
              operator: user?.email || "Unknown User",
              price: item.price,
              total_amount: item.price * item.quantity,
              created_at: new Date().toISOString()
            }]);
          }
        } else {
          // Excel upload: History only
          await supabase.from('stock_history').insert([{
            id: crypto.randomUUID(),
            type: 'excel_upload',
            item_type: 'excel_product',
            item_id: item.id,
            item_name: item.name,
            quantity: item.quantity,
            branch: orderData.branchName,
            operator: user?.email || "Excel Upload",
            price: item.price,
            total_amount: item.price * item.quantity,
            note: "엑셀 업로드 주문 - 재고 차감 없음",
            created_at: new Date().toISOString()
          }]);
        }
      }

      await updateDailyStats(orderDate, orderData.branchName, {
        revenueDelta: orderData.summary.total,
        orderCountDelta: 1,
        settledAmountDelta: isSettled({ status: orderData.status, payment: orderPayload.payment }) ? orderData.summary.total : 0
      });

      toast({ title: '성공', description: isImmediatePickup ? '매장픽업(즉시) 주문이 완료되었습니다.' : '새 주문이 추가되었습니다.' });
      await fetchOrders();
      return orderId;
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '주문 처리 오류', description: '주문 추가 중 오류가 발생했습니다.' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: 'processing' | 'completed' | 'canceled') => {
    try {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) return;

      const { error } = await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (error) throw error;

      if (isCanceled({ status: newStatus }) && !isCanceled(order)) {
        await updateDailyStats(new Date(order.order_date), order.branch_name, {
          revenueDelta: -(order.summary?.total || 0),
          orderCountDelta: -1,
          settledAmountDelta: isSettled(order) ? -(order.summary?.total || 0) : 0
        });
      }

      if (newStatus === 'completed') {
        // Update associated calendar events
        await supabase.from('calendar_events').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('related_id', orderId);

        // Update transfer info if applicable
        if (order.transfer_info?.isTransferred && order.transfer_info?.transferId) {
          await supabase.from('order_transfers').update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
            updated_at: new Date().toISOString()
          }).eq('id', order.transfer_info.transferId);
        }
      }

      toast({ title: '상태 변경 성공', description: `주문 상태가 '${newStatus}'(으)로 변경되었습니다.` });
      await fetchOrders();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '오류', description: '주문 상태 변경 중 오류 발생' });
    }
  };

  const updatePaymentStatus = async (orderId: string, newStatus: 'pending' | 'paid' | 'completed') => {
    try {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) return;

      const payment = { ...order.payment, status: newStatus };
      if (newStatus === 'paid' || newStatus === 'completed') {
        payment.completedAt = new Date().toISOString();
        if (payment.isSplitPayment || payment.status === 'split_payment') {
          payment.secondPaymentDate = new Date().toISOString();
        }
      } else {
        payment.completedAt = null;
      }

      const { error } = await supabase.from('orders').update({ payment, updated_at: new Date().toISOString() }).eq('id', orderId);
      if (error) throw error;

      const isNewSettled = isSettled({ status: order.status, payment });
      const wasSettled = isSettled(order);

      if (isNewSettled && !wasSettled) {
        await updateDailyStats(new Date(), order.branch_name, {
          revenueDelta: 0,
          orderCountDelta: 0,
          settledAmountDelta: order.summary?.total || 0
        });
      } else if (!isNewSettled && wasSettled) {
        const settleDate = order.payment?.completedAt ? new Date(order.payment.completedAt) : new Date();
        await updateDailyStats(settleDate, order.branch_name, {
          revenueDelta: 0,
          orderCountDelta: 0,
          settledAmountDelta: -(order.summary?.total || 0)
        });
      }

      toast({ title: '결제 상태 변경 성공', description: `결제 상태가 변경되었습니다.` });
      await fetchOrders();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '오류', description: '결제 상태 변경 중 오류 발생' });
    }
  };

  const updateOrder = async (orderId: string, data: Partial<OrderData>) => {
    setLoading(true);
    try {
      const { data: oldOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!oldOrder) throw new Error('주문을 찾을 수 없습니다.');

      const oldTotal = oldOrder.summary?.total || 0;
      const newTotal = (data.summary as any)?.total !== undefined ? (data.summary as any).total : oldTotal;
      const oldStatus = oldOrder.status;
      const newStatus = data.status || oldStatus;

      let revenueDelta = 0;
      if (oldStatus !== 'canceled' && newStatus === 'canceled') revenueDelta = -oldTotal;
      else if (oldStatus === 'canceled' && newStatus !== 'canceled') revenueDelta = newTotal;
      else if (oldStatus !== 'canceled' && newStatus !== 'canceled') revenueDelta = newTotal - oldTotal;

      const oldSettled = isSettled(oldOrder) && !isCanceled(oldOrder);
      const newSettled = isSettled({ status: newStatus, payment: data.payment || oldOrder.payment }) && !isCanceled({ status: newStatus });

      let settledDelta = 0;
      if (!oldSettled && newSettled) settledDelta = newTotal;
      else if (oldSettled && !newSettled) settledDelta = -oldTotal;
      else if (oldSettled && newSettled) settledDelta = newTotal - oldTotal;

      // Transform data to snake_case for PostgreSQL
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (data.status) updatePayload.status = data.status;
      if (data.summary) updatePayload.summary = data.summary;
      if (data.payment) updatePayload.payment = data.payment;
      if (data.orderer) updatePayload.orderer = data.orderer;
      if (data.items) updatePayload.items = data.items;
      if (data.deliveryInfo) updatePayload.delivery_info = data.deliveryInfo;
      if (data.pickupInfo) updatePayload.pickup_info = data.pickupInfo;
      if (data.outsourceInfo) updatePayload.outsource_info = data.outsourceInfo;
      if (data.request) updatePayload.request = data.request;

      // New delivery cost fields mapping
      if (data.actualDeliveryCost !== undefined) updatePayload.actual_delivery_cost = data.actualDeliveryCost;
      if (data.actualDeliveryCostCash !== undefined) updatePayload.actual_delivery_cost_cash = data.actualDeliveryCostCash;
      if (data.deliveryCostStatus) updatePayload.delivery_cost_status = data.deliveryCostStatus;
      if (data.deliveryCostUpdatedAt) updatePayload.delivery_cost_updated_at = data.deliveryCostUpdatedAt;
      if (data.deliveryCostUpdatedBy) updatePayload.delivery_cost_updated_by = data.deliveryCostUpdatedBy;
      if (data.deliveryCostReason) updatePayload.delivery_cost_reason = data.deliveryCostReason;
      if (data.deliveryProfit !== undefined) updatePayload.delivery_profit = data.deliveryProfit;

      if (data.message) {
        updatePayload.message = data.message;

        // Also keep in extra_data for safety/migration period if needed, 
        // but primarily update the column.
        const currentExtraData = oldOrder.extra_data || {};
        updatePayload.extra_data = {
          ...currentExtraData,
          message: data.message
        };
      }

      const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
      if (error) {
        console.error('Supabase updateOrder error:', error);
        throw error;
      }

      // --- [Auto-Sync Logic] Sync Delivery Cost (Standard & Cash) to Simple Expenses ---
      // 동기화 로직: 
      // 1. 실제 배송료(Standard): 주문 수정 시 입력한 '실제 배송비(actualDeliveryCost)'를 지출로 기록 (전산 배송비 아님, 사용자가 직접 입력한 값)
      // 2. 추가 현금 배송비(Cash): 기사님께 별도로 드리는 현금(actualDeliveryCostCash)을 지출로 기록 (현금출납장에 반영됨)

      const newDeliveryCost = data.actualDeliveryCost !== undefined ? data.actualDeliveryCost : oldOrder.actual_delivery_cost;
      const newDeliveryCash = data.actualDeliveryCostCash !== undefined ? data.actualDeliveryCostCash : oldOrder.actual_delivery_cost_cash;

      const supplierName = data.deliveryInfo?.driverName || oldOrder.delivery_info?.driverName || '배송기사';
      const expenseDate = data.deliveryInfo?.date || oldOrder.delivery_info?.date || new Date().toISOString();
      const recipientName = oldOrder.delivery_info?.recipientName || oldOrder.orderer?.name || '미지정';

      if (data.actualDeliveryCost !== undefined || data.actualDeliveryCostCash !== undefined || data.deliveryInfo !== undefined) {

        // Determine which branch pays for the expense
        let expenseBranchId = oldOrder.branch_id;
        let expenseBranchName = oldOrder.branch_name;

        // If transferred and accepted/completed, the processing branch pays
        const tInfo = oldOrder.transfer_info || oldOrder.extra_data?.transfer_info;
        if (tInfo?.isTransferred && tInfo.processBranchId && ['accepted', 'completed'].includes(tInfo.status)) {
          expenseBranchId = tInfo.processBranchId;
          expenseBranchName = tInfo.processBranchName;
        }

        // 1. 기존 지출 내역 모두 조회 (relatedOrderId 이용)
        const { data: existingExpenses } = await supabase
          .from('simple_expenses')
          .select('id, extra_data, description')
          .contains('extra_data', { relatedOrderId: orderId });

        // --- A. 실제 배송비 (Standard) 처리 ---
        const standardExpense = existingExpenses?.find(e =>
          e.extra_data?.type === 'standard_delivery_fee' ||
          (!e.extra_data?.type && e.description.includes('실제 배송료')) // 하위 호환성
        );

        if (newDeliveryCost && newDeliveryCost > 0) {
          const standardPayload = {
            expense_date: expenseDate,
            amount: newDeliveryCost,
            category: 'transport',
            sub_category: 'DELIVERY',
            description: `실제 배송료 - ${recipientName}`,
            supplier: supplierName,
            branch_id: expenseBranchId,
            branch_name: expenseBranchName,
            updated_at: new Date().toISOString(),
            extra_data: {
              ...(standardExpense?.extra_data as object || {}),
              relatedOrderId: orderId,
              type: 'standard_delivery_fee'
            }
          };

          if (standardExpense) {
            await supabase.from('simple_expenses').update(standardPayload).eq('id', standardExpense.id);
          } else {
            await supabase.from('simple_expenses').insert([{
              ...standardPayload,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString()
            }]);
          }
        } else if (standardExpense) {
          // 금액이 0원이거나 없는데 기존 내역이 있으면 삭제
          await supabase.from('simple_expenses').delete().eq('id', standardExpense.id);
        }

        // --- B. 기사님 현금 지급 (Cash) 처리 ---
        const cashExpense = existingExpenses?.find(e =>
          e.extra_data?.type === 'driver_cash_payment' ||
          (!e.extra_data?.type && (e.description.includes('추가현금') || e.description.includes('현금지급') || e.description.includes('배송비 현금지급'))) // 하위 호환성
        );

        if (newDeliveryCash && newDeliveryCash > 0) {
          const cashPayload = {
            expense_date: expenseDate,
            amount: newDeliveryCash,
            category: 'transport', // 운송비
            sub_category: 'DELIVERY',
            description: `추가현금배송비 - ${recipientName}`,
            supplier: supplierName,
            branch_id: expenseBranchId,
            branch_name: expenseBranchName,
            updated_at: new Date().toISOString(),
            extra_data: {
              ...(cashExpense?.extra_data as object || {}),
              relatedOrderId: orderId,
              type: 'driver_cash_payment',
              payment_method: 'cash' // 현금 지급 명시
            }
          };

          if (cashExpense) {
            await supabase.from('simple_expenses').update(cashPayload).eq('id', cashExpense.id);
          } else {
            await supabase.from('simple_expenses').insert([{
              ...cashPayload,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString()
            }]);
          }
        } else if (cashExpense) {
          // 금액이 0원이거나 없는데 기존 내역이 있으면 삭제
          await supabase.from('simple_expenses').delete().eq('id', cashExpense.id);
        }
      }
      // -----------------------------------------------------------

      if (revenueDelta !== 0 || settledDelta !== 0) {
        await updateDailyStats(new Date(oldOrder.order_date), oldOrder.branch_name, {
          revenueDelta,
          orderCountDelta: 0,
          settledAmountDelta: settledDelta
        });
      }

      toast({ title: "성공", description: "주문 정보가 수정되었습니다." });
      await fetchOrders();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '오류', description: '주문 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string, reason?: string) => {
    setLoading(true);
    try {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      const pointsUsed = order.summary?.pointsUsed || 0;
      const pointsEarned = order.summary?.pointsEarned || 0;

      if (pointsUsed > 0 || pointsEarned > 0) {
        let customerId = order.orderer?.id;
        if (!customerId && order.orderer?.contact) {
          const { data: customer } = await supabase.from('customers').select('id').eq('contact', order.orderer.contact).eq('is_deleted', false).maybeSingle();
          if (customer) customerId = customer.id;
        }

        if (customerId) {
          if (pointsUsed > 0) await refundCustomerPoints(customerId, pointsUsed);
          if (pointsEarned > 0) await deductCustomerPoints(customerId, pointsEarned);
        }
      }

      await supabase.from('orders').update({
        status: 'canceled',
        summary: { ...order.summary, subtotal: 0, discountAmount: 0, deliveryFee: 0, pointsUsed: 0, pointsEarned: 0, total: 0 },
        cancel_reason: reason || '고객 요청으로 취소',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', orderId);

      await updateDailyStats(new Date(order.order_date), order.branch_name, {
        revenueDelta: -(order.summary?.total || 0),
        orderCountDelta: -1,
        settledAmountDelta: isSettled(order) ? -(order.summary?.total || 0) : 0
      });

      toast({ title: "주문 취소 완료", description: "주문이 취소되었습니다." });
      await fetchOrders();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "주문 취소 실패", description: "오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      const pointsUsed = order.summary?.pointsUsed || 0;
      const pointsEarned = order.summary?.pointsEarned || 0;

      if (pointsUsed > 0 || pointsEarned > 0) {
        let customerId = order.orderer?.id;
        if (!customerId && order.orderer?.contact) {
          const { data: customer } = await supabase.from('customers').select('id').eq('contact', order.orderer.contact).eq('is_deleted', false).maybeSingle();
          if (customer) customerId = customer.id;
        }
        if (customerId) {
          if (pointsUsed > 0) await refundCustomerPoints(customerId, pointsUsed);
          if (pointsEarned > 0) await deductCustomerPoints(customerId, pointsEarned);
        }
      }

      await supabase.from('order_transfers').delete().eq('original_order_id', orderId);
      await supabase.from('orders').delete().eq('id', orderId);

      if (!isCanceled(order)) {
        await updateDailyStats(new Date(order.order_date), order.branch_name, {
          revenueDelta: -(order.summary?.total || 0),
          orderCountDelta: -1,
          settledAmountDelta: isSettled(order) ? -(order.summary?.total || 0) : 0
        });
      }

      toast({ title: "주문 삭제 완료", description: "모든 관련 데이터가 삭제되었습니다." });
      await fetchOrders();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "주문 삭제 실패", description: "오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const completeDelivery = async (orderId: string, completionPhotoUrl?: string, completedBy?: string) => {
    try {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      const deliveryInfo = {
        ...order.delivery_info,
        completion_photo_url: completionPhotoUrl,
        completed_at: new Date().toISOString(),
        completed_by: completedBy || user?.id || 'system'
      };

      await supabase.from('orders').update({
        status: 'completed',
        delivery_info: deliveryInfo,
        updated_at: new Date().toISOString()
      }).eq('id', orderId);

      if (order.orderer?.email) {
        const settings = { autoEmailDeliveryComplete: true, siteName: '릴리맥 플라워샵' };
        const { sendDeliveryCompleteEmail } = await import('@/lib/email-service');
        await sendDeliveryCompleteEmail(order.orderer.email, order.orderer.name, orderId, new Date().toLocaleDateString('ko-KR'), settings as any, completionPhotoUrl);
      }

      await supabase.from('calendar_events').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('related_id', orderId);
      await fetchOrders();
      toast({ title: "배송완료 처리됨", description: "처리가 완료되었습니다." });
    } catch (error) {
      console.error(error);
      toast({ title: "오류", description: "실패했습니다.", variant: "destructive" });
    }
  };

  return {
    orders,
    loading,
    addOrder,
    fetchOrders,
    fetchOrdersByRange,
    fetchAllOrders,
    updateOrderStatus,
    updatePaymentStatus,
    updateOrder,
    cancelOrder,
    deleteOrder,
    completeDelivery,
    fetchOrdersForSettlement,
    fetchOrdersByCustomer,
    fetchCalendarOrders,
    fetchOrdersBySchedule,
    isRefreshing
  };
}

const registerCustomerFromOrder = async (orderData: OrderData) => {
  try {
    const { data: customer } = await supabase.from('customers').select('*').eq('contact', orderData.orderer.contact).eq('is_deleted', false).maybeSingle();
    const customerPayload = {
      name: orderData.orderer.name,
      contact: orderData.orderer.contact,
      email: orderData.orderer.email || '',
      company_name: orderData.orderer.company || '',
      type: orderData.orderer.company ? 'company' : 'personal',
      branch: orderData.branchName,
      grade: '신규',
      total_spent: orderData.summary.total,
      order_count: 1,
      points: Math.floor(orderData.summary.total * 0.02) - (orderData.summary.pointsUsed || 0),
      last_order_date: new Date().toISOString(),
      is_deleted: false,
      primary_branch: orderData.branchName,
      updated_at: new Date().toISOString()
    };

    if (customer) {
      await supabase.from('customers').update({
        ...customerPayload,
        total_spent: (customer.total_spent || 0) + orderData.summary.total,
        order_count: (customer.order_count || 0) + 1,
        points: (customer.points || 0) - (orderData.summary.pointsUsed || 0) + Math.floor(orderData.summary.total * 0.02),
        grade: customer.grade || '신규'
      }).eq('id', customer.id);
    } else {
      await supabase.from('customers').insert([{ ...customerPayload, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
    }
  } catch (e) { console.error(e); }
};

const deductCustomerPoints = async (customerId: string, points: number) => {
  const { data } = await supabase.from('customers').select('points').eq('id', customerId).single();
  if (data) {
    await supabase.from('customers').update({ points: Math.max(0, (data.points || 0) - points), updated_at: new Date().toISOString() }).eq('id', customerId);
  }
};

const refundCustomerPoints = async (customerId: string, points: number) => {
  const { data } = await supabase.from('customers').select('points').eq('id', customerId).single();
  if (data) {
    await supabase.from('customers').update({ points: (data.points || 0) + points, updated_at: new Date().toISOString() }).eq('id', customerId);
  }
};
