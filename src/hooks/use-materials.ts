"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type { Material as MaterialData } from "@/app/dashboard/materials/components/material-table";
import type { MaterialFormValues } from '@/app/dashboard/materials/components/material-form';

export type Material = MaterialData;

export function useMaterials() {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastIndex, setLastIndex] = useState(0);
    const [stats, setStats] = useState({
        totalTypes: 0,
        totalStock: 0,
        lowStock: 0,
        outOfStock: 0
    });
    const { toast } = useToast();

    const getStatus = (stock: number): string => {
        if (stock === 0) return 'out_of_stock';
        if (stock < 10) return 'low_stock';
        return 'active';
    }

    const mapRowToMaterial = (row: any): Material => ({
        id: row.id,
        docId: row.id,
        name: row.name,
        mainCategory: row.main_category,
        midCategory: row.mid_category,
        unit: row.unit,
        spec: row.spec,
        price: Number(row.price),
        stock: Number(row.stock),
        size: row.size,
        branch: row.branch,
        memo: row.memo,
        status: getStatus(Number(row.stock))
    });

    const fetchStats = useCallback(async (branch?: string) => {
        try {
            let query = supabase.from('materials').select('*', { count: 'exact', head: true });
            if (branch && branch !== 'all') query = query.eq('branch', branch);
            const { count: totalTypes } = await query;

            let sumQuery = supabase.from('materials').select('stock');
            if (branch && branch !== 'all') sumQuery = sumQuery.eq('branch', branch);
            const { data: stockData } = await sumQuery;
            const totalStock = stockData?.reduce((acc, curr) => acc + (curr.stock || 0), 0) || 0;

            let lowQuery = supabase.from('materials').select('*', { count: 'exact', head: true }).gt('stock', 0).lt('stock', 10);
            if (branch && branch !== 'all') lowQuery = lowQuery.eq('branch', branch);
            const { count: lowStock } = await lowQuery;

            let outQuery = supabase.from('materials').select('*', { count: 'exact', head: true }).eq('stock', 0);
            if (branch && branch !== 'all') outQuery = outQuery.eq('branch', branch);
            const { count: outOfStock } = await outQuery;

            setStats({
                totalTypes: totalTypes || 0,
                totalStock,
                lowStock: lowStock || 0,
                outOfStock: outOfStock || 0
            });
        } catch (error) {
            console.error("Error fetching stats:", error);
        }
    }, []);

    const fetchMaterials = useCallback(async (filters?: {
        branch?: string;
        searchTerm?: string;
        mainCategory?: string;
        midCategory?: string;
        pageSize?: number;
    }) => {
        try {
            setLoading(true);
            fetchStats(filters?.branch);

            let query = supabase.from('materials').select('*');
            if (filters?.branch && filters.branch !== 'all') query = query.eq('branch', filters.branch);
            if (filters?.mainCategory && filters.mainCategory !== 'all') query = query.eq('main_category', filters.mainCategory);
            if (filters?.midCategory && filters.midCategory !== 'all') query = query.eq('mid_category', filters.midCategory);
            if (filters?.searchTerm) query = query.ilike('name', `%${filters.searchTerm}%`);

            const pageSize = filters?.pageSize || 50;
            const { data, error } = await query
                .order('id', { ascending: true })
                .range(0, pageSize - 1);

            if (error) throw error;

            setMaterials((data || []).map(mapRowToMaterial));
            setLastIndex(pageSize);
            setHasMore((data || []).length >= pageSize);
        } catch (error) {
            console.error("Error fetching materials: ", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 정보를 불러오는 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    }, [toast, fetchStats]);

    const loadMore = async (filters?: {
        branch?: string;
        mainCategory?: string;
        midCategory?: string;
        pageSize?: number;
    }) => {
        if (!hasMore) return;
        try {
            setLoading(true);
            const pageSize = filters?.pageSize || 50;
            let query = supabase.from('materials').select('*');
            if (filters?.branch && filters.branch !== 'all') query = query.eq('branch', filters.branch);
            if (filters?.mainCategory && filters.mainCategory !== 'all') query = query.eq('main_category', filters.mainCategory);
            if (filters?.midCategory && filters.midCategory !== 'all') query = query.eq('mid_category', filters.midCategory);

            const { data, error } = await query
                .order('id', { ascending: true })
                .range(lastIndex, lastIndex + pageSize - 1);

            if (error) throw error;

            const newMaterials = (data || []).map(mapRowToMaterial);
            setMaterials(prev => [...prev, ...newMaterials]);
            setLastIndex(prev => prev + pageSize);
            setHasMore(newMaterials.length >= pageSize);
        } catch (error) {
            console.error("Error loading more materials:", error);
        } finally {
            setLoading(false);
        }
    };

    const generateNewId = async () => {
        const { data } = await supabase
            .from('materials')
            .select('id')
            .order('id', { ascending: false })
            .limit(1);

        let lastIdNumber = 0;
        if (data && data.length > 0) {
            const lastId = data[0].id;
            if (lastId && lastId.startsWith('M')) {
                lastIdNumber = parseInt(lastId.replace('M', ''), 10);
            }
        }
        return `M${String(lastIdNumber + 1).padStart(5, '0')}`;
    }

    const syncCategory = async (main: string, mid: string) => {
        try {
            const { data: existingMain } = await supabase.from('categories').select('id').eq('name', main).eq('type', 'main').maybeSingle();
            if (!existingMain) {
                await supabase.from('categories').insert([{ id: crypto.randomUUID(), name: main, type: 'main', created_at: new Date().toISOString() }]);
            }
            const { data: existingMid } = await supabase.from('categories').select('id').eq('name', mid).eq('type', 'mid').eq('parent_category', main).maybeSingle();
            if (!existingMid) {
                await supabase.from('categories').insert([{ id: crypto.randomUUID(), name: mid, type: 'mid', parent_category: main, created_at: new Date().toISOString() }]);
            }
        } catch (e) {
            console.error("Category sync error:", e);
        }
    };

    const addMaterial = async (data: MaterialFormValues) => {
        setLoading(true);
        try {
            const newId = await generateNewId();
            const { error } = await supabase.from('materials').insert([{
                id: newId,
                name: data.name,
                main_category: data.mainCategory,
                mid_category: data.midCategory,
                unit: data.unit,
                spec: data.spec,
                price: Number(data.price),
                stock: Number(data.stock),
                size: data.size,
                branch: data.branch,
                memo: data.memo,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);

            if (error) throw error;
            await syncCategory(data.mainCategory, data.midCategory);
            toast({ title: "성공", description: `새 자재가 추가되었습니다.` });
            await fetchMaterials();
        } catch (error) {
            console.error("Error adding material:", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 추가 중 오류 발생' });
        } finally {
            setLoading(false);
        }
    }

    const updateMaterial = async (docId: string, materialId: string, data: MaterialFormValues) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('materials').update({
                name: data.name,
                main_category: data.mainCategory,
                mid_category: data.midCategory,
                unit: data.unit,
                spec: data.spec,
                price: Number(data.price),
                stock: Number(data.stock),
                size: data.size,
                branch: data.branch,
                memo: data.memo,
                updated_at: new Date().toISOString()
            }).eq('id', docId);

            if (error) throw error;
            await syncCategory(data.mainCategory, data.midCategory);
            toast({ title: "성공", description: "자재 정보가 수정되었습니다." });
            await fetchMaterials();
        } catch (error) {
            console.error("Error updating material:", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 수정 중 오류 발생' });
        } finally {
            setLoading(false);
        }
    }

    const deleteMaterial = async (docId: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.from('materials').delete().eq('id', docId);
            if (error) throw error;
            await fetchMaterials();
            toast({ title: "성공", description: "자재가 삭제되었습니다." });
        } catch (error) {
            console.error("Error deleting material:", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 삭제 중 오류 발생' });
        } finally {
            setLoading(false);
        }
    }

    const updateStock = async (
        items: { id: string; name: string; quantity: number, price?: number, supplier?: string }[],
        type: 'in' | 'out',
        branchName: string,
        operator: string
    ) => {
        for (const item of items) {
            try {
                const { data: material } = await supabase.from('materials').select('stock').eq('id', item.id).eq('branch', branchName).single();
                if (material) {
                    const currentStock = material.stock || 0;
                    const change = type === 'in' ? item.quantity : -item.quantity;
                    const newStock = currentStock + change;

                    await supabase.from('materials').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', item.id).eq('branch', branchName);

                    await supabase.from('stock_history').insert([{
                        id: crypto.randomUUID(),
                        created_at: new Date().toISOString(),
                        type,
                        item_type: "material",
                        item_id: item.id,
                        item_name: item.name,
                        quantity: item.quantity,
                        from_stock: currentStock,
                        to_stock: newStock,
                        branch: branchName,
                        operator,
                    }]);
                }
            } catch (error) {
                console.error(error);
            }
        }
        await fetchMaterials();
    };

    const manualUpdateStock = async (itemId: string, itemName: string, newStock: number, branchName: string, operator: string) => {
        try {
            const { data: material } = await supabase.from('materials').select('stock').eq('id', itemId).eq('branch', branchName).single();
            if (!material) return;

            const currentStock = material.stock || 0;
            await supabase.from('materials').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', itemId).eq('branch', branchName);

            await supabase.from('stock_history').insert([{
                id: crypto.randomUUID(),
                created_at: new Date().toISOString(),
                type: "manual_update",
                item_type: "material",
                item_id: itemId,
                item_name: itemName,
                quantity: newStock - currentStock,
                from_stock: currentStock,
                to_stock: newStock,
                branch: branchName,
                operator,
            }]);
            await fetchMaterials();
        } catch (error) {
            console.error(error);
        }
    };

    const bulkAddMaterials = async (data: any[], currentBranch: string) => {
        setLoading(true);
        try {
            const materialsToInsert = data.map(item => ({
                id: item.id || crypto.randomUUID(),
                name: item.name,
                main_category: item.mainCategory,
                mid_category: item.midCategory,
                unit: item.unit,
                spec: item.spec,
                price: Number(item.price || 0),
                stock: Number(item.stock || 0),
                size: item.size,
                branch: currentBranch || item.branch,
                memo: item.memo,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('materials').upsert(materialsToInsert);
            if (error) throw error;

            // Category sync for all inserted items
            for (const item of data) {
                if (item.mainCategory && item.midCategory) {
                    await syncCategory(item.mainCategory, item.midCategory);
                }
            }

            toast({ title: "성공", description: `${data.length}개의 자재가 등록되었습니다.` });
            await fetchMaterials();
        } catch (error) {
            console.error("Bulk add error:", error);
            toast({ variant: 'destructive', title: '오류', description: '대량 등록 중 오류 발생' });
        } finally {
            setLoading(false);
        }
    };

    const rebuildCategories = async () => {
        try {
            setLoading(true);
            const { data: materialsData } = await supabase.from('materials').select('main_category, mid_category');
            if (!materialsData) return;

            for (const row of materialsData) {
                if (row.main_category && row.mid_category) {
                    await syncCategory(row.main_category, row.mid_category);
                }
            }
            toast({ title: "카테고리 복구 완료", description: "모든 자재를 바탕으로 카테고리 목록을 재구축했습니다." });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return {
        materials,
        loading,
        hasMore,
        stats,
        fetchStats,
        loadMore,
        updateStock,
        fetchMaterials,
        manualUpdateStock,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        bulkAddMaterials,
        rebuildCategories
    };
}
