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
import { supabase } from '@/lib/supabase'; // 추가
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

  // 재고 부족 알림 확인
  const checkLowStockAlerts = useCallback(async (
    branchId?: string,
    branchName?: string
  ) => {
    try {
      // 재고 현황 조회
      let materials: any[] = [];

      // [Supabase 우선 조회]
      const { data: supabaseMaterials, error: supabaseError } = await supabase
        .from('materials')
        .select('*')
        .filter('branch', 'eq', branchName || '');

      if (!supabaseError && supabaseMaterials) {
        materials = supabaseMaterials;
      } else {
        // Fallback: Firebase
        let materialsQuery: any = collection(db, 'materials');
        if (branchName) {
          materialsQuery = query(materialsQuery, where('branch', '==', branchName));
        }
        const materialsSnapshot = await getDocs(materialsQuery);
        materials = materialsSnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as object) }));
      }

      const notifications: any[] = [];
      const now = new Date();

      materials.forEach((material) => {
        const stock = material.stock || 0;
        const lowStockThreshold = 10; // 기본 임계값
        const outOfStockThreshold = 0;

        if (stock <= outOfStockThreshold) {
          notifications.push({
            type: 'out_of_stock',
            materialId: material.id,
            materialName: material.name,
            branchId: branchId || 'unknown',
            branchName: material.branch,
            currentStock: stock,
            threshold: outOfStockThreshold,
            message: `${material.name}이(가) 품절되었습니다.`,
            isRead: false,
            createdAt: now
          });
        } else if (stock <= lowStockThreshold) {
          notifications.push({
            type: 'low_stock',
            materialId: material.id,
            materialName: material.name,
            branchId: branchId || 'unknown',
            branchName: material.branch,
            currentStock: stock,
            threshold: lowStockThreshold,
            message: `${material.name}의 재고가 부족합니다. (현재: ${stock}개)`,
            isRead: false,
            createdAt: now
          });
        }
      });

      // 알림 저장
      if (notifications.length > 0) {
        const batch = writeBatch(db);
        const supabaseNotifications: any[] = [];

        notifications.forEach((notification) => {
          const notificationRef = doc(collection(db, 'inventoryNotifications'));
          batch.set(notificationRef, {
            ...notification,
            createdAt: serverTimestamp()
          });

          supabaseNotifications.push({
            id: notificationRef.id,
            type: notification.type,
            material_id: notification.materialId,
            material_name: notification.materialName,
            branch_id: notification.branchId,
            branch_name: notification.branchName,
            current_stock: notification.currentStock,
            threshold: notification.threshold,
            message: notification.message,
            is_read: false,
            created_at: now.toISOString()
          });
        });

        await batch.commit();

        // [이중 저장: Supabase]
        await supabase.from('inventory_notifications').insert(supabaseNotifications);

        toast({
          title: '재고 알림',
          description: `${notifications.length}개의 재고 부족 알림이 생성되었습니다.`
        });
      }
    } catch (error) {
      console.error('Low stock alert check error:', error);
    }
  }, [toast]);

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

          // [이중 저장: Supabase] 자재 업데이트
          await supabase.from('materials').update({
            stock: newStock,
            price: item.actualPrice,
            supplier: item.supplier || materialData.supplier,
            updated_at: new Date().toISOString()
          }).eq('id', materialDoc.id).eq('branch', branchName);

          // 재고 변동 기록 생성
          const historyRef = doc(collection(db, 'stockHistory'));
          const historyId = historyRef.id;
          const now = new Date();

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
            relatedBatchId: undefined, // 배치 ID는 별도로 전달받아야 함
            purchasePrice: item.actualPrice,
            notes: `자재 구매 요청 입고: ${item.memo || ''}`
          });

          // [이중 저장: Supabase] 재고 이력 생성
          await supabase.from('stock_history').insert([{
            id: historyId,
            occurred_at: now.toISOString(),
            type: 'in',
            item_type: 'material',
            item_id: item.actualMaterialId || item.originalMaterialId,
            item_name: item.actualMaterialName,
            quantity: item.actualQuantity,
            from_stock: currentStock,
            to_stock: newStock,
            resulting_stock: newStock,
            branch: branchName,
            operator: operatorName,
            supplier: item.supplier,
            price: item.actualPrice,
            total_amount: item.totalAmount,
            related_request_id: requestId,
            notes: `자재 구매 요청 입고: ${item.memo || ''}`
          }]);

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
  }, [checkLowStockAlerts, toast]);

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

        // [이중 저장: Supabase] 자재 업데이트
        await supabase.from('materials').update({
          stock: newStock,
          updated_at: new Date().toISOString()
        }).eq('id', materialDoc.id).eq('branch', branchName);

        // 재고 변동 기록 생성
        const historyRef = doc(collection(db, 'stockHistory'));
        const historyId = historyRef.id;
        const now = new Date();

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

        // [이중 저장: Supabase] 재고 이력 생성
        await supabase.from('stock_history').insert([{
          id: historyId,
          occurred_at: now.toISOString(),
          type: 'manual_update',
          item_type: 'material',
          item_id: materialId,
          item_name: materialName,
          quantity: stockDifference,
          from_stock: currentStock,
          to_stock: newStock,
          resulting_stock: newStock,
          branch: branchName,
          operator: operatorName,
          notes: `수동 재고 조정: ${reason}`
        }]);

        // 감사 로그 생성
        const auditRef = doc(collection(db, 'auditLogs'));
        const auditId = auditRef.id;

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

        // [이중 저장: Supabase] 감사 로그 생성
        await supabase.from('audit_logs').insert([{
          id: auditId,
          created_at: now.toISOString(),
          action: 'manual_stock_adjustment',
          entity_type: 'material',
          entity_id: materialId,
          entity_name: materialName,
          branch_id: branchId,
          branch_name: branchName,
          operator_id: operatorId,
          operator_name: operatorName,
          details: {
            previousStock: currentStock,
            newStock: newStock,
            difference: stockDifference,
            reason: reason
          },
          user_agent: navigator.userAgent
        }]);

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
      // [Supabase 우선 조회]
      let queryBuilder = supabase
        .from('stock_history')
        .select('*')
        .eq('item_type', 'material');

      if (materialId) {
        queryBuilder = queryBuilder.eq('item_id', materialId);
      }
      if (branchId) {
        queryBuilder = queryBuilder.eq('branch', branchId);
      }
      if (dateFrom) {
        queryBuilder = queryBuilder.gte('occurred_at', dateFrom.toISOString());
      }
      if (dateTo) {
        queryBuilder = queryBuilder.lte('occurred_at', dateTo.toISOString());
      }

      const { data: supabaseHistory, error: supabaseError } = await queryBuilder
        .order('occurred_at', { ascending: false })
        .limit(100);

      if (!supabaseError && supabaseHistory) {
        return supabaseHistory.map(h => ({
          id: h.id,
          date: new Date(h.occurred_at),
          type: h.type,
          itemType: h.item_type,
          itemId: h.item_id,
          itemName: h.item_name,
          quantity: h.quantity,
          fromStock: h.from_stock,
          toStock: h.to_stock,
          resultingStock: h.resulting_stock,
          branch: h.branch,
          operator: h.operator,
          supplier: h.supplier,
          price: h.price,
          totalAmount: h.total_amount,
          relatedRequestId: h.related_request_id,
          notes: h.notes
        }));
      }

      // Fallback: Firebase
      let historyQuery = query(
        collection(db, 'stockHistory'),
        where('itemType', '==', 'material')
      );
      if (materialId) {
        historyQuery = query(historyQuery, where('itemId', '==', materialId));
      }
      const snapshot = await getDocs(historyQuery);
      let movements = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : new Date()
        };
      });

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
