"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type {
  MaterialRequest,
  ActualPurchaseItem,
  PurchaseBatch
} from '@/types/material-request';

export interface InventorySyncResult {
  success: boolean;
  updatedMaterials: number;
  createdHistoryRecords: number;
  errors: string[];
}

export function useInventorySync() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
      for (const item of actualItems) {
        if (item.status === 'unavailable') continue;

        try {
          const { data: material, error: fetchError } = await supabase.from('materials')
            .select('id, stock, supplier')
            .eq('id', item.actualMaterialId || item.originalMaterialId)
            .eq('branch', branchName)
            .maybeSingle();

          if (fetchError || !material) {
            result.errors.push(`자재를 찾을 수 없습니다: ${item.actualMaterialName} (${branchName})`);
            continue;
          }

          const currentStock = Number(material.stock || 0);
          const newStock = currentStock + Number(item.actualQuantity);

          const { error: updateError } = await supabase.from('materials')
            .update({
              stock: newStock,
              price: item.actualPrice,
              supplier: item.supplier || material.supplier,
              updated_at: new Date().toISOString()
            })
            .eq('id', material.id);

          if (updateError) throw updateError;

          const historyPayload = {
            id: crypto.randomUUID(),
            occurred_at: new Date().toISOString(),
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
          };

          const { error: historyError } = await supabase.from('stock_history').insert([historyPayload]);
          if (historyError) throw historyError;

          result.updatedMaterials++;
          result.createdHistoryRecords++;
        } catch (error) {
          result.errors.push(`${item.actualMaterialName} 업데이트 실패: ${error}`);
        }
      }

      await checkLowStockAlerts(branchId, branchName);

      if (result.errors.length > 0) {
        result.success = false;
        toast({ variant: 'destructive', title: '일부 업데이트 실패', description: `${result.errors.length}개 항목 오류` });
      } else {
        toast({ title: '재고 업데이트 완료', description: `${result.updatedMaterials}개 자재 처리됨` });
      }
    } catch (error) {
      result.success = false;
      toast({ variant: 'destructive', title: '재고 동기화 실패', description: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
    return result;
  }, [toast]);

  const checkLowStockAlerts = useCallback(async (branchId?: string, branchName?: string) => {
    try {
      let query = supabase.from('materials').select('*');
      if (branchName) query = query.eq('branch', branchName);

      const { data: materials, error } = await query;
      if (error) throw error;

      const notifications: any[] = [];
      materials?.forEach(material => {
        const stock = Number(material.stock || 0);
        const lowStockThreshold = 10;
        if (stock <= 0) {
          notifications.push({
            id: `${material.id}_out_of_stock`,
            type: 'out_of_stock',
            material_id: material.id,
            material_name: material.name,
            branch_id: branchId || 'unknown',
            branch_name: material.branch,
            current_stock: stock,
            threshold: 0,
            message: `${material.name}이(가) 품절되었습니다.`,
            is_read: false,
            created_at: new Date().toISOString()
          });
        } else if (stock <= lowStockThreshold) {
          notifications.push({
            id: `${material.id}_low_stock`,
            type: 'low_stock',
            material_id: material.id,
            material_name: material.name,
            branch_id: branchId || 'unknown',
            branch_name: material.branch,
            current_stock: stock,
            threshold: lowStockThreshold,
            message: `${material.name}의 재고가 부족합니다. (현재: ${stock}개)`,
            is_read: false,
            created_at: new Date().toISOString()
          });
        }
      });

      if (notifications.length > 0) {
        await supabase.from('inventory_notifications').upsert(notifications);
        toast({ title: '재고 알림', description: `${notifications.length}개의 알림 생성됨` });
      }
    } catch (error) {
      console.error('Low stock alert error:', error);
    }
  }, [toast]);

  const manualStockAdjustment = useCallback(async (
    materialId: string, materialName: string, branchId: string, branchName: string, newStock: number, reason: string, operatorId: string, operatorName: string
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { data: material, error: fetchError } = await supabase.from('materials').select('stock').eq('id', materialId).eq('branch', branchName).single();
      if (fetchError) throw fetchError;

      const currentStock = Number(material.stock || 0);
      const diff = newStock - currentStock;

      const { error: updateError } = await supabase.from('materials').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', materialId).eq('branch', branchName);
      if (updateError) throw updateError;

      await supabase.from('stock_history').insert([{
        id: crypto.randomUUID(), occurred_at: new Date().toISOString(), type: 'manual_update', item_type: 'material', item_id: materialId, item_name: materialName, quantity: diff, from_stock: currentStock, to_stock: newStock, resulting_stock: newStock, branch: branchName, operator: operatorName, notes: `수동 재고 조정: ${reason}`
      }]);

      await supabase.from('audit_logs').insert([{
        id: crypto.randomUUID(), created_at: new Date().toISOString(), action: 'manual_stock_adjustment', entity_type: 'material', entity_id: materialId, entity_name: materialName, branch_id: branchId, branch_name: branchName, operator_id: operatorId, operator_name: operatorName, details: { previousStock: currentStock, newStock: newStock, difference: diff, reason: reason }, user_agent: navigator.userAgent
      }]);

      return true;
    } catch (error) {
      console.error('Manual adjustment error:', error);
      toast({ variant: 'destructive', title: '재고 조정 실패', description: '오류가 발생했습니다.' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getStockMovements = useCallback(async (materialId?: string, branchId?: string, dateFrom?: Date, dateTo?: Date) => {
    try {
      let query = supabase.from('stock_history').select('*').eq('item_type', 'material');
      if (materialId) query = query.eq('item_id', materialId);
      if (branchId) query = query.eq('branch', branchId);
      if (dateFrom) query = query.gte('occurred_at', dateFrom.toISOString());
      if (dateTo) query = query.lte('occurred_at', dateTo.toISOString());

      const { data, error } = await query.order('occurred_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get movements error:', error);
      return [];
    }
  }, []);

  return { loading, syncInventoryOnDelivery, checkLowStockAlerts, manualStockAdjustment, getStockMovements };
}
