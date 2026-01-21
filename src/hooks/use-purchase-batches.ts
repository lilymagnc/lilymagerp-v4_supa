"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

  const mapRowToBatch = (row: any): PurchaseBatch => ({
    id: row.id,
    batchNumber: row.batch_number,
    purchaseDate: row.purchase_date,
    purchaserId: row.purchaser_id,
    purchaserName: row.purchaser_name,
    includedRequests: row.included_requests || [],
    purchasedItems: row.purchased_items || [],
    totalCost: row.total_cost,
    deliveryPlan: row.delivery_plan || [],
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchBatches = useCallback(async (filters?: {
    status?: 'planning' | 'purchasing' | 'completed';
    limit?: number;
  }) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('purchase_batches').select('*').order('created_at', { ascending: false });
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.limit) query = query.limit(filters.limit);

      const { data, error } = await query;
      if (error) throw error;
      setBatches((data || []).map(mapRowToBatch));
    } catch (err) {
      console.error('구매 배치 조회 오류:', err);
      setError('구매 배치를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createPurchaseBatch = async (
    data: CreatePurchaseBatchData,
    requests: MaterialRequest[]
  ): Promise<PurchaseBatch | null> => {
    if (!user) {
      toast({ title: "오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return null;
    }

    try {
      const batchNumber = generateBatchNumber();
      const id = crypto.randomUUID();
      const deliveryPlan = generateDeliveryPlan(requests);

      const payload = {
        id,
        batch_number: batchNumber,
        purchase_date: new Date().toISOString(),
        purchaser_id: data.purchaserId,
        purchaser_name: data.purchaserName,
        included_requests: data.includedRequests,
        purchased_items: [],
        total_cost: 0,
        delivery_plan: deliveryPlan,
        status: 'planning',
        notes: data.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: batchError } = await supabase.from('purchase_batches').insert([payload]);
      if (batchError) throw batchError;

      // 포함된 요청들의 상태를 'purchasing'으로 업데이트
      const { error: requestError } = await supabase.from('material_requests')
        .update({ status: 'purchasing', updated_at: new Date().toISOString() })
        .in('id', data.includedRequests);
      if (requestError) throw requestError;

      toast({ title: "구매 배치 생성 완료", description: `배치 번호: ${batchNumber}` });
      await fetchBatches();
      return mapRowToBatch(payload);
    } catch (error) {
      console.error('구매 배치 생성 오류:', error);
      toast({ title: "오류", description: "구매 배치 생성 중 오류가 발생했습니다.", variant: "destructive" });
      return null;
    }
  };

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
      const now = new Date().toISOString();

      // 1. 자재 마스터 가격 정보 업데이트
      for (const item of purchaseData.items) {
        if (item.status === 'purchased' || item.status === 'substituted') {
          const materialIdToUpdate = item.actualMaterialId || item.originalMaterialId;
          const materialIdBase = materialIdToUpdate.split('-')[0];

          await supabase.from('materials')
            .update({
              price: item.actualPrice,
              last_purchase_price: item.actualPrice,
              last_purchase_date: now
            })
            .eq('id', materialIdBase);
        }
      }

      // 2. 구매 배치 문서 업데이트
      const { error: batchError } = await supabase.from('purchase_batches')
        .update({
          purchased_items: purchaseData.items,
          total_cost: purchaseData.totalCost,
          status: 'completed',
          notes: purchaseData.notes,
          updated_at: now
        })
        .eq('id', batchId);
      if (batchError) throw batchError;

      // 3. 포함된 요청들의 상태를 'purchased'로 업데이트
      const { data: batch } = await supabase.from('purchase_batches').select('included_requests').eq('id', batchId).single();
      if (batch?.included_requests) {
        await supabase.from('material_requests')
          .update({ status: 'purchased', updated_at: now })
          .in('id', batch.included_requests);
      }

      toast({ title: "구매 내역 저장 완료", description: "실제 구매 내역이 저장되고 자재 정보가 업데이트되었습니다." });
      await fetchBatches();
      return true;
    } catch (error) {
      console.error('구매 내역 입력 오류:', error);
      toast({ title: "오류", description: `구매 내역 저장 중 오류가 발생했습니다.`, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startDelivery = async (batchId: string): Promise<boolean> => {
    if (!user) {
      toast({ title: "오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return false;
    }

    try {
      const now = new Date().toISOString();
      const { data: batch } = await supabase.from('purchase_batches').select('included_requests').eq('id', batchId).single();

      if (batch?.included_requests) {
        await supabase.from('material_requests')
          .update({
            status: 'shipping',
            delivery: {
              shippingDate: now,
              deliveryMethod: '직접배송',
              deliveryStatus: 'shipped'
            },
            updated_at: now
          })
          .in('id', batch.included_requests);
      }

      toast({ title: "배송 시작", description: "배송이 시작되었습니다." });
      await fetchBatches();
      return true;
    } catch (error) {
      console.error('배송 시작 오류:', error);
      toast({ title: "오류", description: "배송 시작 처리 중 오류가 발생했습니다.", variant: "destructive" });
      return false;
    }
  };

  const deleteBatch = async (batchId: string): Promise<boolean> => {
    if (!user) {
      toast({ title: "오류", description: "로그인이 필요합니다.", variant: "destructive" });
      return false;
    }

    try {
      const now = new Date().toISOString();
      const { data: batch } = await supabase.from('purchase_batches').select('included_requests').eq('id', batchId).single();

      if (batch?.included_requests) {
        await supabase.from('material_requests')
          .update({ status: 'reviewing', updated_at: now })
          .in('id', batch.included_requests);
      }

      const { error: deleteError } = await supabase.from('purchase_batches').delete().eq('id', batchId);
      if (deleteError) throw deleteError;

      toast({ title: "구매 배치 삭제", description: "구매 배치가 삭제되었습니다." });
      await fetchBatches();
      return true;
    } catch (error) {
      console.error('구매 배치 삭제 오류:', error);
      toast({ title: "오류", description: "구매 배치 삭제 중 오류가 발생했습니다.", variant: "destructive" });
      return false;
    }
  };

  const generateDeliveryPlan = (requests: MaterialRequest[]): DeliveryPlanItem[] => {
    const branchMap = new Map<string, DeliveryPlanItem>();
    requests.forEach(request => {
      const branchId = request.branchId;
      const branchName = request.branchName;
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, { branchId, branchName, items: [], estimatedCost: 0 });
      }
      const branchPlan = branchMap.get(branchId)!;
      request.requestedItems.forEach(item => {
        const estimatedCost = item.requestedQuantity * item.estimatedPrice;
        branchPlan.estimatedCost += estimatedCost;
        branchPlan.items.push({
          originalMaterialId: item.materialId,
          originalMaterialName: item.materialName,
          requestedQuantity: item.requestedQuantity,
          actualMaterialName: item.materialName,
          actualQuantity: item.requestedQuantity,
          actualPrice: item.estimatedPrice,
          totalAmount: estimatedCost,
          status: 'purchased',
          memo: item.memo || '',
          purchaseDate: new Date().toISOString() as any
        });
      });
    });
    return Array.from(branchMap.values());
  };

  const calculateBatchStats = (batch: PurchaseBatch) => ({
    requestCount: batch.includedRequests.length,
    branchCount: batch.deliveryPlan.length,
    totalItems: batch.purchasedItems.length,
    totalCost: batch.totalCost,
    completionRate: batch.status === 'completed' ? 100 : batch.status === 'purchasing' ? 50 : 0
  });

  useEffect(() => {
    if (user) fetchBatches();
  }, [user, fetchBatches]);

  return {
    batches, loading, error, fetchBatches, createPurchaseBatch, updateActualPurchase, startDelivery, deleteBatch, calculateBatchStats
  };
}
