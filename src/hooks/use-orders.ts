"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, addDoc, writeBatch, Timestamp, query, orderBy, runTransaction, where, updateDoc, serverTimestamp, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
import { useAuth } from './use-auth';
// Simplified version for the form
interface OrderItemForm {
  id: string;
  name: string;
  quantity: number;
  price: number;
  source?: 'excel_upload' | 'manual'; // 출처 표시
  originalData?: string; // 원본 데이터 보존
}
export interface OrderData {
  branchId: string;
  branchName: string;
  orderNumber?: string; // 주문 번호/송장 번호
  orderDate: Date | Timestamp;
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
    id?: string; // 기존 고객 ID (선택사항)
    name: string;
    contact: string;
    company: string;
    email: string;
  };
  isAnonymous: boolean;
  registerCustomer: boolean; // 고객 등록 여부 필드 추가
  orderType: "store" | "phone" | "naver" | "kakao" | "etc";
  receiptType: "store_pickup" | "pickup_reservation" | "delivery_reservation";
  payment: {
    method: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay";
    status: PaymentStatus;
    completedAt?: Timestamp; // 완결처리 시 기록되는 시간
    isSplitPayment?: boolean; // 분할결제 여부
    firstPaymentAmount?: number; // 선결제 금액
    firstPaymentDate?: Timestamp; // 선결제 날짜 (주문 날짜)
    firstPaymentMethod?: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay"; // 선결제 수단
    secondPaymentAmount?: number; // 후결제 금액
    secondPaymentDate?: Timestamp; // 후결제 날짜 (완결처리 날짜)
    secondPaymentMethod?: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay"; // 후결제 수단
  };
  pickupInfo: {
    date: string;
    time: string;
    pickerName: string;
    pickerContact: string;
    completedAt?: Date | Timestamp;
    completedBy?: string;
  } | null;
  deliveryInfo: {
    date: string;
    time: string;
    recipientName: string;
    recipientContact: string;
    address: string;
    district: string;
    driverAffiliation?: string;
    driverName?: string;
    driverContact?: string;
    // 배송완료 사진
    completionPhotoUrl?: string;
    completedAt?: Date | Timestamp;
    completedBy?: string;
  } | null;
  // 배송비 관리 관련 필드
  actualDeliveryCost?: number;
  deliveryCostStatus?: 'pending' | 'completed';
  deliveryCostUpdatedAt?: Date | Timestamp;
  deliveryCostUpdatedBy?: string;
  deliveryCostReason?: string;
  deliveryProfit?: number;
  message: {
    type: "card" | "ribbon";
    content: string;
  };
  request: string;
  source?: 'excel_upload' | 'manual'; // 출처 표시
}
export interface Order extends Omit<OrderData, 'orderDate'> {
  id: string;
  orderDate: Timestamp;
  transferInfo?: {
    isTransferred: boolean;
    transferId?: string;
    originalBranchId?: string;
    originalBranchName?: string;
    processBranchId?: string;
    processBranchName?: string;
    transferDate?: Timestamp;
    transferReason?: string;
    transferBy?: string;
    transferByUser?: string;
    status?: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
    amountSplit?: {
      orderBranch: number;
      processBranch: number;
    };
    notes?: string;
    acceptedAt?: Timestamp;
    rejectedAt?: Timestamp;
    completedAt?: Timestamp;
    cancelledAt?: Timestamp;
  };
}
export type PaymentStatus = "paid" | "pending" | "completed" | "split_payment";
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 50;
  const { toast } = useToast();
  const { user } = useAuth();
  const fetchOrders = useCallback(async (isLoadMore = false, filters?: {
    branchName?: string;
    status?: string;
    paymentStatus?: string;
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
  }) => {
    try {
      setLoading(true);
      const currentOffset = isLoadMore ? offset : 0;

      // [Supabase 우선 조회]
      let queryBuilder = supabase
        .from('orders')
        .select('*')
        .order('order_date', { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);

      // 필터 적용
      if (filters) {
        if (filters.branchName && filters.branchName !== 'all') {
          queryBuilder = queryBuilder.eq('branch_name', filters.branchName);
        }
        if (filters.status && filters.status !== 'all') {
          queryBuilder = queryBuilder.eq('status', filters.status);
        }
        if (filters.paymentStatus && filters.paymentStatus !== 'all') {
          // 결제 상태는 JSON 내부에 있으므로 적절히 필터링 (Supabase JSON 필터링 기능 활용 가능 시)
          // 여기서는 단순 문자열 비교로 예시 작성 (실제 데이터 구조에 맞춤)
          if (filters.paymentStatus === 'paid') {
            queryBuilder = queryBuilder.or('payment->>status.eq.paid,payment->>status.eq.completed');
          } else {
            queryBuilder = queryBuilder.eq('payment->>status', filters.paymentStatus);
          }
        }
        if (filters.startDate) {
          queryBuilder = queryBuilder.gte('order_date', filters.startDate);
        }
        if (filters.endDate) {
          queryBuilder = queryBuilder.lte('order_date', filters.endDate);
        }
        if (filters.searchTerm) {
          // 주문자 이름 또는 주문 ID 검색
          queryBuilder = queryBuilder.or(`orderer->>name.ilike.%${filters.searchTerm}%,id.ilike.%${filters.searchTerm}%`);
        }
      } else if (!isLoadMore) {
        // 초기 로딩 시(필터도 없고 LoadMore도 아닐 때)만 최근 3개월 데이터 조회
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        queryBuilder = queryBuilder.gte('order_date', threeMonthsAgo.toISOString());
      }

      const { data: supabaseOrders, error: supabaseError } = await queryBuilder;

      if (!supabaseError && supabaseOrders) {
        const mappedOrders = supabaseOrders.map(o => {
          let receiptType = o.receipt_type;
          if (receiptType === 'pickup') {
            receiptType = 'pickup_reservation';
          } else if (receiptType === 'delivery') {
            receiptType = 'delivery_reservation';
          }

          return {
            id: o.id,
            branchId: o.branch_id,
            branchName: o.branch_name,
            orderNumber: o.order_number,
            orderDate: Timestamp.fromDate(new Date(o.order_date)),
            status: o.status,
            items: o.items,
            summary: o.summary,
            orderer: o.orderer,
            isAnonymous: o.is_anonymous,
            registerCustomer: o.register_customer,
            orderType: o.order_type,
            receiptType,
            payment: o.payment,
            pickupInfo: o.pickup_info,
            deliveryInfo: o.delivery_info,
            actualDeliveryCost: o.actual_delivery_cost,
            message: o.message,
            request: o.request,
            transferInfo: (o as any).transfer_info
          } as Order;
        });

        if (isLoadMore) {
          setOrders(prev => [...prev, ...mappedOrders]);
          setOffset(prev => prev + PAGE_SIZE);
        } else {
          setOrders(mappedOrders);
          setOffset(PAGE_SIZE);
        }

        setHasMore(supabaseOrders.length === PAGE_SIZE);
        setLoading(false);
        return;
      }


      // Fallback: Firebase
      // Firebase 연결 상태 확인
      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      const ordersCollection = collection(db, 'orders');
      let q = query(ordersCollection, orderBy("orderDate", "desc"));

      // 지점 사용자의 경우 자신의 지점 주문과 이관받은 주문을 모두 조회
      if (user?.franchise && user?.role !== '본사 관리자') {
        // 현재 지점의 주문과 이관받은 주문을 모두 조회
        // 이는 클라이언트 사이드에서 필터링하므로 모든 주문을 가져옴

      }

      const querySnapshot = await getDocs(q);



      const ordersData = querySnapshot.docs.map((doc: any) => {
        const data = doc.data();
        // Legacy data migration: convert old receiptType values to new ones
        let receiptType = data.receiptType;
        if (receiptType === 'pickup') {
          receiptType = 'pickup_reservation';
        } else if (receiptType === 'delivery') {
          receiptType = 'delivery_reservation';
        }
        return {
          id: doc.id,
          ...data,
          receiptType
        } as Order;
      });



      // 중복 제거 (ID 기준) - 혹시 모를 중복 방지
      const uniqueOrdersMap = new Map();
      ordersData.forEach((order: any) => {
        uniqueOrdersMap.set(order.id, order);
      });
      const uniqueOrders = Array.from(uniqueOrdersMap.values()) as Order[];

      setOrders(uniqueOrders);
      setHasMore(false); // Firebase 폴백 시에는 일단 페이징 미지원 처리
    } catch (error) {
      console.error('주문 데이터 로딩 오류:', error);
      // 주문 정보 로딩 오류는 조용히 처리하되, 콘솔에는 로그 남김
    } finally {
      setLoading(false);
    }
  }, [user, offset]);
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  const addOrder = async (orderData: OrderData): Promise<string | null> => {
    setLoading(true);
    try {
      // Ensure orderDate is a JS Date object before proceeding
      const orderDate = (orderData.orderDate instanceof Timestamp)
        ? orderData.orderDate.toDate()
        : new Date(orderData.orderDate);

      // 매장픽업(즉시) 주문인지 확인
      const isImmediatePickup = orderData.receiptType === 'store_pickup';

      // 매장픽업(즉시) 주문인 경우 자동으로 완료 상태로 설정
      const status = isImmediatePickup
        ? 'completed' as const
        : orderData.status;

      // [이중 저장: Firebase]
      const orderPayload = {
        ...orderData,
        orderDate: Timestamp.fromDate(orderDate),
        status
      };
      const orderDocRef = await addDoc(collection(db, 'orders'), orderPayload);

      // [이중 저장: Supabase]
      const { error: supabaseError } = await supabase.from('orders').insert([{
        id: orderDocRef.id,
        branch_id: orderData.branchId,
        branch_name: orderData.branchName,
        order_number: orderData.orderNumber,
        order_date: orderDate.toISOString(),
        status: status,
        items: orderData.items,
        summary: orderData.summary,
        orderer: orderData.orderer,
        is_anonymous: orderData.isAnonymous,
        register_customer: orderData.registerCustomer,
        order_type: orderData.orderType,
        receipt_type: orderData.receiptType,
        payment: orderData.payment,
        pickup_info: orderData.pickupInfo,
        delivery_info: orderData.deliveryInfo,
        actual_delivery_cost: orderData.actualDeliveryCost,
        message: orderData.message, // jsonb
        request: orderData.request,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        transfer_info: (orderData as any).transferInfo // jsonb
      }]);

      if (supabaseError) console.error('Supabase Sync Error:', supabaseError);

      // 고객 등록/업데이트 로직 (포인트 차감 포함)
      if (orderData.registerCustomer && !orderData.isAnonymous) {
        await registerCustomerFromOrder(orderData);
      } else if (orderData.orderer.id && (orderData.summary.pointsUsed || 0) > 0) {
        // 고객 등록을 하지 않지만 기존 고객이 포인트를 사용한 경우에만 별도 차감
        await deductCustomerPoints(orderData.orderer.id, orderData.summary.pointsUsed || 0);
      }

      // 수령자 정보 별도 저장 (배송 예약인 경우)
      if (orderData.receiptType === 'delivery_reservation' && orderData.deliveryInfo) {
        await saveRecipientInfo(orderData.deliveryInfo, orderData.branchName, orderDocRef.id);
      }

      const historyBatch = writeBatch(db);

      // 엑셀 업로드 주문인지 확인
      const isExcelUpload = orderData.source === 'excel_upload' ||
        orderData.items.some(item => item.source === 'excel_upload');

      // 재고 차감 (Firebase 전용, 향후 Supabase로 전환 고려 가능)
      if (isExcelUpload) {
        // 엑셀 업로드 주문은 재고 차감 없이 히스토리만 기록
        for (const item of orderData.items) {
          if (!item.id || item.quantity <= 0) continue;

          const historyDocRef = doc(collection(db, "stockHistory"));
          const historyRecord = {
            date: Timestamp.fromDate(orderDate),
            type: "excel_upload",
            itemType: "excel_product",
            itemId: item.id,
            itemName: item.name,
            quantity: item.quantity,
            branch: orderData.branchName,
            operator: user?.email || "Excel Upload",
            price: item.price,
            totalAmount: item.price * item.quantity,
            note: "엑셀 업로드 주문 - 재고 차감 없음"
          };
          historyBatch.set(historyDocRef, historyRecord);

          // [이중 저장: Supabase stock_history]
          await supabase.from('stock_history').insert([{
            id: historyDocRef.id,
            date: orderDate.toISOString(),
            type: "excel_upload",
            item_type: "excel_product",
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
      } else {
        // 일반 주문은 기존 재고 차감 로직 사용
        for (const item of orderData.items) {
          if (!item.id || item.quantity <= 0) continue;
          await runTransaction(db, async (transaction) => {
            const productQuery = query(
              collection(db, "products"),
              where("id", "==", item.id),
              where("branch", "==", orderData.branchName)
            );
            const productSnapshot = await getDocs(productQuery);
            if (productSnapshot.empty) {
              throw new Error(`주문 처리 오류: 상품 '${item.name}'을(를) '${orderData.branchName}' 지점에서 찾을 수 없습니다.`);
            }
            const productDocRef = productSnapshot.docs[0].ref;
            const productDoc = await transaction.get(productDocRef);
            if (!productDoc.exists()) {
              throw new Error(`상품 문서를 찾을 수 없습니다: ${item.name}`);
            }
            const currentStock = productDoc.data().stock || 0;
            const newStock = currentStock - item.quantity;
            if (newStock < 0) {
              throw new Error(`재고 부족: '${item.name}'의 재고가 부족하여 주문을 완료할 수 없습니다. (현재 재고: ${currentStock})`);
            }
            transaction.update(productDocRef, { stock: newStock });

            // [이중 저장: Supabase 상품 재고 업데이트]
            await supabase.from('products').update({
              stock: newStock,
              updated_at: new Date().toISOString()
            }).eq('id', productSnapshot.docs[0].id);

            const historyDocRef = doc(collection(db, "stockHistory"));
            const historyRecord = {
              date: Timestamp.fromDate(orderDate),
              type: "out",
              itemType: "product",
              itemId: item.id,
              itemName: item.name,
              quantity: item.quantity,
              fromStock: currentStock,
              toStock: newStock,
              resultingStock: newStock,
              branch: orderData.branchName,
              operator: user?.email || "Unknown User",
              price: item.price,
              totalAmount: item.price * item.quantity,
            };
            historyBatch.set(historyDocRef, historyRecord);

            // [이중 저장: Supabase stock_history]
            await supabase.from('stock_history').insert([{
              id: historyDocRef.id,
              date: orderDate.toISOString(),
              type: "out",
              item_type: "product",
              item_id: item.id,
              item_name: item.name,
              quantity: item.quantity,
              from_stock: currentStock,
              to_stock: newStock,
              resulting_stock: newStock,
              branch: orderData.branchName,
              operator: user?.email || "Unknown User",
              price: item.price,
              total_amount: item.price * item.quantity,
              created_at: new Date().toISOString()
            }]);
          });
        }
      }

      await historyBatch.commit();

      let successMessage = '';
      if (isExcelUpload) {
        successMessage = '엑셀 업로드 주문이 추가되었습니다. (재고 차감 없음)';
      } else if (isImmediatePickup) {
        successMessage = '매장픽업(즉시) 주문이 완료 상태로 추가되었습니다.';
      } else {
        successMessage = '새 주문이 추가되고 재고가 업데이트되었습니다.';
      }

      toast({
        title: '성공',
        description: successMessage,
      });

      await fetchOrders();
      return orderDocRef.id; // 주문 ID 반환
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '주문 처리 오류',
        description: '주문 추가 중 오류가 발생했습니다.',
        duration: 5000,
      });
      return null; // 오류 시 null 반환
    } finally {
      setLoading(false);
    }
  };
  const updateOrderStatus = async (orderId: string, newStatus: 'processing' | 'completed' | 'canceled') => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        throw new Error('주문을 찾을 수 없습니다.');
      }

      const orderData = orderDoc.data() as Order;
      const updateData: any = { status: newStatus, updatedAt: serverTimestamp() };

      // 주문이 완료되면 해당하는 정보 업데이트
      if (newStatus === 'completed') {
        // 배송 예약인 경우 deliveryInfo 업데이트
        if (orderData.receiptType === 'delivery_reservation' && orderData.deliveryInfo) {
          updateData.deliveryInfo = {
            ...orderData.deliveryInfo,
            completedAt: serverTimestamp(),
            completedBy: user?.uid || 'system'
          };

          // 고객에게 배송완료 이메일 발송 (사진 없이 완료 처리된 경우)
          if (orderData.orderer?.email) {
            try {
              const settings = {
                autoEmailDeliveryComplete: true,
                siteName: '릴리맥 플라워샵',
                emailTemplateDeliveryComplete: `안녕하세요 {고객명}님!\n\n주문하신 상품이 성공적으로 배송 완료되었습니다.\n\n주문번호: {주문번호}\n배송일: {배송일}\n\n감사합니다.\n{회사명}`
              };
              const { sendDeliveryCompleteEmail } = await import('@/lib/email-service');
              await sendDeliveryCompleteEmail(
                orderData.orderer.email,
                orderData.orderer.name,
                orderId,
                new Date().toLocaleDateString('ko-KR'),
                settings as any
              );
            } catch (emailError) {
              console.error('배송완료 이메일 발송 오류:', emailError);
            }
          }
        }
        // 픽업 예약인 경우 pickupInfo 업데이트
        else if (orderData.receiptType === 'pickup_reservation' && orderData.pickupInfo) {
          updateData.pickupInfo = {
            ...orderData.pickupInfo,
            completedAt: serverTimestamp(),
            completedBy: user?.uid || 'system'
          };
        }

        // 캘린더 이벤트 상태 변경
        try {
          const { data: supabaseEvents, error: eventsError } = await supabase
            .from('calendar_events')
            .select('id')
            .eq('related_id', orderId);

          if (!eventsError && supabaseEvents) {
            const eventIds = supabaseEvents.map(e => e.id);
            if (eventIds.length > 0) {
              await supabase
                .from('calendar_events')
                .update({ status: 'completed', updated_at: new Date().toISOString() })
                .in('id', eventIds);
            }
          }

          const calendarEventsRef = collection(db, 'calendarEvents');
          const calendarQuery = query(
            calendarEventsRef,
            where('relatedId', '==', orderId)
          );
          const calendarSnapshot = await getDocs(calendarQuery);

          const updatePromises = calendarSnapshot.docs.map(doc =>
            updateDoc(doc.ref, {
              status: 'completed',
              updatedAt: Timestamp.now()
            })
          );
          await Promise.all(updatePromises);
        } catch (calendarError) {
          console.error('캘린더 이벤트 상태 변경 중 오류:', calendarError);
        }

        // 이관 상태 업데이트
        if (orderData.transferInfo?.isTransferred && orderData.transferInfo?.transferId) {
          try {
            const transferRef = doc(db, 'order_transfers', orderData.transferInfo.transferId);
            await updateDoc(transferRef, {
              status: 'completed',
              completedAt: serverTimestamp(),
              completedBy: user?.uid,
              updatedAt: serverTimestamp()
            });

            // [이중 저장: Supabase order_transfers]
            await supabase.from('order_transfers').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }).eq('id', orderData.transferInfo.transferId);

            // 발주지점의 원본 주문도 완료 상태로 업데이트
            if (orderData.transferInfo.originalBranchId && orderData.transferInfo.originalBranchId !== orderData.branchId) {
              const originalOrderQuery = query(
                collection(db, 'orders'),
                where('orderNumber', '==', orderData.orderNumber),
                where('branchId', '==', orderData.transferInfo.originalBranchId)
              );
              const originalOrderSnapshot = await getDocs(originalOrderQuery);

              if (!originalOrderSnapshot.empty) {
                const originalOrderDoc = originalOrderSnapshot.docs[0];
                const originalOrderRef = originalOrderDoc.ref;
                await updateDoc(originalOrderRef, {
                  status: 'completed',
                  updatedAt: serverTimestamp()
                });

                // [이중 저장: Supabase orders (원본 주문)]
                await supabase.from('orders').update({
                  status: 'completed',
                  updated_at: new Date().toISOString()
                }).eq('id', originalOrderDoc.id);
              }
            }
          } catch (transferError) {
            console.error('이관 상태 업데이트 중 오류:', transferError);
          }
        }
      }

      // [이중 저장: Firebase]
      await updateDoc(orderRef, updateData);

      // [이중 저장: Supabase]
      const supabaseUpdates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (updateData.deliveryInfo) {
        // deliveryInfo 내의 Timestamp를 ISO string으로 변환하여 저장
        supabaseUpdates.delivery_info = {
          ...orderData.deliveryInfo,
          completedAt: new Date().toISOString(),
          completedBy: user?.uid || 'system'
        };
      }
      if (updateData.pickupInfo) {
        supabaseUpdates.pickup_info = {
          ...orderData.pickupInfo,
          completedAt: new Date().toISOString(),
          completedBy: user?.uid || 'system'
        };
      }

      await supabase.from('orders').update(supabaseUpdates).eq('id', orderId);

      toast({
        title: '상태 변경 성공',
        description: `주문 상태가 '${newStatus}'(으)로 변경되었습니다.`,
      });
      await fetchOrders();
    } catch (error) {
      console.error('주문 상태 변경 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '주문 상태 변경 중 오류가 발생했습니다.',
      });
    }
  };
  const updatePaymentStatus = async (orderId: string, newStatus: 'pending' | 'paid' | 'completed') => {
    try {
      const orderRef = doc(db, 'orders', orderId);

      // 주문 정보를 먼저 가져와서 분할결제 여부 확인
      const orderDoc = await getDoc(orderRef);
      const orderData = orderDoc.data();

      const updateData: any = { 'payment.status': newStatus };

      // 완결처리 시 현재 시간 기록 (paid 또는 completed 상태일 때)
      if (newStatus === 'paid' || newStatus === 'completed') {
        // 완결 처리 시 항상 현재 시간으로 completedAt 업데이트
        // 이렇게 해야 미결→완결 전환 시 완결한 날짜가 정확하게 기록됨
        updateData['payment.completedAt'] = serverTimestamp();

        // 분할결제인 경우 후결제 날짜 기록 및 상태 변경
        if (orderData?.payment?.isSplitPayment || orderData?.payment?.status === 'split_payment') {
          updateData['payment.secondPaymentDate'] = serverTimestamp();
        }


      } else if (newStatus === 'pending') {
        // 미결로 변경 시 completedAt을 null로 설정하여 제거
        // 이렇게 해야 나중에 다시 완결 처리할 때 새로운 날짜가 설정됨
        updateData['payment.completedAt'] = null;


      }

      // [이중 저장: Firebase]
      await updateDoc(orderRef, updateData);

      // [이중 저장: Supabase]
      const updatedOrderDoc = await getDoc(orderRef); // Firebase에서 업데이트된 문서 다시 가져오기
      const currentOrder = updatedOrderDoc.data();
      await supabase.from('orders').update({
        payment: currentOrder?.payment
      }).eq('id', orderId);

      toast({
        title: '결제 상태 변경 성공',
        description: `결제 상태가 '${newStatus === 'paid' || newStatus === 'completed' ? '완결' : '미결'}'(으)로 변경되었습니다.`,
      });
      await fetchOrders();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '결제 상태 변경 중 오류가 발생했습니다.',
      });
    }
  };
  const updateOrder = async (orderId: string, data: Partial<OrderData>) => {
    setLoading(true);
    try {
      // [이중 저장: Firebase]
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, data, { merge: true });

      // [이중 저장: Supabase]
      const orderDoc = await getDoc(orderDocRef); // Firebase에서 업데이트된 문서 다시 가져오기
      const updatedOrderData = orderDoc.data();
      if (updatedOrderData) {
        await supabase.from('orders').update({
          branch_name: updatedOrderData.branchName,
          order_number: updatedOrderData.orderNumber,
          status: updatedOrderData.status,
          items: updatedOrderData.items,
          summary: updatedOrderData.summary,
          orderer: updatedOrderData.orderer,
          payment: updatedOrderData.payment,
          pickup_info: updatedOrderData.pickupInfo,
          delivery_info: updatedOrderData.deliveryInfo,
          actual_delivery_cost: updatedOrderData.actualDeliveryCost,
          message: updatedOrderData.message,
          request: updatedOrderData.request
        }).eq('id', orderId);
      }

      toast({ title: "성공", description: "주문 정보가 수정되었습니다." });
      await fetchOrders();
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '주문 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };
  // 주문 취소 (금액을 0으로 설정하고 포인트 환불)
  const cancelOrder = async (orderId: string, reason?: string) => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        throw new Error('주문을 찾을 수 없습니다.');
      }
      const orderData = orderDoc.data() as Order;
      const pointsUsed = orderData.summary.pointsUsed || 0;

      // 포인트를 사용한 경우 환불 처리
      if (pointsUsed > 0) {
        let customerId = orderData.orderer.id;

        // 고객 ID가 없는 경우 연락처로 고객 찾기
        if (!customerId && orderData.orderer.contact) {
          const customerSnapshot = await getDocs(query(
            collection(db, 'customers'),
            where('contact', '==', orderData.orderer.contact),
            where('isDeleted', '!=', true)
          ));

          if (!customerSnapshot.empty) {
            customerId = customerSnapshot.docs[0].id;
          }
        }

        if (customerId) {
          await refundCustomerPoints(customerId, pointsUsed);
        } else {
          console.warn('고객을 찾을 수 없어 포인트 환불을 할 수 없습니다:', {
            ordererContact: orderData.orderer.contact,
            ordererName: orderData.orderer.name,
            pointsUsed: pointsUsed
          });
        }
      }
      // 적립 예정 포인트가 있는 경우 차감 처리
      const pointsEarned = orderData.summary.pointsEarned || 0;
      if (pointsEarned > 0) {
        let customerId = orderData.orderer.id;

        // 고객 ID가 없는 경우 연락처로 고객 찾기
        if (!customerId && orderData.orderer.contact) {
          const customerSnapshot = await getDocs(query(
            collection(db, 'customers'),
            where('contact', '==', orderData.orderer.contact),
            where('isDeleted', '!=', true)
          ));

          if (!customerSnapshot.empty) {
            customerId = customerSnapshot.docs[0].id;
          }
        }

        if (customerId) {
          await deductCustomerPoints(customerId, pointsEarned);

        }
      }

      // [이중 저장: Firebase]
      await updateDoc(orderRef, {
        status: 'canceled',
        summary: {
          ...orderData.summary,
          subtotal: 0,
          discountAmount: 0,
          deliveryFee: 0,
          pointsUsed: 0,
          pointsEarned: 0,
          total: 0
        },
        cancelReason: reason || '고객 요청으로 취소',
        canceledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // [이중 저장: Supabase]
      await supabase.from('orders').update({
        status: 'canceled',
        summary: {
          ...orderData.summary,
          subtotal: 0,
          discountAmount: 0,
          deliveryFee: 0,
          pointsUsed: 0,
          pointsEarned: 0,
          total: 0
        },
        cancel_reason: reason || '고객 요청으로 취소',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', orderId);

      // 배송 예약 주문인 경우 수령자 정보도 처리 (주문 취소 시에는 수령자 정보는 유지하되 주문 횟수만 감소)
      if (orderData.receiptType === 'delivery_reservation' && orderData.deliveryInfo) {
        await updateRecipientInfoOnOrderDelete(orderData.deliveryInfo, orderData.branchName);
      }

      // 성공 메시지 구성
      let successMessage = "주문이 취소되고 금액이 0원으로 설정되었습니다.";
      const messages = [];

      if (pointsUsed > 0) {
        messages.push(`사용한 ${pointsUsed}포인트가 환불되었습니다.`);
      }

      if (pointsEarned > 0) {
        messages.push(`적립 예정이던 ${pointsEarned}포인트가 차감되었습니다.`);
      }

      if (messages.length > 0) {
        successMessage += ` ${messages.join(' ')}`;
      }
      toast({
        title: "주문 취소 완료",
        description: successMessage
      });
      await fetchOrders(); // 목록 새로고침
    } catch (error) {
      toast({
        variant: "destructive",
        title: "주문 취소 실패",
        description: "주문 취소 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };
  // 주문 삭제 (완전 삭제 + 포인트 복원)
  const deleteOrder = async (orderId: string) => {
    setLoading(true);
    try {
      // 주문 정보 먼저 가져오기
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        throw new Error('주문을 찾을 수 없습니다.');
      }

      const orderData = orderDoc.data() as Order;
      const pointsUsed = orderData.summary.pointsUsed || 0;
      const pointsEarned = orderData.summary.pointsEarned || 0;

      // 포인트를 사용한 경우 환불 처리
      if (pointsUsed > 0) {
        let customerId = orderData.orderer.id;

        // 고객 ID가 없는 경우 연락처로 고객 찾기
        if (!customerId && orderData.orderer.contact) {
          const customerSnapshot = await getDocs(query(
            collection(db, 'customers'),
            where('contact', '==', orderData.orderer.contact),
            where('isDeleted', '!=', true)
          ));

          if (!customerSnapshot.empty) {
            customerId = customerSnapshot.docs[0].id;
          }
        }

        if (customerId) {
          await refundCustomerPoints(customerId, pointsUsed);

        } else {
          console.warn('주문 삭제 - 고객을 찾을 수 없어 포인트 환불 불가:', {
            ordererContact: orderData.orderer.contact,
            ordererName: orderData.orderer.name,
            pointsUsed: pointsUsed
          });
        }
      }

      // 적립 예정 포인트가 있는 경우 차감 처리
      if (pointsEarned > 0) {
        let customerId = orderData.orderer.id;

        // 고객 ID가 없는 경우 연락처로 고객 찾기
        if (!customerId && orderData.orderer.contact) {
          const customerSnapshot = await getDocs(query(
            collection(db, 'customers'),
            where('contact', '==', orderData.orderer.contact),
            where('isDeleted', '!=', true)
          ));

          if (!customerSnapshot.empty) {
            customerId = customerSnapshot.docs[0].id;
          }
        }

        if (customerId) {
          await deductCustomerPoints(customerId, pointsEarned);

        }
      }

      // 관련된 주문 이관 기록 찾기 및 삭제
      const transfersRef = collection(db, 'order_transfers');
      const transfersQuery = query(transfersRef, where('originalOrderId', '==', orderId));
      const transfersSnapshot = await getDocs(transfersQuery);

      // 배치로 이관 기록 삭제
      if (!transfersSnapshot.empty) {
        const batch = writeBatch(db);
        transfersSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        // [이중 저장: Supabase order_transfers 삭제]
        await supabase.from('order_transfers').delete().eq('original_order_id', orderId);
      }

      // [이중 저장: Firebase]
      await deleteDoc(orderRef);

      // [이중 저장: Supabase]
      await supabase.from('orders').delete().eq('id', orderId);

      // 배송 예약 주문인 경우 수령자 정보 처리
      if (orderData.receiptType === 'delivery_reservation' && orderData.deliveryInfo) {
        await updateRecipientInfoOnOrderDelete(orderData.deliveryInfo, orderData.branchName);
      }

      // 성공 메시지 구성
      let successMessage = "주문과 관련된 모든 데이터가 삭제되었습니다.";
      const messages = [];

      if (pointsUsed > 0) {
        messages.push(`사용한 ${pointsUsed}포인트가 환불되었습니다.`);
      }

      if (pointsEarned > 0) {
        messages.push(`적립 예정이던 ${pointsEarned}포인트가 차감되었습니다.`);
      }

      if (messages.length > 0) {
        successMessage += ` ${messages.join(' ')}`;
      }

      toast({
        title: "주문 삭제 완료",
        description: successMessage
      });
      await fetchOrders(); // 목록 새로고침
    } catch (error) {
      console.error('주문 삭제 오류:', error);
      toast({
        variant: "destructive",
        title: "주문 삭제 실패",
        description: "주문 삭제 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };
  // 배송완료 처리 (사진 포함)
  const completeDelivery = async (
    orderId: string,
    completionPhotoUrl?: string,
    completedBy?: string
  ) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);

      if (!orderDoc.exists()) {
        throw new Error('주문을 찾을 수 없습니다.');
      }

      const orderData = orderDoc.data() as Order;

      // 배송 정보 업데이트
      const updatedDeliveryInfo = {
        ...orderData.deliveryInfo,
        completionPhotoUrl,
        completedAt: serverTimestamp(),
        completedBy: completedBy || user?.uid || 'system'
      };

      // [이중 저장: Firebase]
      await updateDoc(orderRef, {
        status: 'completed',
        deliveryInfo: updatedDeliveryInfo,
        updatedAt: serverTimestamp()
      });

      // [이중 저장: Supabase]
      const updatedDeliveryInfoForSupabase = {
        ...orderData.deliveryInfo,
        completionPhotoUrl,
        completedAt: new Date().toISOString(), // Supabase는 ISO string 사용
        completedBy: completedBy || user?.uid || 'system'
      };
      await supabase.from('orders').update({
        status: 'completed',
        delivery_info: updatedDeliveryInfoForSupabase,
        updated_at: new Date().toISOString()
      }).eq('id', orderId);

      // 고객에게 배송완료 이메일 발송 (사진 포함)
      if (orderData.orderer?.email) {
        // 시스템 설정 가져오기 (실제로는 useSettings에서 가져와야 함)
        const settings = {
          autoEmailDeliveryComplete: true,
          siteName: '릴리맥 플라워샵',
          emailTemplateDeliveryComplete: `안녕하세요 {고객명}님!

주문하신 상품이 성공적으로 배송 완료되었습니다.

주문번호: {주문번호}
배송일: {배송일}

감사합니다.
{회사명}`
        };

        // 동적 import를 통해 순환 참조 방지
        const { sendDeliveryCompleteEmail } = await import('@/lib/email-service');

        await sendDeliveryCompleteEmail(
          orderData.orderer.email,
          orderData.orderer.name,
          orderId,
          new Date().toLocaleDateString('ko-KR'),
          settings as any,
          completionPhotoUrl
        );
      }

      // 주문이 완료되면 해당하는 캘린더 이벤트 상태를 'completed'로 변경
      try {
        const { data: supabaseEvents, error: eventsError } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('related_id', orderId);

        if (!eventsError && supabaseEvents) {
          const eventIds = supabaseEvents.map(e => e.id);
          if (eventIds.length > 0) {
            await supabase
              .from('calendar_events')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .in('id', eventIds);
          }
        }

        const calendarEventsRef = collection(db, 'calendarEvents');
        const calendarQuery = query(
          calendarEventsRef,
          where('relatedId', '==', orderId)
        );
        const calendarSnapshot = await getDocs(calendarQuery);

        // 관련된 캘린더 이벤트 상태를 'completed'로 변경
        const updatePromises = calendarSnapshot.docs.map(doc =>
          updateDoc(doc.ref, {
            status: 'completed',
            updatedAt: Timestamp.now()
          })
        );
        await Promise.all(updatePromises);
      } catch (calendarError) {
        console.error('캘린더 이벤트 상태 변경 중 오류:', calendarError);
      }

      // 주문 목록 새로고침
      await fetchOrders();

      toast({
        title: "배송완료 처리됨",
        description: completionPhotoUrl ?
          "배송완료 사진과 함께 고객에게 알림 이메일이 발송되었습니다." :
          "배송완료 처리가 완료되었습니다."
      });

    } catch (error) {
      toast({
        title: "오류",
        description: "배송완료 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  return {
    orders,
    loading,
    hasMore,
    addOrder,
    fetchOrders,
    updateOrderStatus,
    updatePaymentStatus,
    updateOrder,
    cancelOrder,
    deleteOrder,
    completeDelivery
  };
}
// 헬퍼 함수들도 이중 저장을 고려해야 함 (예: registerCustomerFromOrder, deductCustomerPoints 등)
const registerCustomerFromOrder = async (orderData: OrderData) => {
  try {
    // 기존 고객 검색 (연락처 기준) - 전 지점 공유
    const customersQuery = query(
      collection(db, 'customers'),
      where('contact', '==', orderData.orderer.contact)
    );
    const existingCustomers = await getDocs(customersQuery);
    // 삭제된 고객 필터링 (클라이언트 사이드에서 처리)
    const validCustomers = existingCustomers.docs.filter(doc => {
      const data = doc.data();
      return !data.isDeleted;
    });
    const customerData = {
      name: orderData.orderer.name,
      contact: orderData.orderer.contact,
      email: orderData.orderer.email || '',
      companyName: orderData.orderer.company || '',
      type: orderData.orderer.company ? 'company' : 'personal',
      branch: orderData.branchName,
      grade: '신규',
      totalSpent: orderData.summary.total,
      orderCount: 1,
      points: Math.floor(orderData.summary.total * 0.02) - (orderData.summary.pointsUsed || 0), // 2% 적립 - 사용 포인트
      lastOrderDate: serverTimestamp(),
      isDeleted: false,
    };
    if (validCustomers.length > 0) {
      // 기존 고객 업데이트 (전 지점 공유)
      const customerDoc = validCustomers[0];
      const existingData = customerDoc.data();
      const currentBranch = orderData.branchName;
      // 지점별 정보 업데이트
      const branchInfo = {
        registeredAt: serverTimestamp(),
        grade: customerData.grade,
        notes: `주문으로 자동 등록 - ${new Date().toLocaleDateString()}`
      };
      await setDoc(customerDoc.ref, {
        ...customerData,
        totalSpent: (existingData.totalSpent || 0) + orderData.summary.total,
        orderCount: (existingData.orderCount || 0) + 1,
        points: (existingData.points || 0) - (orderData.summary.pointsUsed || 0) + Math.floor(orderData.summary.total * 0.02),
        grade: existingData.grade || '신규',
        createdAt: existingData.createdAt, // 기존 생성일 유지
        [`branches.${currentBranch}`]: branchInfo,
        // 주 거래 지점 업데이트 (가장 최근 주문 지점)
        primaryBranch: currentBranch
      }, { merge: true });
      // Supabase 동기화 (고객 정보 및 지점 정보 업데이트)
      const { data: currentCustomer } = await supabase
        .from('customers')
        .select('branches')
        .eq('id', customerDoc.id)
        .maybeSingle();

      const supabaseBranches = currentCustomer?.branches || {};
      supabaseBranches[currentBranch] = {
        registered_at: new Date().toISOString(),
        grade: existingData.grade || '신규',
        notes: `주문으로 자동 등록 - ${new Date().toLocaleDateString()}`
      };

      await supabase.from('customers').update({
        total_spent: (existingData.totalSpent || 0) + orderData.summary.total,
        order_count: (existingData.orderCount || 0) + 1,
        points: (existingData.points || 0) - (orderData.summary.pointsUsed || 0) + Math.floor(orderData.summary.total * 0.02),
        last_order_date: new Date().toISOString(),
        primary_branch: currentBranch,
        branches: supabaseBranches
      }).eq('id', customerDoc.id);
    } else {
      // 신규 고객 등록 (통합 관리)
      const currentBranch = orderData.branchName;
      const newCustomerData = {
        ...customerData,
        createdAt: serverTimestamp(),
        branches: {
          [currentBranch]: {
            registeredAt: serverTimestamp(),
            grade: customerData.grade,
            notes: `주문으로 자동 등록 - ${new Date().toLocaleDateString()}`
          }
        },
        primaryBranch: currentBranch
      };
      const newCustomerDocRef = await addDoc(collection(db, 'customers'), newCustomerData);
      // Supabase 동기화 (신규 고객)
      await supabase.from('customers').insert([{
        id: newCustomerDocRef.id,
        name: customerData.name,
        contact: customerData.contact,
        email: customerData.email,
        company_name: customerData.companyName,
        type: customerData.type,
        branch: customerData.branch,
        grade: customerData.grade,
        total_spent: customerData.totalSpent,
        order_count: customerData.orderCount,
        points: customerData.points,
        last_order_date: new Date().toISOString(),
        is_deleted: customerData.isDeleted,
        created_at: new Date().toISOString(),
        primary_branch: currentBranch,
        branches: {
          [currentBranch]: {
            registered_at: new Date().toISOString(),
            grade: customerData.grade,
            notes: `주문으로 자동 등록 - ${new Date().toLocaleDateString()}`
          }
        }
      }]);
    }
  } catch (error) {
    // 고객 등록 실패해도 주문은 계속 진행
  }
};
// 고객 포인트 차감 함수
const deductCustomerPoints = async (customerId: string, pointsToDeduct: number) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    if (customerDoc.exists()) {
      const currentPoints = customerDoc.data().points || 0;
      const newPoints = Math.max(0, currentPoints - pointsToDeduct);
      await setDoc(customerRef, {
        points: newPoints,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
      // Supabase 동기화 (placeholder)
      await supabase.from('customers').update({ points: newPoints, last_updated: new Date().toISOString() }).eq('id', customerId);
    }
  } catch (error) {
    // 포인트 차감 실패해도 주문은 계속 진행
  }
};
// 고객 포인트 환불 함수
const refundCustomerPoints = async (customerId: string, pointsToRefund: number) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    const customerDoc = await getDoc(customerRef);
    if (customerDoc.exists()) {
      const customerData = customerDoc.data();
      const currentPoints = customerData.points || 0;
      const newPoints = currentPoints + pointsToRefund;

      await setDoc(customerRef, {
        points: newPoints,
        lastUpdated: serverTimestamp(),
      }, { merge: true });

      // Supabase 동기화 (placeholder)
      await supabase.from('customers').update({ points: newPoints, last_updated: new Date().toISOString() }).eq('id', customerId);

      console.log('포인트 환불 완료:', {
        customerId: customerId,
        customerName: customerData.name,
        currentPoints: currentPoints,
        refundedPoints: pointsToRefund,
        newPoints: newPoints
      });
    } else {
      console.error('고객 문서를 찾을 수 없습니다:', customerId);
    }
  } catch (error) {
    console.error('포인트 환불 중 오류 발생:', error);
    // 포인트 환불 실패해도 주문 취소는 계속 진행
  }
};
// 수령자 정보 별도 저장 함수
const saveRecipientInfo = async (deliveryInfo: any, branchName: string, orderId: string) => {
  try {
    // 기존 수령자 검색 (연락처와 지점명 기준)
    const recipientsQuery = query(
      collection(db, 'recipients'),
      where('contact', '==', deliveryInfo.recipientContact),
      where('branchName', '==', branchName)
    );
    const existingRecipients = await getDocs(recipientsQuery);
    if (!existingRecipients.empty) {
      // 기존 수령자 업데이트
      const recipientDoc = existingRecipients.docs[0];
      const existingData = recipientDoc.data();
      await setDoc(recipientDoc.ref, {
        name: deliveryInfo.recipientName, // 이름은 최신으로 업데이트
        address: deliveryInfo.address, // 주소도 최신으로 업데이트
        district: deliveryInfo.district,
        orderCount: (existingData.orderCount || 0) + 1,
        lastOrderDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Supabase 동기화 (placeholder)
      await supabase.from('recipients').update({
        name: deliveryInfo.recipientName,
        address: deliveryInfo.address,
        district: deliveryInfo.district,
        order_count: (existingData.orderCount || 0) + 1,
        last_order_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', recipientDoc.id);
    } else {
      // 신규 수령자 등록
      const recipientData = {
        name: deliveryInfo.recipientName,
        contact: deliveryInfo.recipientContact,
        address: deliveryInfo.address,
        district: deliveryInfo.district,
        branchName: branchName,
        orderCount: 1,
        lastOrderDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        email: '', // 기본값 (나중에 UI에서 입력 가능하도록 수정)
        // 마케팅 활용을 위한 추가 필드
        marketingConsent: true, // 기본값 (나중에 UI에서 선택 가능하도록 수정)
        source: 'order', // 데이터 출처
      };
      const newRecipientDocRef = await addDoc(collection(db, 'recipients'), recipientData);
      // Supabase 동기화 (placeholder)
      await supabase.from('recipients').insert([{
        id: newRecipientDocRef.id,
        name: deliveryInfo.recipientName,
        contact: deliveryInfo.recipientContact,
        address: deliveryInfo.address,
        district: deliveryInfo.district,
        branch_name: branchName,
        order_count: 1,
        last_order_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        email: '',
        marketing_consent: true,
        source: 'order'
      }]);
    }
  } catch (error) {
    // 수령자 저장 실패해도 주문은 계속 진행
  }
};

// 주문 삭제 시 수령자 정보 업데이트 함수
const updateRecipientInfoOnOrderDelete = async (deliveryInfo: any, branchName: string) => {
  try {
    // 해당 수령자 검색
    const recipientsQuery = query(
      collection(db, 'recipients'),
      where('contact', '==', deliveryInfo.recipientContact),
      where('branchName', '==', branchName)
    );
    const existingRecipients = await getDocs(recipientsQuery);

    if (!existingRecipients.empty) {
      const recipientDoc = existingRecipients.docs[0];
      const existingData = recipientDoc.data();
      const newOrderCount = Math.max(0, (existingData.orderCount || 1) - 1);

      if (newOrderCount === 0) {
        // 주문 횟수가 0이 되면 수령자 정보 삭제
        await deleteDoc(recipientDoc.ref);
        // Supabase 동기화 (placeholder)
        await supabase.from('recipients').delete().eq('id', recipientDoc.id);
      } else {
        // 주문 횟수만 감소시키고 최근 주문일은 유지 (다른 주문이 있을 수 있으므로)
        await setDoc(recipientDoc.ref, {
          orderCount: newOrderCount,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        // Supabase 동기화 (placeholder)
        await supabase.from('recipients').update({
          order_count: newOrderCount,
          updated_at: new Date().toISOString()
        }).eq('id', recipientDoc.id);
      }
    }
  } catch (error) {
    // 수령자 업데이트 실패해도 주문 삭제는 계속 진행
  }
};
