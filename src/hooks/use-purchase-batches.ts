"use client";

import { useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { 
  PurchaseBatch, 
  CreatePurchaseBatchData,
  ActualPurchaseInputData,
  DeliveryPlanItem,
  MaterialRequest,
  ActualPurchaseItem
} from '@/types/material-request';
import { generateBatchNumber } from '@/types/material-request';

export function usePurchaseBatches() {
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();

  // 구매 배치 목록 조회
  const fetchBatches = async (filters?: {
    status?: 'planning' | 'purchasing' | 'completed';
    limit?: number;
  }) => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      let q = query(
        collection(db, 'purchaseBatches'),
        orderBy('createdAt', 'desc')
      );

      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }

      if (filters?.limit) {
        q = query(q, limit(filters.limit));
      }

      const snapshot = await getDocs(q);
      const batchList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PurchaseBatch[];

      setBatches(batchList);
    } catch (err) {
      console.error('구매 배치 조회 오류:', err);
      setError('구매 배치를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 구매 배치 생성
  const createPurchaseBatch = async (
    data: CreatePurchaseBatchData,
    requests: MaterialRequest[]
  ): Promise<PurchaseBatch | null> => {
    if (!user) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive"
      });
      return null;
    }

    try {
      const batch = writeBatch(db);
      const now = Timestamp.now();
      const batchNumber = generateBatchNumber();

      // 지점별 배송 계획 생성
      const deliveryPlan = generateDeliveryPlan(requests);

      // 구매 배치 문서 생성
      const batchRef = doc(collection(db, 'purchaseBatches'));
      const newBatch: Omit<PurchaseBatch, 'id'> = {
        batchNumber,
        purchaseDate: now,
        purchaserId: data.purchaserId,
        purchaserName: data.purchaserName,
        includedRequests: data.includedRequests,
        purchasedItems: [], // 실제 구매 후 업데이트
        totalCost: 0, // 실제 구매 후 업데이트
        deliveryPlan,
        status: 'planning',
        notes: data.notes || '',
        createdAt: now,
        updatedAt: now
      };

      batch.set(batchRef, newBatch);

      // 포함된 요청들의 상태를 'purchasing'으로 업데이트
      for (const requestId of data.includedRequests) {
        const requestRef = doc(db, 'materialRequests', requestId);
        batch.update(requestRef, {
          status: 'purchasing',
          updatedAt: now
        });
      }

      await batch.commit();

      toast({
        title: "구매 배치 생성 완료",
        description: `배치 번호: ${batchNumber}`,
      });

      // 목록 새로고침
      await fetchBatches();

      // 생성된 배치 객체 반환
      return { id: batchRef.id, ...newBatch } as PurchaseBatch;
    } catch (error) {
      console.error('구매 배치 생성 오류:', error);
      toast({
        title: "오류",
        description: "구매 배치 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      return null;
    }
  };

  // 실제 구매 내역 입력
  const updateActualPurchase = async (
    batchId: string,
    purchaseData: ActualPurchaseInputData
  ): Promise<boolean> => {
    if (!user) {
      toast({ title: "오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return false;
    }

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const now = Timestamp.now();
        const batchRef = doc(db, 'purchaseBatches', batchId);
        const batchDoc = await transaction.get(batchRef);

        if (!batchDoc.exists()) {
          throw new Error(`구매 배치를 찾을 수 없습니다: ID ${batchId}`);
        }

        const batchData = batchDoc.data() as PurchaseBatch;

        // 1. 자재 마스터 가격 정보 업데이트
        for (const item of purchaseData.items) {
          if (item.status === 'purchased' || item.status === 'substituted') {
            const materialIdToUpdate = item.actualMaterialId || item.originalMaterialId;
            const materialQuery = query(
              collection(db, "materials"), 
              where("id", "==", materialIdToUpdate.split('-')[0])
            );
            const materialSnapshot = await getDocs(materialQuery);
            materialSnapshot.forEach(materialDoc => {
              transaction.update(materialDoc.ref, { 
                price: item.actualPrice,
                lastPurchasePrice: item.actualPrice,
                lastPurchaseDate: now
              });
            });
          }
        }

        // 2. 구매 배치 문서 업데이트
        transaction.update(batchRef, {
          purchasedItems: purchaseData.items,
          totalCost: purchaseData.totalCost,
          status: 'completed',
          notes: purchaseData.notes,
          updatedAt: now
        });

        // 3. 포함된 요청들의 상태를 'purchased'로 업데이트
        for (const requestId of batchData.includedRequests) {
          const requestRef = doc(db, 'materialRequests', requestId);
          transaction.update(requestRef, { 
            status: 'purchased',
            updatedAt: now
          });
        }
      });

      toast({ title: "구매 내역 저장 완료", description: "실제 구매 내역이 저장되고 자재 정보가 업데이트되었습니다." });
      await fetchBatches();
      return true;

    } catch (error) {
      console.error('구매 내역 입력 오류:', error);
      toast({ title: "오류", description: `구매 내역 저장 중 오류가 발생했습니다: ${error.message}`, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 배송 시작 처리 (구매 배치용)
  const startDelivery = async (batchId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const batch = writeBatch(db);
      const now = Timestamp.now();

      // 구매 배치의 포함된 요청들을 'shipping' 상태로 변경
      const batchRef = doc(db, 'purchaseBatches', batchId);
      const batchDoc = await getDoc(batchRef);

      if (batchDoc.exists()) {
        const batchData = batchDoc.data() as PurchaseBatch;
        for (const requestId of batchData.includedRequests) {
          const requestRef = doc(db, 'materialRequests', requestId);
          batch.update(requestRef, {
            status: 'shipping',
            delivery: {
              shippingDate: now,
              deliveryMethod: '직접배송',
              deliveryStatus: 'shipped'
            },
            updatedAt: now
          });
        }
      } else {
        console.error('배치를 찾을 수 없음:', batchId);
        throw new Error('배치를 찾을 수 없습니다.');
      }

      await batch.commit();
      toast({
        title: "배송 시작",
        description: "배송이 시작되었습니다.",
      });

      // 목록 새로고침
      await fetchBatches();

      return true;
    } catch (error) {
      console.error('배송 시작 오류:', error);
      toast({
        title: "오류",
        description: "배송 시작 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      return false;
    }
  };

  // 개별 요청 배송 시작 처리
  const startRequestDelivery = async (requestId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const now = Timestamp.now();
      const requestRef = doc(db, 'materialRequests', requestId);

      await updateDoc(requestRef, {
        status: 'shipping',
        delivery: {
          shippingDate: now,
          deliveryMethod: '직접배송',
          deliveryStatus: 'shipped'
        },
        updatedAt: now
      });

      toast({
        title: "배송 시작",
        description: "요청의 배송이 시작되었습니다.",
      });

      return true;
    } catch (error) {
      console.error('개별 요청 배송 시작 오류:', error);
      toast({
        title: "오류",
        description: "배송 시작 처리 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      return false;
    }
  };

  // 구매 배치 삭제
  const deleteBatch = async (batchId: string): Promise<boolean> => {
    if (!user) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive"
      });
      return false;
    }

    try {
      const batch = writeBatch(db);

      // 구매 배치의 포함된 요청들을 'reviewing' 상태로 되돌리기
      const batchRef = doc(db, 'purchaseBatches', batchId);
      const batchDoc = await getDoc(batchRef);

      if (batchDoc.exists()) {
        const batchData = batchDoc.data() as PurchaseBatch;

        for (const requestId of batchData.includedRequests) {
          const requestRef = doc(db, 'materialRequests', requestId);
          batch.update(requestRef, {
            status: 'reviewing',
            updatedAt: Timestamp.now()
          });
        }
      }

      // 구매 배치 삭제
      batch.delete(batchRef);

      await batch.commit();

      toast({
        title: "구매 배치 삭제",
        description: "구매 배치가 삭제되었습니다.",
      });

      // 목록 새로고침
      await fetchBatches();

      return true;
    } catch (error) {
      console.error('구매 배치 삭제 오류:', error);
      toast({
        title: "오류",
        description: "구매 배치 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      return false;
    }
  };

  // 지점별 배송 계획 생성 헬퍼 함수
  const generateDeliveryPlan = (requests: MaterialRequest[]): DeliveryPlanItem[] => {
    const branchMap = new Map<string, DeliveryPlanItem>();

    requests.forEach(request => {
      const branchId = request.branchId;
      const branchName = request.branchName;

      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          branchId,
          branchName,
          items: [],
          estimatedCost: 0
        });
      }

      const branchPlan = branchMap.get(branchId)!;

      // 요청 품목들을 배송 계획에 추가
      request.requestedItems.forEach(item => {
        const estimatedCost = item.requestedQuantity * item.estimatedPrice;
        branchPlan.estimatedCost += estimatedCost;

        // 배송 계획용 임시 ActualPurchaseItem 생성
        const planItem: ActualPurchaseItem = {
          originalMaterialId: item.materialId,
          originalMaterialName: item.materialName,
          requestedQuantity: item.requestedQuantity,
          actualMaterialName: item.materialName,
          actualQuantity: item.requestedQuantity, // 실제 구매 후 업데이트
          actualPrice: item.estimatedPrice, // 실제 구매 후 업데이트
          totalAmount: estimatedCost, // 실제 구매 후 업데이트
          status: 'purchased', // 실제 구매 후 업데이트
          memo: item.memo || '',
          purchaseDate: Timestamp.now(),
        };

        branchPlan.items.push(planItem);
      });
    });

    return Array.from(branchMap.values());
  };

  // 실제 구매 완료 후 배송 계획 업데이트
  const updateDeliveryPlan = (
    originalPlan: DeliveryPlanItem[], 
    actualItems: ActualPurchaseItem[],
    requests: MaterialRequest[]
  ): DeliveryPlanItem[] => {
    const updatedPlan = originalPlan.map(plan => ({
      ...plan,
      items: [],
      estimatedCost: 0
    }));

    // 실제 구매 품목을 지점별로 배분
    actualItems.forEach(actualItem => {
      // 원래 자재 ID로 어느 지점에서 요청했는지 찾기
      const requestingBranches = requests.filter(request =>
        request.requestedItems.some(item => 
          item.materialId === actualItem.originalMaterialId
        )
      );

      requestingBranches.forEach(request => {
        const originalRequestItem = request.requestedItems.find(item =>
          item.materialId === actualItem.originalMaterialId
        );

        if (originalRequestItem) {
          const branchPlan = updatedPlan.find(plan => plan.branchId === request.branchId);
          if (branchPlan) {
            // 요청 수량 비율에 따라 실제 구매 품목 배분
            const requestRatio = originalRequestItem.requestedQuantity / 
              requestingBranches.reduce((sum, req) => {
                const reqItem = req.requestedItems.find(item => 
                  item.materialId === actualItem.originalMaterialId
                );
                return sum + (reqItem?.requestedQuantity || 0);
              }, 0);

            const allocatedQuantity = Math.floor(actualItem.actualQuantity * requestRatio);
            const allocatedAmount = actualItem.totalAmount * requestRatio;

            if (allocatedQuantity > 0) {
              const branchItem: ActualPurchaseItem = {
                ...actualItem,
                actualQuantity: allocatedQuantity,
                totalAmount: allocatedAmount
              };

              branchPlan.items.push(branchItem);
              branchPlan.estimatedCost += allocatedAmount;
            }
          }
        }
      });
    });

    return updatedPlan;
  };

  // 구매 배치 통계 계산
  const calculateBatchStats = (batch: PurchaseBatch) => {
    return {
      requestCount: batch.includedRequests.length,
      branchCount: batch.deliveryPlan.length,
      totalItems: batch.purchasedItems.length,
      totalCost: batch.totalCost,
      completionRate: batch.status === 'completed' ? 100 : 
                     batch.status === 'purchasing' ? 50 : 0
    };
  };

  // 초기 로드
  useEffect(() => {
    if (user) {
      fetchBatches();
    }
  }, [user]);

  return {
    batches,
    loading,
    error,
    fetchBatches,
    createPurchaseBatch,
    updateActualPurchase,
    startDelivery,
    deleteBatch,
    calculateBatchStats
  };
}
