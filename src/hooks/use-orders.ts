
"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, addDoc, writeBatch, Timestamp, query, orderBy, runTransaction, where, updateDoc, serverTimestamp, setDoc, getDoc, deleteDoc, limit, startAt, endAt } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateDailyStats } from '@/lib/stats-utils';

import { useToast } from './use-toast';
import { useAuth } from './use-auth';
import { subDays, startOfDay } from 'date-fns';
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
  orderNumber?: string;
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
    method: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple";
    status: PaymentStatus;
    completedAt?: Timestamp; // 완결처리 시 기록되는 시간
    isSplitPayment?: boolean; // 분할결제 여부
    firstPaymentAmount?: number; // 선결제 금액
    firstPaymentDate?: Timestamp; // 선결제 날짜 (주문 날짜)
    firstPaymentMethod?: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple"; // 선결제 수단
    secondPaymentAmount?: number; // 후결제 금액
    secondPaymentDate?: Timestamp; // 후결제 날짜 (완결처리 날짜)
    secondPaymentMethod?: "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple"; // 후결제 수단
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
    // 배송완료 사진
    completionPhotoUrl?: string;
    completedAt?: Date | Timestamp;
    completedBy?: string;
  } | null;
  // 배송비 관리 관련 필드
  actualDeliveryCost?: number;
  actualDeliveryCostCash?: number;
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
  outsourceInfo?: {
    isOutsourced: boolean;
    partnerId: string;
    partnerName: string;
    partnerPrice: number;
    profit: number;
    status: 'pending' | 'accepted' | 'completed' | 'canceled';
    notes?: string;
    outsourcedAt: Timestamp;
    updatedAt?: Timestamp;
  };
}
export type PaymentStatus = "paid" | "pending" | "completed" | "split_payment";
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const fetchOrders = useCallback(async (days: number = 30) => {
    try {
      setLoading(true);

      if (!db) {
        throw new Error('Firebase Firestore is not initialized');
      }

      const ordersCollection = collection(db, 'orders');

      // 날짜 필터 추가 (최근 N일)
      const startDate = Timestamp.fromDate(subDays(startOfDay(new Date()), days));

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      // 1. 주문 날짜 기준 쿼리
      const qDate = query(
        ordersCollection,
        where("orderDate", ">=", startDate),
        orderBy("orderDate", "desc")
      );

      // 2. 배송비 수정 날짜 기준 쿼리 (구 주문이 오늘 수정된 경우 대비)
      const qDeliveryUpdate = query(
        ordersCollection,
        where("deliveryCostUpdatedAt", ">=", startDate)
      );

      // 3. 결제 완료 날짜 기준 쿼리
      const qPaymentUpdate = query(
        ordersCollection,
        where("payment.completedAt", ">=", startDate)
      );

      // 4. 이관 수락 날짜 기준 쿼리 (오래된 주문이 오늘 이관된 경우 대비)
      const qTransferUpdate = query(
        ordersCollection,
        where("transferInfo.acceptedAt", ">=", startDate)
      );

      const results = await Promise.allSettled([
        Promise.race([getDocs(qDate), timeoutPromise]),
        Promise.race([getDocs(qDeliveryUpdate), timeoutPromise]),
        Promise.race([getDocs(qPaymentUpdate), timeoutPromise]),
        Promise.race([getDocs(qTransferUpdate), timeoutPromise])
      ]);

      const combinedDocs: any[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const snap = result.value as any;
          if (snap.docs) {
            combinedDocs.push(...snap.docs);
          }
        } else {
          console.warn(`Query ${index} failed:`, result.reason);
        }
      });

      const ordersData = combinedDocs.map((doc: any) => {
        const data = doc.data();
        let receiptType = data.receiptType;
        if (receiptType === 'pickup') receiptType = 'pickup_reservation';
        else if (receiptType === 'delivery') receiptType = 'delivery_reservation';

        return {
          id: doc.id,
          ...data,
          receiptType
        } as Order;
      });

      const uniqueOrdersMap = new Map();
      ordersData.forEach((order: any) => {
        uniqueOrdersMap.set(order.id, order);
      });
      const uniqueOrders = Array.from(uniqueOrdersMap.values()) as Order[];

      // 정렬 (최신순)
      uniqueOrders.sort((a, b) => {
        const dateA = (a.orderDate as any)?.toDate ? (a.orderDate as any).toDate() : new Date(a.orderDate as any);
        const dateB = (b.orderDate as any)?.toDate ? (b.orderDate as any).toDate() : new Date(b.orderDate as any);
        return dateB.getTime() - dateA.getTime();
      });

      setOrders(uniqueOrders);
    } catch (error) {
      console.error('주문 데이터 로딩 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 특정 기간 주문 조회 (비용 효율적)
  const fetchOrdersByRange = useCallback(async (start: Date, end: Date) => {
    try {
      setLoading(true);
      const ordersCollection = collection(db, 'orders');
      const q = query(
        ordersCollection,
        where("orderDate", ">=", Timestamp.fromDate(start)),
        where("orderDate", "<=", Timestamp.fromDate(end)),
        orderBy("orderDate", "desc")
      );
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('Range 주문 로딩 오류:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 명시적으로 전체 주문 조회 (주의: 읽기 비용 발생)
  const fetchAllOrders = useCallback(async () => {
    try {
      setLoading(true);
      const ordersCollection = collection(db, 'orders');
      const q = query(ordersCollection, orderBy("orderDate", "desc"));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(ordersData);
      return ordersData;
    } catch (error) {
      console.error('전체 주문 로딩 오류:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // 정산용 주문 조회 (최적화)
  const fetchOrdersForSettlement = useCallback(async (targetDateStr: string) => {
    try {
      setLoading(true);
      const targetDate = new Date(targetDateStr);
      const start = startOfDay(targetDate);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const ordersCollection = collection(db, 'orders');

      // 1. 해당 일자 생성 주문
      const qDate = query(
        ordersCollection,
        where("orderDate", ">=", startTs),
        where("orderDate", "<=", endTs)
      );

      // 2. 해당 일자 결제 완료 (1차)
      // Note: Firestore does not support logical OR across different fields natively in one query usually without heavy indexing or multiple queries.
      // We will execute parallel queries.
      const qPaymentUser = query(
        ordersCollection,
        where("payment.completedAt", ">=", startTs),
        where("payment.completedAt", "<=", endTs)
      );

      // 3. 해당 일자 결제 완료 (2차/잔금)
      const qPaymentSecond = query(
        ordersCollection,
        where("payment.secondPaymentDate", ">=", startTs),
        where("payment.secondPaymentDate", "<=", endTs)
      );

      // 4. 배송비 수정 (현금 배송비 정산용)
      const qDeliveryCost = query(
        ordersCollection,
        where("deliveryCostUpdatedAt", ">=", startTs),
        where("deliveryCostUpdatedAt", "<=", endTs)
      );

      const results = await Promise.allSettled([
        getDocs(qDate),
        getDocs(qPaymentUser),
        getDocs(qPaymentSecond),
        getDocs(qDeliveryCost)
      ]);

      const combinedDocs: any[] = [];
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          combinedDocs.push(...result.value.docs);
        }
      });

      // 중복 제거
      const uniqueOrdersMap = new Map();
      combinedDocs.forEach((doc) => {
        if (!uniqueOrdersMap.has(doc.id)) {
          const data = doc.data();
          let receiptType = data.receiptType;
          if (receiptType === 'pickup') receiptType = 'pickup_reservation';
          else if (receiptType === 'delivery') receiptType = 'delivery_reservation';

          uniqueOrdersMap.set(doc.id, {
            id: doc.id,
            ...data,
            receiptType
          } as Order);
        }
      });

      const uniqueOrders = Array.from(uniqueOrdersMap.values());

      // 상태 업데이트 (정산 페이지에서 사용)
      setOrders(uniqueOrders);
      return uniqueOrders;

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
      // Ensure orderDate is a JS Date object before proceeding
      const orderDate = (orderData.orderDate instanceof Timestamp)
        ? orderData.orderDate.toDate()
        : new Date(orderData.orderDate);
      const orderPayload = {
        ...orderData,
        orderDate: Timestamp.fromDate(orderDate),
      };
      // 매장픽업(즉시) 주문인지 확인
      const isImmediatePickup = orderData.receiptType === 'store_pickup';

      // 매장픽업(즉시) 주문인 경우 자동으로 완료 상태로 설정
      const finalOrderPayload = isImmediatePickup
        ? { ...orderPayload, status: 'completed' as const }
        : orderPayload;

      // 주문 추가
      const orderDocRef = await addDoc(collection(db, 'orders'), finalOrderPayload);

      // 엑셀 업로드 주문인지 확인
      const isExcelUpload = orderData.source === 'excel_upload' ||
        orderData.items.some(item => item.source === 'excel_upload');

      // 고객 등록/업데이트 로직 (포인트 차감 포함)
      if (orderData.registerCustomer && !orderData.isAnonymous) {
        await registerCustomerFromOrder(orderData);
      } else if (orderData.orderer.id && orderData.summary.pointsUsed > 0) {
        // 고객 등록을 하지 않지만 기존 고객이 포인트를 사용한 경우에만 별도 차감
        await deductCustomerPoints(orderData.orderer.id, orderData.summary.pointsUsed);
      }

      // 수령자 정보 별도 저장 (배송 예약인 경우)
      if (orderData.receiptType === 'delivery_reservation' && orderData.deliveryInfo) {
        await saveRecipientInfo(orderData.deliveryInfo, orderData.branchName, orderDocRef.id);
      }

      const historyBatch = writeBatch(db);

      // 엑셀 업로드 주문인 경우 재고 차감 제외
      if (isExcelUpload) {
        // 엑셀 업로드 주문은 재고 차감 없이 히스토리만 기록
        for (const item of orderData.items) {
          if (!item.id || item.quantity <= 0) continue;

          const historyDocRef = doc(collection(db, "stockHistory"));
          historyBatch.set(historyDocRef, {
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
          });
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
            const historyDocRef = doc(collection(db, "stockHistory"));
            historyBatch.set(historyDocRef, {
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
            });
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



      // 일별 통계 업데이트 (주문 추가 시)
      await updateDailyStats(orderDate, orderData.branchName, {
        revenueDelta: orderData.summary.total,
        orderCountDelta: 1,
        settledAmountDelta: (finalOrderPayload.payment.status === 'paid' || finalOrderPayload.payment.status === 'completed')
          ? orderData.summary.total : 0
      });

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
      const orderData = orderDoc.data() as Order;

      await updateDoc(orderRef, { status: newStatus });

      // 일별 통계 업데이트 (취소 시)
      if (newStatus === 'canceled' && orderData.status !== 'canceled') {
        await updateDailyStats(orderData.orderDate, orderData.branchName, {
          revenueDelta: -orderData.summary.total,
          orderCountDelta: -1,
          settledAmountDelta: (orderData.payment.status === 'paid' || orderData.payment.status === 'completed')
            ? -orderData.summary.total : 0
        });
      }

      // 주문이 완료되면 해당하는 캘린더 이벤트 상태를 'completed'로 변경
      if (newStatus === 'completed') {
        try {
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
          // 캘린더 이벤트 상태 변경 실패는 주문 상태 변경을 막지 않음
        }

        // 주문이 완료되면 이관 상태도 함께 업데이트
        try {
          const orderDoc = await getDoc(orderRef);
          if (orderDoc.exists()) {
            const orderData = orderDoc.data();

            // 이관된 주문인지 확인
            if (orderData.transferInfo?.isTransferred && orderData.transferInfo?.transferId) {
              const transferRef = doc(db, 'order_transfers', orderData.transferInfo.transferId);

              // 이관 상태를 'completed'로 업데이트
              await updateDoc(transferRef, {
                status: 'completed',
                completedAt: serverTimestamp(),
                completedBy: user?.uid,
                updatedAt: serverTimestamp()
              });

              // 발주지점의 원본 주문도 완료 상태로 업데이트
              if (orderData.transferInfo.originalBranchId && orderData.transferInfo.originalBranchId !== orderData.branchId) {
                // 원본 주문 조회
                const originalOrderQuery = query(
                  collection(db, 'orders'),
                  where('orderNumber', '==', orderData.orderNumber),
                  where('branchId', '==', orderData.transferInfo.originalBranchId)
                );
                const originalOrderSnapshot = await getDocs(originalOrderQuery);

                if (!originalOrderSnapshot.empty) {
                  const originalOrderRef = originalOrderSnapshot.docs[0].ref;
                  await updateDoc(originalOrderRef, {
                    status: 'completed',
                    updatedAt: serverTimestamp()
                  });


                }
              }


            }
          }
        } catch (transferError) {
          console.error('이관 상태 업데이트 중 오류:', transferError);
          // 이관 상태 업데이트 실패는 주문 상태 변경을 막지 않음
        }
      }

      toast({
        title: '상태 변경 성공',
        description: `주문 상태가 '${newStatus}'(으)로 변경되었습니다.`,
      });
      await fetchOrders();


    } catch (error) {
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

      await updateDoc(orderRef, updateData);

      // 일별 통계 업데이트 (결제 상태 변경 시)
      const isNewSettled = newStatus === 'paid' || newStatus === 'completed';
      const wasSettled = orderData?.payment?.status === 'paid' || orderData?.payment?.status === 'completed';

      if (isNewSettled && !wasSettled) {
        // 결제 완료 시: '오늘' 날짜 통계에 결제 금액 합산
        await updateDailyStats(new Date(), orderData.branchName, {
          revenueDelta: 0,
          orderCountDelta: 0,
          settledAmountDelta: orderData.summary.total
        });
      } else if (!isNewSettled && wasSettled) {
        // 결제 취소 시: 기존에 기록된 결제일(completedAt) 기준으로 차감해야 하나, 
        // 간단히 처리하기 위해 일단 현재 기준 또는 데이터의 완료일 기준 처리
        const settlementDate = orderData.payment?.completedAt
          ? (orderData.payment.completedAt as any).toDate()
          : new Date();

        await updateDailyStats(settlementDate, orderData.branchName, {
          revenueDelta: 0,
          orderCountDelta: 0,
          settledAmountDelta: -orderData.summary.total
        });
      }

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
      const orderDocRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderDocRef);
      if (!orderDoc.exists()) throw new Error('주문을 찾을 수 없습니다.');

      const oldOrder = orderDoc.data() as Order;

      // 금액이나 지점, 날짜가 변경되었는지 확인하여 통계 업데이트
      const oldTotal = oldOrder.summary?.total || 0;
      const newTotal = data.summary?.total !== undefined ? data.summary.total : oldTotal;
      const oldStatus = oldOrder.status;
      const newStatus = data.status || oldStatus;

      // 상태 변경에 따른 매출 변화 계산
      // (기존이 취소였는데 정상이 되면 +, 기존이 정상인데 취소가 되면 -)
      let revenueDelta = 0;
      if (oldStatus !== 'canceled' && newStatus === 'canceled') {
        revenueDelta = -oldTotal;
      } else if (oldStatus === 'canceled' && newStatus !== 'canceled') {
        revenueDelta = newTotal;
      } else if (oldStatus !== 'canceled' && newStatus !== 'canceled') {
        revenueDelta = newTotal - oldTotal;
      }

      const oldSettled = (oldOrder.payment?.status === 'paid' || oldOrder.payment?.status === 'completed') && oldStatus !== 'canceled';
      const newSettled = (data.payment?.status === 'paid' || data.payment?.status === 'completed' || (data.payment === undefined && oldOrder.payment?.status === 'paid')) && newStatus !== 'canceled';

      let settledDelta = 0;
      if (!oldSettled && newSettled) {
        settledDelta = newTotal;
      } else if (oldSettled && !newSettled) {
        settledDelta = -oldTotal;
      } else if (oldSettled && newSettled) {
        settledDelta = newTotal - oldTotal;
      }

      await setDoc(orderDocRef, data, { merge: true });

      if (revenueDelta !== 0 || settledDelta !== 0) {
        await updateDailyStats(oldOrder.orderDate, oldOrder.branchName, {
          revenueDelta,
          orderCountDelta: 0,
          settledAmountDelta: settledDelta
        });
      }

      toast({ title: "성공", description: "주문 정보가 수정되었습니다." });
      await fetchOrders();
    } catch (error) {
      console.error('Update order error:', error);
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

      // 주문 상태를 취소로 변경하고 금액을 0으로 설정
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

      // 일별 통계 업데이트 (주문 취소 시 - 금액이 0이 되므로 이전 금액만큼 차감)
      // cancelOrder는 이미 status: 'canceled'로 업데이트하므로 중복 체크 주의
      await updateDailyStats(orderData.orderDate, orderData.branchName, {
        revenueDelta: -orderData.summary.total,
        orderCountDelta: -1,
        settledAmountDelta: (orderData.payment.status === 'paid' || orderData.payment.status === 'completed')
          ? -orderData.summary.total : 0
      });

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

      }

      // 주문 삭제
      await deleteDoc(orderRef);

      // 일별 통계 업데이트 (주문 삭제 시)
      if (orderData.status !== 'canceled') {
        await updateDailyStats(orderData.orderDate, orderData.branchName, {
          revenueDelta: -orderData.summary.total,
          orderCountDelta: -1,
          settledAmountDelta: (orderData.payment.status === 'paid' || orderData.payment.status === 'completed')
            ? -orderData.summary.total : 0
        });
      }

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

      await updateDoc(orderRef, {
        status: 'completed',
        deliveryInfo: updatedDeliveryInfo,
        updatedAt: serverTimestamp()
      });

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
        // 캘린더 이벤트 상태 변경 실패는 배송완료 처리를 막지 않음
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
// 주문자 정보로 고객 등록/업데이트 함수
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
      await addDoc(collection(db, 'customers'), newCustomerData);
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
      await addDoc(collection(db, 'recipients'), recipientData);
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
      } else {
        // 주문 횟수만 감소시키고 최근 주문일은 유지 (다른 주문이 있을 수 있으므로)
        await setDoc(recipientDoc.ref, {
          orderCount: newOrderCount,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }
  } catch (error) {
    // 수령자 업데이트 실패해도 주문 삭제는 계속 진행
  }
};
