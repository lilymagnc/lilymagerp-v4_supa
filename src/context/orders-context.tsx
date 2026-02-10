"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { updateDailyStats } from '@/lib/stats-utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { isSettled, isCanceled } from '@/lib/order-utils';
import type { Order, OrderData, PaymentStatus } from '@/hooks/use-orders';

// ===== Context Interface =====
interface OrdersContextType {
    orders: Order[];
    loading: boolean;
    isRefreshing: boolean;
    fetchOrders: (days?: number) => Promise<void>;
    fetchOrdersByRange: (start: Date, end: Date) => Promise<Order[]>;
    fetchAllOrders: () => Promise<Order[]>;
    fetchCalendarOrders: (baseDate: Date) => Promise<Order[]>;
    fetchOrdersBySchedule: (startDate: Date, endDate: Date) => Promise<Order[]>;
    fetchOrdersByCustomer: (customerId: string, startDate?: Date, endDate?: Date) => Promise<Order[]>;
    fetchOrdersForSettlement: (targetDateStr: string, startDateStr?: string) => Promise<Order[]>;
    addOrder: (orderData: OrderData) => Promise<string | null>;
    updateOrderStatus: (orderId: string, newStatus: 'processing' | 'completed' | 'canceled') => Promise<void>;
    updatePaymentStatus: (orderId: string, newStatus: PaymentStatus, splitData?: any) => Promise<void>;
    updateOrder: (orderId: string, updates: Partial<OrderData>) => Promise<void>;
    cancelOrder: (orderId: string) => Promise<void>;
    deleteOrder: (orderId: string) => Promise<void>;
    completeDelivery: (orderId: string, photoUrl: string, userId: string) => Promise<void>;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const OrdersContext = createContext<OrdersContextType | null>(null);

// ===== Hook to consume context =====
export function useOrdersContext() {
    return useContext(OrdersContext);
}

// ===== Map DB row to Order object =====
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
    productNames: row.product_names || row.productNames || (row.items && row.items.length > 0 ? row.items.map((i: any) => i.name).join(', ') : '상품 미지정'),
    pickupInfo: row.pickup_info ? {
        ...row.pickup_info,
        time: row.pickup_info.time ? row.pickup_info.time.substring(0, 5) : ''
    } : null,
    deliveryInfo: row.delivery_info ? {
        ...row.delivery_info,
        time: row.delivery_info.time ? row.delivery_info.time.substring(0, 5) : ''
    } : null,
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

// ===== Provider Component =====
export function OrdersProvider({ children }: { children: ReactNode }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    const hasOrdersRef = useRef(false);
    useEffect(() => { hasOrdersRef.current = orders.length > 0; }, [orders.length]);

    // Track current fetch params for potential re-fetch
    const lastFetchParamsRef = useRef<{
        type: 'default' | 'range' | 'all' | 'calendar' | 'schedule';
        days?: number;
        start?: Date;
        end?: Date;
    }>({ type: 'default', days: 7 });

    // ===== Helper: Admin check =====
    const getAdminStatus = useCallback(() => {
        const u = userRef.current;
        return u?.email?.toLowerCase() === 'lilymag0301@gmail.com' ||
            (u?.role as any) === '본사 관리자' ||
            (u?.role as any) === 'admin' ||
            (u?.role as any) === 'hq_manager';
    }, []);

    const getBranch = useCallback(() => {
        const u = userRef.current;
        return u?.franchise || u?.branchName;
    }, []);

    // ===== Fetch Functions =====
    const fetchOrders = useCallback(async (days: number = 7) => {
        const controller = new AbortController();
        const signal = controller.signal;

        try {
            lastFetchParamsRef.current = { type: 'default', days };

            if (!hasOrdersRef.current) setLoading(true);
            else setIsRefreshing(true);

            const startDate = subDays(startOfDay(new Date()), days).toISOString();
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;
            const isAdmin = getAdminStatus();
            const myBranch = getBranch();

            while (hasMore) {
                if (signal.aborted) throw new Error('Aborted');

                let query = supabase
                    .from('orders')
                    .select('*')
                    .or(`order_date.gte.${startDate},payment->>completedAt.gte.${startDate},transfer_info->>acceptedAt.gte.${startDate}`);

                if (!isAdmin && myBranch && myBranch !== '미정') {
                    query = query.or(`branch_name.eq.${myBranch},transfer_info->>processBranchName.eq.${myBranch}`);
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
                console.error('[Orders] 데이터 로딩 오류:', error);
            }
        } finally {
            if (!signal.aborted) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [getAdminStatus, getBranch]);

    const fetchCalendarOrders = useCallback(async (baseDate: Date) => {
        try {
            if (!hasOrdersRef.current) setLoading(true);
            else setIsRefreshing(true);

            lastFetchParamsRef.current = { type: 'calendar', start: baseDate };

            const startFilterDate = subDays(startOfDay(baseDate), 35).toISOString().split('T')[0];
            let query = supabase
                .from('orders')
                .select('*')
                .or(`pickup_info->>date.gte.${startFilterDate},delivery_info->>date.gte.${startFilterDate},order_date.gte.${startFilterDate}`);

            const isAdmin = getAdminStatus();
            const myBranch = getBranch();

            if (!isAdmin && myBranch && myBranch !== '미정') {
                query = query.or(`branch_name.eq.${myBranch},transfer_info->>processBranchName.eq.${myBranch}`);
            }

            const { data, error } = await query.order('order_date', { ascending: false }).limit(2000);

            if (error) throw error;
            const ordersData = (data || []).map(mapRowToOrder);
            setOrders(ordersData);
            return ordersData;
        } catch (error) {
            console.error('[Orders] 캘린더 주문 로딩 오류:', error);
            return [];
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [getAdminStatus, getBranch]);

    const fetchOrdersBySchedule = useCallback(async (startDate: Date, endDate: Date) => {
        try {
            setLoading(true);
            const startStr = startOfDay(startDate).toISOString().split('T')[0];
            const endStr = endOfDay(endDate).toISOString().split('T')[0];

            const { data: pickupData, error: pickupError } = await supabase
                .from('orders').select('*')
                .gte('pickup_info->>date', startStr)
                .lte('pickup_info->>date', endStr);
            if (pickupError) throw pickupError;

            const { data: deliveryData, error: deliveryError } = await supabase
                .from('orders').select('*')
                .gte('delivery_info->>date', startStr)
                .lte('delivery_info->>date', endStr);
            if (deliveryError) throw deliveryError;

            const allOrders = [...(pickupData || []), ...(deliveryData || [])];
            const uniqueOrdersMap = new Map();
            allOrders.forEach(o => uniqueOrdersMap.set(o.id, o));
            const ordersData = Array.from(uniqueOrdersMap.values()).map(mapRowToOrder);
            ordersData.sort((a, b) => {
                const dateA = a.pickupInfo?.date || a.deliveryInfo?.date || '';
                const dateB = b.pickupInfo?.date || b.deliveryInfo?.date || '';
                if (dateA !== dateB) return dateB.localeCompare(dateA);
                return (b.pickupInfo?.time || b.deliveryInfo?.time || '').localeCompare(a.pickupInfo?.time || a.deliveryInfo?.time || '');
            });
            setOrders(ordersData);
            return ordersData;
        } catch (error) {
            console.error('[Orders] 스케줄 조회 오류:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOrdersByRange = useCallback(async (start: Date, end: Date) => {
        try {
            lastFetchParamsRef.current = { type: 'range', start, end };
            if (!hasOrdersRef.current) setLoading(true);
            else setIsRefreshing(true);

            const rangeStart = startOfDay(start).toISOString();
            const rangeEnd = endOfDay(end).toISOString();
            let allOrders: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;
            const isAdmin = getAdminStatus();
            const myBranch = getBranch();

            while (hasMore) {
                let query = supabase.from('orders').select('*')
                    .gte('order_date', rangeStart)
                    .lte('order_date', rangeEnd);

                if (!isAdmin && myBranch && myBranch !== '미정') {
                    query = query.or(`branch_name.eq.${myBranch},transfer_info->>processBranchName.eq.${myBranch}`);
                }

                const { data, error } = await query
                    .order('order_date', { ascending: false })
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allOrders = [...allOrders, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
                if (allOrders.length >= 20000) break;
            }

            const ordersData = allOrders.map(mapRowToOrder);
            setOrders(ordersData);
            return ordersData;
        } catch (error) {
            console.error('[Orders] 기간 주문 로딩 오류:', error);
            setOrders([]);
            return [];
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [getAdminStatus, getBranch]);

    const fetchAllOrders = useCallback(async () => {
        try {
            if (!hasOrdersRef.current) setLoading(true);
            else setIsRefreshing(true);

            const { data, error } = await supabase
                .from('orders').select('*')
                .order('order_date', { ascending: false })
                .limit(10000);

            if (error) throw error;
            const ordersData = (data || []).map(mapRowToOrder);
            setOrders(ordersData);
            return ordersData;
        } catch (error) {
            console.error('[Orders] 전체 주문 로딩 오류:', error);
            return [];
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    const fetchOrdersByCustomer = useCallback(async (customerId: string, startDate?: Date, endDate?: Date) => {
        try {
            let query = supabase.from('orders').select('*')
                .eq('orderer->>id', customerId)
                .order('order_date', { ascending: false });
            if (startDate) query = query.gte('order_date', startOfDay(startDate).toISOString());
            if (endDate) query = query.lte('order_date', endOfDay(endDate).toISOString());
            const { data, error } = await query;
            if (error) throw error;
            return (data || []).map(mapRowToOrder);
        } catch (error) {
            console.error('[Orders] 고객 주문 조회 오류:', error);
            toast({ variant: 'destructive', title: '조회 실패', description: '고객 주문 내역을 불러오지 못했습니다.' });
            return [];
        }
    }, [toast]);

    const fetchOrdersForSettlement = useCallback(async (targetDateStr: string, startDateStr?: string) => {
        try {
            setLoading(true);
            lastFetchParamsRef.current = { type: 'default', days: 30 };

            const end = `${targetDateStr}T23:59:59.999`;
            const effectiveStart = startDateStr
                ? `${subDays(new Date(startDateStr), 1).toISOString().split('T')[0]}T00:00:00`
                : `${subDays(new Date(targetDateStr), 1).toISOString().split('T')[0]}T00:00:00`;

            let query = supabase.from('orders').select('*')
                .or(`order_date.gte.${effectiveStart},payment->>completedAt.gte.${effectiveStart},transfer_info->>acceptedAt.gte.${effectiveStart}`)
                .filter('order_date', 'lte', end);

            const isAdmin = getAdminStatus();
            const myBranch = getBranch();
            if (!isAdmin && myBranch && myBranch !== '미정') {
                query = query.or(`branch_name.eq.${myBranch},transfer_info->>processBranchName.eq.${myBranch}`);
            }

            const { data, error } = await query.order('order_date', { ascending: false }).limit(5000);
            if (error) throw error;
            const ordersData = (data || []).map(mapRowToOrder);

            setOrders(prev => {
                const existingIds = new Set(ordersData.map(o => o.id));
                const filteredPrev = prev.filter(o => !existingIds.has(o.id));
                return [...ordersData, ...filteredPrev];
            });

            return ordersData;
        } catch (error) {
            console.error('[Orders] 정산 데이터 로딩 오류:', error);
            return [];
        } finally {
            setLoading(false);
        }
    }, [getAdminStatus, getBranch]);

    // ===== Mutation Functions =====
    const addOrder = useCallback(async (orderData: OrderData): Promise<string | null> => {
        setLoading(true);
        try {
            const orderId = crypto.randomUUID();
            const orderDate = new Date(orderData.orderDate);
            const isImmediatePickup = orderData.receiptType === 'store_pickup';
            const status = isImmediatePickup ? 'completed' : orderData.status;

            const orderPayload = {
                id: orderId,
                order_number: orderData.orderNumber || `ORD-${Date.now()}`,
                status,
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

            // Customer registration
            if (orderData.registerCustomer && !orderData.isAnonymous) {
                await registerCustomerFromOrder(orderData);
            } else if (orderData.orderer.id && (orderData.summary.pointsUsed || 0) > 0) {
                await deductCustomerPoints(orderData.orderer.id, orderData.summary.pointsUsed || 0);
            }

            const isExcelUpload = orderData.source === 'excel_upload' || orderData.items.some(item => item.source === 'excel_upload');

            for (const item of orderData.items) {
                if (!item.id || item.quantity <= 0) continue;
                if (!isExcelUpload) {
                    const { data: product } = await supabase.from('products').select('stock')
                        .eq('id', item.id).eq('branch', orderData.branchName).single();
                    if (product) {
                        const currentStock = product.stock || 0;
                        const newStock = currentStock - item.quantity;
                        await supabase.from('products').update({ stock: newStock }).eq('id', item.id).eq('branch', orderData.branchName);
                        await supabase.from('stock_history').insert([{
                            id: crypto.randomUUID(), type: 'out', item_type: 'product', item_id: item.id,
                            item_name: item.name, quantity: item.quantity, from_stock: currentStock, to_stock: newStock,
                            branch: orderData.branchName, operator: user?.email || "Unknown User",
                            price: item.price, total_amount: item.price * item.quantity, created_at: new Date().toISOString()
                        }]);
                    }
                } else {
                    await supabase.from('stock_history').insert([{
                        id: crypto.randomUUID(), type: 'excel_upload', item_type: 'excel_product', item_id: item.id,
                        item_name: item.name, quantity: item.quantity, branch: orderData.branchName,
                        operator: user?.email || "Excel Upload", price: item.price,
                        total_amount: item.price * item.quantity, note: "엑셀 업로드 주문 - 재고 차감 없음",
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
            console.error('[Orders] 주문 추가 오류:', error);
            toast({ variant: 'destructive', title: '주문 처리 오류', description: '주문 추가 중 오류가 발생했습니다.' });
            return null;
        } finally {
            setLoading(false);
        }
    }, [user, toast, fetchOrders]);

    const updateOrderStatus = useCallback(async (orderId: string, newStatus: 'processing' | 'completed' | 'canceled') => {
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
                const now = new Date().toISOString();
                await supabase.from('orders').update({
                    'payment': { ...order.payment, status: 'paid', completedAt: now },
                    completed_at: now,
                    completed_by: user?.email || 'system'
                }).eq('id', orderId);

                if (!isSettled(order)) {
                    await updateDailyStats(new Date(order.order_date), order.branch_name, {
                        revenueDelta: 0, orderCountDelta: 0,
                        settledAmountDelta: order.summary?.total || 0
                    });
                }
            }

            // Atomic update in memory
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            toast({ title: '상태 변경 완료' });
        } catch (error) {
            console.error('[Orders] 상태 변경 오류:', error);
            toast({ variant: 'destructive', title: '상태 변경 실패' });
        }
    }, [user, toast]);

    const updatePaymentStatus = useCallback(async (orderId: string, newStatus: PaymentStatus, splitData?: any) => {
        try {
            const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
            if (!order) return;

            const now = new Date().toISOString();
            const updatedPayment = { ...order.payment, status: newStatus };
            if (newStatus === 'paid' || newStatus === 'completed') updatedPayment.completedAt = now;
            if (splitData) Object.assign(updatedPayment, splitData);

            const { error } = await supabase.from('orders').update({ payment: updatedPayment, updated_at: now }).eq('id', orderId);
            if (error) throw error;

            const wasSettled = isSettled(order);
            const isNowSettled = isSettled({ ...order, payment: updatedPayment });

            if (!wasSettled && isNowSettled) {
                await updateDailyStats(new Date(order.order_date), order.branch_name, {
                    revenueDelta: 0, orderCountDelta: 0,
                    settledAmountDelta: order.summary?.total || 0
                });
            }

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment: updatedPayment } : o));
            toast({ title: '결제 상태 변경 완료' });
        } catch (error) {
            console.error('[Orders] 결제 상태 변경 오류:', error);
            toast({ variant: 'destructive', title: '결제 상태 변경 실패' });
        }
    }, [toast]);

    const updateOrder = useCallback(async (orderId: string, updates: Partial<OrderData>) => {
        try {
            const updatePayload: any = { updated_at: new Date().toISOString() };
            if (updates.items) updatePayload.items = updates.items;
            if (updates.summary) updatePayload.summary = updates.summary;
            if (updates.orderer) updatePayload.orderer = updates.orderer;
            if (updates.deliveryInfo !== undefined) updatePayload.delivery_info = updates.deliveryInfo;
            if (updates.pickupInfo !== undefined) updatePayload.pickup_info = updates.pickupInfo;
            if (updates.message) updatePayload.message = updates.message;
            if (updates.request !== undefined) updatePayload.request = updates.request;
            if (updates.payment) updatePayload.payment = updates.payment;
            if (updates.status) updatePayload.status = updates.status;
            if (updates.branchId) updatePayload.branch_id = updates.branchId;
            if (updates.branchName) updatePayload.branch_name = updates.branchName;
            if (updates.receiptType) updatePayload.receipt_type = updates.receiptType;
            if (updates.actualDeliveryCost !== undefined) updatePayload.actual_delivery_cost = updates.actualDeliveryCost;
            if (updates.actualDeliveryCostCash !== undefined) updatePayload.actual_delivery_cost_cash = updates.actualDeliveryCostCash;
            if (updates.deliveryCostStatus !== undefined) updatePayload.delivery_cost_status = updates.deliveryCostStatus;
            if (updates.deliveryCostReason !== undefined) updatePayload.delivery_cost_reason = updates.deliveryCostReason;
            if (updates.deliveryProfit !== undefined) updatePayload.delivery_profit = updates.deliveryProfit;
            if ((updates as any).outsourceInfo !== undefined) updatePayload.outsource_info = (updates as any).outsourceInfo;

            const { error } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
            if (error) throw error;

            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
            toast({ title: '주문 수정 완료' });
        } catch (error) {
            console.error('[Orders] 주문 수정 오류:', error);
            toast({ variant: 'destructive', title: '주문 수정 실패' });
        }
    }, [toast]);

    const cancelOrder = useCallback(async (orderId: string) => {
        await updateOrderStatus(orderId, 'canceled');
    }, [updateOrderStatus]);

    const deleteOrder = useCallback(async (orderId: string) => {
        try {
            const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
            if (!order) return;

            const { error } = await supabase.from('orders').delete().eq('id', orderId);
            if (error) throw error;

            if (!isCanceled(order)) {
                await updateDailyStats(new Date(order.order_date), order.branch_name, {
                    revenueDelta: -(order.summary?.total || 0),
                    orderCountDelta: -1,
                    settledAmountDelta: isSettled(order) ? -(order.summary?.total || 0) : 0
                });
            }

            setOrders(prev => prev.filter(o => o.id !== orderId));
            toast({ title: '주문 삭제 완료' });
        } catch (error) {
            console.error('[Orders] 주문 삭제 오류:', error);
            toast({ variant: 'destructive', title: '주문 삭제 실패' });
        }
    }, [toast]);

    const completeDelivery = useCallback(async (orderId: string, photoUrl: string, userId: string) => {
        try {
            const now = new Date().toISOString();
            const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
            if (!order) return;

            const updatedDeliveryInfo = { ...order.delivery_info, completionPhotoUrl: photoUrl, completedAt: now, completedBy: userId };
            const { error } = await supabase.from('orders').update({
                delivery_info: updatedDeliveryInfo,
                status: 'completed',
                completed_at: now,
                completed_by: userId,
                updated_at: now
            }).eq('id', orderId);

            if (error) throw error;
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, deliveryInfo: updatedDeliveryInfo, status: 'completed' } : o));
            toast({ title: '배송 완료 처리되었습니다.' });
        } catch (error) {
            console.error('[Orders] 배송 완료 오류:', error);
            toast({ variant: 'destructive', title: '배송 완료 처리 실패' });
        }
    }, [toast]);

    // ===== Initial Fetch + Realtime Subscription (한번만!) =====
    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('orders-global-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                const isAdmin = getAdminStatus();
                const myBranchName = getBranch();

                if (!isAdmin && myBranchName && myBranchName !== '미정') {
                    const row = payload.new as any || payload.old as any;
                    if (row) {
                        const isMine = row.branch_name === myBranchName || row.transfer_info?.processBranchName === myBranchName;
                        if (!isMine) return;
                    }
                }

                if (payload.eventType === 'INSERT') {
                    const mapped = mapRowToOrder(payload.new);
                    setOrders(prev => [mapped, ...prev].slice(0, 5000));
                } else if (payload.eventType === 'UPDATE') {
                    const mapped = mapRowToOrder(payload.new);
                    setOrders(prev => prev.map(o => o.id === mapped.id ? mapped : o));
                } else if (payload.eventType === 'DELETE') {
                    setOrders(prev => prev.filter(o => o.id !== (payload.old as any).id));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel).catch(() => { });
        };
    }, [fetchOrders, getAdminStatus, getBranch]);

    return (
        <OrdersContext.Provider value={{
            orders, loading, isRefreshing, setOrders,
            fetchOrders, fetchOrdersByRange, fetchAllOrders, fetchCalendarOrders,
            fetchOrdersBySchedule, fetchOrdersByCustomer, fetchOrdersForSettlement,
            addOrder, updateOrderStatus, updatePaymentStatus, updateOrder,
            cancelOrder, deleteOrder, completeDelivery
        }}>
            {children}
        </OrdersContext.Provider>
    );
}

// ===== Helper functions (same as use-orders.ts) =====
async function registerCustomerFromOrder(orderData: OrderData) {
    try {
        const { data: existing } = await supabase.from('customers').select('id')
            .eq('contact', orderData.orderer.contact).single();
        if (existing) return;

        await supabase.from('customers').insert([{
            id: crypto.randomUUID(),
            name: orderData.orderer.name,
            contact: orderData.orderer.contact,
            company: orderData.orderer.company || '',
            email: orderData.orderer.email || '',
            branch: orderData.branchName,
            total_orders: 1,
            total_amount: orderData.summary.total,
            is_deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }]);
    } catch (e) { /* silent */ }
}

async function deductCustomerPoints(customerId: string, points: number) {
    try {
        const { data } = await supabase.from('customers').select('points').eq('id', customerId).single();
        if (data) {
            await supabase.from('customers').update({ points: Math.max(0, (data.points || 0) - points) }).eq('id', customerId);
        }
    } catch (e) { /* silent */ }
}
