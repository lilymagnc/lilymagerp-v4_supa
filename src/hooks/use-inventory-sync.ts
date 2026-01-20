"use client";
import { useState, useCallback } from 'react';
import { 
  collection, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  runTransaction,
  query,
  where,
  getDocs,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
import type { 
  MaterialRequest, 
  ActualPurchaseItem,
  PurchaseBatch 
} from '@/types/material-request';
// 재고 연동 관련 타입 정의
export interface InventorySyncResult {
  success: boolean;
  updatedMaterials: number;
  createdHistoryRecords: number;
  errors: string[];
}
export interface StockUpdateItem {
  materialId: string;
  materialName: string;
  quantity: number;
  price?: number;
  supplier?: string;
  branchId: string;
  branchName: string;
}
export interface InventoryNotification {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'restock_needed';
  materialId: string;
  materialName: string;
  branchId: string;
  branchName: string;
  currentStock: number;
  threshold: number;
  message: string;
  isRead: boolean;
  createdAt: Timestamp;
}
export function useInventorySync() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  // 입고 완료 시 재고 자동 업데이트
  const syncInventoryOnDelivery = useCallback(async (
    requestId: string,
    actualItems: ActualPurchaseItem[],
    branchId: string,
    branchName: string,
    operatorId: string,
    operatorName: string
  ): Promise<InventorySyncResult> => {
    setLoading(true);
    const result: InventorySyncResult = {
      success: true,
      updatedMaterials: 0,
      createdHistoryRecords: 0,
      errors: []
    };
    try {
      const batch = writeBatch(db);
      for (const item of actualItems) {
        if (item.status === 'unavailable') {
          continue; // 구매 불가 품목은 재고 업데이트 제외
        }
        try {
          // 해당 지점의 자재 찾기
          const materialQuery = query(
            collection(db, 'materials'),
            where('id', '==', item.actualMaterialId || item.originalMaterialId),
            where('branch', '==', branchName)
          );
          const materialSnapshot = await getDocs(materialQuery);
          if (materialSnapshot.empty) {
            result.errors.push(`자재를 찾을 수 없습니다: ${item.actualMaterialName} (${branchName})`);
            continue;
          }
          const materialDoc = materialSnapshot.docs[0];
          const materialData = materialDoc.data();
          const currentStock = materialData.stock || 0;
          const newStock = currentStock + item.actualQuantity;
          // 자재 재고 업데이트
          const materialRef = doc(db, 'materials', materialDoc.id);
          batch.update(materialRef, {
            stock: newStock,
            price: item.actualPrice, // 최신 구매 가격으로 업데이트
            supplier: item.supplier || materialData.supplier,
            updatedAt: serverTimestamp()
          });
          // 재고 변동 기록 생성
          const historyRef = doc(collection(db, 'stockHistory'));
          batch.set(historyRef, {
            date: serverTimestamp(),
            type: 'in',
            itemType: 'material',
            itemId: item.actualMaterialId || item.originalMaterialId,
            itemName: item.actualMaterialName,
            quantity: item.actualQuantity,
            fromStock: currentStock,
            toStock: newStock,
            resultingStock: newStock,
            branch: branchName,
            operator: operatorName,
            supplier: item.supplier,
            price: item.actualPrice,
            totalAmount: item.totalAmount,
            // 구매 요청 연동 정보
            relatedRequestId: requestId,
            relatedBatchId: item.purchaseDate ? undefined : undefined, // 배치 ID는 별도로 전달받아야 함
            purchasePrice: item.actualPrice,
            notes: `자재 구매 요청 입고: ${item.memo || ''}`
          });
          result.updatedMaterials++;
          result.createdHistoryRecords++;
        } catch (error) {
          const errorMessage = `${item.actualMaterialName} 재고 업데이트 실패: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);
          console.error('Material stock update error:', error);
        }
      }
      await batch.commit();
      // 재고 부족 알림 확인
      await checkLowStockAlerts(branchId, branchName);
      if (result.errors.length > 0) {
        result.success = false;
        toast({
          variant: 'destructive',
          title: '일부 재고 업데이트 실패',
          description: `${result.errors.length}개 항목에서 오류가 발생했습니다.`
        });
      } else {
        toast({
          title: '재고 업데이트 완료',
          description: `${result.updatedMaterials}개 자재의 재고가 업데이트되었습니다.`
        });
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`재고 동기화 실패: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Inventory sync error:', error);
      toast({
        variant: 'destructive',
        title: '재고 동기화 실패',
        description: '재고 업데이트 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
    return result;
  }, [toast]);
  // 재고 부족 알림 확인
  const checkLowStockAlerts = useCallback(async (
    branchId?: string,
    branchName?: string
  ) => {
    try {
      let materialsQuery = collection(db, 'materials');
      if (branchId && branchName) {
        materialsQuery = query(
          collection(db, 'materials'),
          where('branch', '==', branchName)
        ) as any;
      }
      const materialsSnapshot = await getDocs(materialsQuery);
      const notifications: InventoryNotification[] = [];
      materialsSnapshot.forEach((doc) => {
        const material = doc.data();
        const stock = material.stock || 0;
        const lowStockThreshold = 10; // 기본 임계값
        const outOfStockThreshold = 0;
        if (stock <= outOfStockThreshold) {
          notifications.push({
            id: `${doc.id}_out_of_stock`,
            type: 'out_of_stock',
            materialId: material.id,
            materialName: material.name,
            branchId: branchId || 'unknown',
            branchName: material.branch,
            currentStock: stock,
            threshold: outOfStockThreshold,
            message: `${material.name}이(가) 품절되었습니다.`,
            isRead: false,
            createdAt: Timestamp.now()
          });
        } else if (stock <= lowStockThreshold) {
          notifications.push({
            id: `${doc.id}_low_stock`,
            type: 'low_stock',
            materialId: material.id,
            materialName: material.name,
            branchId: branchId || 'unknown',
            branchName: material.branch,
            currentStock: stock,
            threshold: lowStockThreshold,
            message: `${material.name}의 재고가 부족합니다. (현재: ${stock}개)`,
            isRead: false,
            createdAt: Timestamp.now()
          });
        }
      });
      // 알림 저장
      if (notifications.length > 0) {
        const batch = writeBatch(db);
        notifications.forEach((notification) => {
          const notificationRef = doc(collection(db, 'inventoryNotifications'));
          batch.set(notificationRef, notification);
        });
        await batch.commit();
        toast({
          title: '재고 알림',
          description: `${notifications.length}개의 재고 부족 알림이 생성되었습니다.`
        });
      }
    } catch (error) {
      console.error('Low stock alert check error:', error);
    }
  }, [toast]);
  // 구매 배치 완료 시 전체 재고 동기화
  const syncInventoryForBatch = useCallback(async (
    batch: PurchaseBatch,
    operatorId: string,
    operatorName: string
  ): Promise<InventorySyncResult> => {
    setLoading(true);
    const result: InventorySyncResult = {
      success: true,
      updatedMaterials: 0,
      createdHistoryRecords: 0,
      errors: []
    };
    try {
      // 각 지점별로 재고 업데이트
      for (const deliveryPlan of batch.deliveryPlan) {
        const syncResult = await syncInventoryOnDelivery(
          '', // 배치 단위이므로 특정 요청 ID 없음
          deliveryPlan.items,
          deliveryPlan.branchId,
          deliveryPlan.branchName,
          operatorId,
          operatorName
        );
        result.updatedMaterials += syncResult.updatedMaterials;
        result.createdHistoryRecords += syncResult.createdHistoryRecords;
        result.errors.push(...syncResult.errors);
      }
      if (result.errors.length > 0) {
        result.success = false;
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`배치 재고 동기화 실패: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Batch inventory sync error:', error);
    } finally {
      setLoading(false);
    }
    return result;
  }, [syncInventoryOnDelivery]);
  // 수동 재고 조정 (감사 로그 포함)
  const manualStockAdjustment = useCallback(async (
    materialId: string,
    materialName: string,
    branchId: string,
    branchName: string,
    newStock: number,
    reason: string,
    operatorId: string,
    operatorName: string
  ): Promise<boolean> => {
    setLoading(true);
    try {
      return await runTransaction(db, async (transaction) => {
        // 자재 찾기
        const materialQuery = query(
          collection(db, 'materials'),
          where('id', '==', materialId),
          where('branch', '==', branchName)
        );
        const materialSnapshot = await getDocs(materialQuery);
        if (materialSnapshot.empty) {
          throw new Error(`자재를 찾을 수 없습니다: ${materialName} (${branchName})`);
        }
        const materialDoc = materialSnapshot.docs[0];
        const materialData = materialDoc.data();
        const currentStock = materialData.stock || 0;
        const stockDifference = newStock - currentStock;
        // 자재 재고 업데이트
        const materialRef = doc(db, 'materials', materialDoc.id);
        transaction.update(materialRef, {
          stock: newStock,
          updatedAt: serverTimestamp()
        });
        // 재고 변동 기록 생성
        const historyRef = doc(collection(db, 'stockHistory'));
        transaction.set(historyRef, {
          date: serverTimestamp(),
          type: 'manual_update',
          itemType: 'material',
          itemId: materialId,
          itemName: materialName,
          quantity: stockDifference,
          fromStock: currentStock,
          toStock: newStock,
          resultingStock: newStock,
          branch: branchName,
          operator: operatorName,
          notes: `수동 재고 조정: ${reason}`
        });
        // 감사 로그 생성
        const auditRef = doc(collection(db, 'auditLogs'));
        transaction.set(auditRef, {
          timestamp: serverTimestamp(),
          action: 'manual_stock_adjustment',
          entityType: 'material',
          entityId: materialId,
          entityName: materialName,
          branchId: branchId,
          branchName: branchName,
          operatorId: operatorId,
          operatorName: operatorName,
          details: {
            previousStock: currentStock,
            newStock: newStock,
            difference: stockDifference,
            reason: reason
          },
          ipAddress: '', // 클라이언트에서는 IP 주소를 얻기 어려움
          userAgent: navigator.userAgent
        });
        return true;
      });
    } catch (error) {
      console.error('Manual stock adjustment error:', error);
      toast({
        variant: 'destructive',
        title: '재고 조정 실패',
        description: `재고 조정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);
  // 재고 변동 추적 조회
  const getStockMovements = useCallback(async (
    materialId?: string,
    branchId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ) => {
    try {
      let historyQuery = query(
        collection(db, 'stockHistory'),
        where('itemType', '==', 'material')
      );
      if (materialId) {
        historyQuery = query(historyQuery, where('itemId', '==', materialId));
      }
      const snapshot = await getDocs(historyQuery);
      let movements = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date()
      }));
      // 클라이언트 사이드 필터링
      if (branchId) {
        movements = movements.filter(m => m.branch === branchId);
      }
      if (dateFrom) {
        movements = movements.filter(m => m.date >= dateFrom);
      }
      if (dateTo) {
        movements = movements.filter(m => m.date <= dateTo);
      }
      return movements.sort((a, b) => b.date.getTime() - a.date.getTime());
    } catch (error) {
      console.error('Get stock movements error:', error);
      toast({
        variant: 'destructive',
        title: '재고 변동 조회 실패',
        description: '재고 변동 내역을 조회하는 중 오류가 발생했습니다.'
      });
      return [];
    }
  }, [toast]);
  return {
    loading,
    syncInventoryOnDelivery,
    syncInventoryForBatch,
    checkLowStockAlerts,
    manualStockAdjustment,
    getStockMovements
  };
}
