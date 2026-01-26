"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { updateDailyStats } from '@/lib/stats-utils';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';
import { subDays, startOfDay } from 'date-fns';
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
    type: "card" | "ribbon";
    content: string;
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

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

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
      // Normalize legacy ribbon formats if content is missing
      if (msg.type === 'ribbon' && !msg.content) {
        if (msg.ribbon_left || msg.ribbon_right) {
          // Standard: Right=Content(Congratz), Left=Sender
          msg.content = `${msg.ribbon_right || ''}\n---\n${msg.ribbon_left || ''}`;
        } else if (msg.start || msg.end) {
          // Assuming Start=Sender, End=Content
          msg.content = `${msg.end || ''}\n---\n${msg.start || ''}`;
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

  const fetchOrders = useCallback(async (days: number = 30) => {
    try {
      setLoading(true);
      const startDate = subDays(startOfDay(new Date()), days).toISOString();

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`order_date.gte.${startDate},payment->>completedAt.gte.${startDate},transfer_info->>acceptedAt.gte.${startDate}`)
        .order('order_date', { ascending: false });

      if (error) {
        console.error('Supabase fetchOrders error:', error);
        throw error;
      }
      setOrders((data || []).map(mapRowToOrder));
    } catch (error) {
      console.error('주문 데이터 로딩 오류:', error);
      console.error("Error details:", JSON.stringify(error, null, 2));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrdersByRange = useCallback(async (start: Date, end: Date) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('order_date', start.toISOString())
        .lte('order_date', end.toISOString())
        .order('order_date', { ascending: false })
        .limit(10000);

      if (error) throw error;
      const ordersData = (data || []).map(mapRowToOrder);
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('Range 주문 로딩 오류:', error);
      setOrders([]); // Clear stale data on error
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllOrders = useCallback(async () => {
    try {
      setLoading(true);
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
    }
  }, []);

  const fetchOrdersForSettlement = useCallback(async (targetDateStr: string) => {
    try {
      setLoading(true);

      // Fetch all orders (we'll filter in memory for more flexibility)
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false });

      if (error) throw error;
      const ordersData = (data || []).map(mapRowToOrder);
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error("정산 데이터 로딩 오류:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

      // 'message' column doesn't exist, store in 'extra_data'
      if (data.message) {
        // Fetch current extra_data first if needed, but we have oldOrder
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

      // --- [Auto-Sync Logic] Sync Delivery Cost to Simple Expenses ---
      if (data.actualDeliveryCost !== undefined) {
        const cost = data.actualDeliveryCost;
        if (cost > 0) {
          // Check for existing linked expense
          // Using text search for extra_data to be safe across JSON formats
          const { data: existingExpenses } = await supabase
            .from('simple_expenses')
            .select('id, extra_data')
            .eq('category', 'transport')
            .or(`sub_category.eq.DELIVERY,sub_category.eq.delivery`)
            .like('extra_data', `%${orderId}%`) // Simplified robust check
            .limit(1);

          const existingExpense = existingExpenses && existingExpenses.length > 0 ? existingExpenses[0] : null;

          const expensePayload = {
            expense_date: data.deliveryInfo?.date || oldOrder.delivery_info?.date || new Date().toISOString(),
            amount: cost,
            category: 'transport',
            sub_category: 'DELIVERY',
            description: `배송비 (주문: ${oldOrder.orderer?.name || '미지정'})`,
            supplier: data.deliveryInfo?.driverName || oldOrder.delivery_info?.driverName || '배송기사',
            branch_id: oldOrder.branch_id,
            branch_name: oldOrder.branch_name,
            updated_at: new Date().toISOString(),
            extra_data: {
              relatedOrderId: orderId,
              ...(existingExpense?.extra_data as object || {})
            }
          };

          if (existingExpense) {
            await supabase.from('simple_expenses').update(expensePayload).eq('id', existingExpense.id);
          } else {
            await supabase.from('simple_expenses').insert([{
              ...expensePayload,
              id: crypto.randomUUID(),
              created_at: new Date().toISOString()
            }]);
          }
        } else if (cost === 0) {
          // If cost is set to 0, maybe we should remove the expense?
          // For safety, let's just update it to 0 or leave it. 
          // User usually inputs 0 to clear it? Let's leave it for now to avoid accidental deletion.
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
    fetchOrdersForSettlement
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
