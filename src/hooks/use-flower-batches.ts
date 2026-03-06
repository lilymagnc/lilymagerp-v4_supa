"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface FlowerBatch {
    id: string;
    materialId: string;
    materialName: string;
    branch: string;
    quantityIn: number;
    quantityRemaining: number;
    stockedAt: string;
    expiresAt: string;
    status: 'active' | 'expired' | 'disposed';
    disposedAt?: string;
    disposedBy?: string;
}

export interface BatchSummary {
    totalActive: number;
    totalExpired: number;
    expiringToday: number;
    expiringSoon: number; // 3일 이내
}

const EXPIRY_DAYS = 7;

export function useFlowerBatches() {
    const [batches, setBatches] = useState<FlowerBatch[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const mapRow = (row: any): FlowerBatch => ({
        id: row.id,
        materialId: row.material_id,
        materialName: row.material_name,
        branch: row.branch,
        quantityIn: row.quantity_in,
        quantityRemaining: row.quantity_remaining,
        stockedAt: row.stocked_at,
        expiresAt: row.expires_at,
        status: row.status,
        disposedAt: row.disposed_at,
        disposedBy: row.disposed_by,
    });

    // 배치 목록 조회
    const fetchBatches = useCallback(async (branch?: string, includeDisposed = false) => {
        try {
            setLoading(true);
            let query = supabase.from('fresh_flower_batches').select('*');
            if (branch && branch !== 'all') query = query.eq('branch', branch);
            if (!includeDisposed) query = query.neq('status', 'disposed');
            query = query.order('expires_at', { ascending: true });

            const { data, error } = await query;
            if (error) throw error;
            setBatches((data || []).map(mapRow));
        } catch (error) {
            console.error('배치 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // 생화 입고 시 배치 생성
    const createBatch = useCallback(async (items: {
        materialId: string;
        materialName: string;
        branch: string;
        quantity: number;
        mainCategory?: string;
    }[]) => {
        try {
            // 생화 카테고리 항목만 필터링
            const freshItems = items.filter(item => item.mainCategory === '생화' && item.quantity > 0);
            if (freshItems.length === 0) return;

            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS);

            const payloads = freshItems.map(item => ({
                id: crypto.randomUUID(),
                material_id: item.materialId,
                material_name: item.materialName,
                branch: item.branch,
                quantity_in: item.quantity,
                quantity_remaining: item.quantity,
                stocked_at: now.toISOString(),
                expires_at: expiresAt.toISOString(),
                status: 'active',
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
            }));

            const { error } = await supabase.from('fresh_flower_batches').insert(payloads);
            if (error) throw error;

            console.log(`[FlowerBatch] ${freshItems.length}건 생화 배치 생성 완료 (만료: ${expiresAt.toLocaleDateString()})`);
        } catch (error) {
            console.error('배치 생성 오류:', error);
        }
    }, []);

    // 만료 배치만 폐기 (입고일+7일 초과분)
    const disposeExpiredBatches = useCallback(async (branch: string, operator: string) => {
        try {
            setLoading(true);
            const now = new Date().toISOString();

            // 만료되었고 잔여수량이 있는 active 배치 조회
            const { data: expiredBatches, error } = await supabase
                .from('fresh_flower_batches')
                .select('*')
                .eq('branch', branch)
                .eq('status', 'active')
                .lte('expires_at', now)
                .gt('quantity_remaining', 0);

            if (error) throw error;
            if (!expiredBatches || expiredBatches.length === 0) {
                toast({ title: '안내', description: '현재 만료된 생화 배치가 없습니다.' });
                return { disposedCount: 0, totalQuantity: 0 };
            }

            let totalDisposedQuantity = 0;
            const materialUpdates: Record<string, number> = {}; // materialId -> 폐기 수량

            for (const batch of expiredBatches) {
                const qty = batch.quantity_remaining;
                totalDisposedQuantity += qty;

                // 자재별 폐기 수량 합산
                if (!materialUpdates[batch.material_id]) materialUpdates[batch.material_id] = 0;
                materialUpdates[batch.material_id] += qty;

                // 배치 상태 → disposed
                await supabase.from('fresh_flower_batches').update({
                    status: 'disposed',
                    quantity_remaining: 0,
                    disposed_at: now,
                    disposed_by: operator,
                    updated_at: now,
                }).eq('id', batch.id);

                // stock_history 기록
                await supabase.from('stock_history').insert([{
                    id: crypto.randomUUID(),
                    occurred_at: now,
                    type: 'out',
                    item_type: 'material',
                    item_id: batch.material_id,
                    item_name: batch.material_name,
                    quantity: qty,
                    from_stock: 0, // 아래에서 실제 재고로 업데이트
                    to_stock: 0,
                    resulting_stock: 0,
                    branch,
                    operator,
                    memo: `생화 만료 폐기 (입고: ${new Date(batch.stocked_at).toLocaleDateString()}, 만료: ${new Date(batch.expires_at).toLocaleDateString()})`,
                }]);
            }

            // 자재 테이블의 재고 차감
            for (const [materialId, disposeQty] of Object.entries(materialUpdates)) {
                const { data: mat } = await supabase.from('materials')
                    .select('stock')
                    .eq('id', materialId)
                    .eq('branch', branch)
                    .maybeSingle();

                if (mat) {
                    const currentStock = mat.stock || 0;
                    const newStock = Math.max(0, currentStock - disposeQty);
                    await supabase.from('materials').update({
                        stock: newStock,
                        updated_at: now,
                    }).eq('id', materialId).eq('branch', branch);

                    // stock_history의 from/to 업데이트 (가장 최근 기록)
                    const { data: latestHistory } = await supabase.from('stock_history')
                        .select('id')
                        .eq('item_id', materialId)
                        .eq('branch', branch)
                        .eq('type', 'out')
                        .order('occurred_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (latestHistory) {
                        await supabase.from('stock_history').update({
                            from_stock: currentStock,
                            to_stock: newStock,
                            resulting_stock: newStock,
                        }).eq('id', latestHistory.id);
                    }
                }
            }

            toast({
                title: '생화 만료 폐기 완료',
                description: `${expiredBatches.length}건 배치, 총 ${totalDisposedQuantity}개 폐기 처리`,
            });

            return { disposedCount: expiredBatches.length, totalQuantity: totalDisposedQuantity };
        } catch (error) {
            console.error('만료 폐기 오류:', error);
            toast({ variant: 'destructive', title: '오류', description: '만료 폐기 처리 중 문제가 발생했습니다.' });
            return { disposedCount: 0, totalQuantity: 0 };
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // 생화 출고 시 FIFO로 가장 오래된 배치부터 차감
    const consumeFromBatch = useCallback(async (materialId: string, branch: string, quantity: number) => {
        try {
            // 해당 자재의 active 배치를 만료일 오름차순으로 조회 (FIFO)
            const { data: activeBatches } = await supabase
                .from('fresh_flower_batches')
                .select('*')
                .eq('material_id', materialId)
                .eq('branch', branch)
                .eq('status', 'active')
                .gt('quantity_remaining', 0)
                .order('stocked_at', { ascending: true });

            if (!activeBatches || activeBatches.length === 0) return;

            let remaining = quantity;
            for (const batch of activeBatches) {
                if (remaining <= 0) break;

                const consume = Math.min(remaining, batch.quantity_remaining);
                const newRemaining = batch.quantity_remaining - consume;

                await supabase.from('fresh_flower_batches').update({
                    quantity_remaining: newRemaining,
                    status: newRemaining <= 0 ? 'disposed' : 'active',
                    updated_at: new Date().toISOString(),
                }).eq('id', batch.id);

                remaining -= consume;
            }
        } catch (error) {
            console.error('배치 차감 오류:', error);
        }
    }, []);

    // 배치 요약 통계
    const getBatchSummary = useCallback((batchList: FlowerBatch[]): BatchSummary => {
        const now = new Date();
        const threeDaysLater = new Date(now);
        threeDaysLater.setDate(threeDaysLater.getDate() + 3);
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const activeBatches = batchList.filter(b => b.status === 'active' && b.quantityRemaining > 0);

        return {
            totalActive: activeBatches.reduce((sum, b) => sum + b.quantityRemaining, 0),
            totalExpired: activeBatches.filter(b => new Date(b.expiresAt) <= now).reduce((sum, b) => sum + b.quantityRemaining, 0),
            expiringToday: activeBatches.filter(b => {
                const exp = new Date(b.expiresAt);
                return exp > now && exp <= todayEnd;
            }).reduce((sum, b) => sum + b.quantityRemaining, 0),
            expiringSoon: activeBatches.filter(b => {
                const exp = new Date(b.expiresAt);
                return exp > now && exp <= threeDaysLater;
            }).reduce((sum, b) => sum + b.quantityRemaining, 0),
        };
    }, []);

    return {
        batches,
        loading,
        fetchBatches,
        createBatch,
        disposeExpiredBatches,
        consumeFromBatch,
        getBatchSummary,
    };
}
