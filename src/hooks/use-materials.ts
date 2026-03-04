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
    const [currentFilters, setCurrentFilters] = useState<any>(null);
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
        color: row.color || '',
        supplier: row.supplier || '미지정',
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
            setCurrentFilters(filters);
            fetchStats(filters?.branch);

            let allData: any[] = [];
            let from = 0;
            const step = 1000;
            let isFetching = true;

            while (isFetching) {
                let query = supabase.from('materials').select('*');
                if (filters?.branch && filters.branch !== 'all') query = query.eq('branch', filters.branch);
                if (filters?.mainCategory && filters.mainCategory !== 'all') query = query.eq('main_category', filters.mainCategory);
                if (filters?.midCategory && filters.midCategory !== 'all') query = query.eq('mid_category', filters.midCategory);
                if (filters?.searchTerm) query = query.ilike('name', `%${filters.searchTerm}%`);

                const { data, error } = await query
                    .order('id', { ascending: true })
                    .range(from, from + step - 1);

                if (error) throw error;

                if (!data || data.length === 0) {
                    isFetching = false;
                } else {
                    allData = allData.concat(data);
                    if (data.length < step) {
                        isFetching = false;
                    } else {
                        from += step;
                    }
                }
            }

            setMaterials(allData.map(mapRowToMaterial));
            setHasMore(false); // 전체 로드 완료
        } catch (error) {
            console.error("Error fetching materials: ", error);
            toast({ variant: 'destructive', title: '오류', description: '자재 정보를 불러오는 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    }, [toast, fetchStats]);

    const loadMore = async () => {
        // 더 이상 사용되지 않음 (전체 로드됨)
        return;
    };

    // ── 대분류 → 접두어 매핑 ──
    const MAIN_CAT_PREFIX: Record<string, string> = {
        '생화': 'MF', '식물': 'MP', '바구니 / 화기': 'MB',
        '소모품 및 부자재': 'MM', '조화': 'MA', '프리저브드': 'MR',
    };

    // ── 중분류 → 코드 매핑 ──
    const MID_CAT_CODE: Record<string, Record<string, string>> = {
        'MF': { '장미류': '1', '거베라류': '2', '폼플라워': '3', '필러플라워': '4', '라인플라워': '5', '소재(그린)': '6', '국화류': '7', '카네이션류': '8', '리시안서스류': '9', '기타': '0', '매스플라워': 'A' },
        'MP': { '관엽소형': '1', '관엽중형': '2', '관엽대형': '3', '서양란': '6', '동양란': '7', '기타식물': 'D', '다육선인장소형': '8', '다육선인장중형': '9', '다육선인장대형': '0' },
        'MB': { '바구니': '1', '도자기': '2', '유리': '3', '테라조': '4', '테라코타(토분)': '5', '플라스틱': '6', '기타': '7' },
        'MM': { '원예자재': '1', '데코자재': '2', '포장재': '3', '리본/텍': '4', '기타': '5', '제작도구': '6' },
        'MA': { '장미류': '1', '카네이션류': '2', '리시안서스류': '3', '국화류': '4', '거베라류': '5', '폼플라워': '6', '라인플라워': '7', '필러플라워': '8', '소재(그린)': '9', '트리류': '0', '매스플라워': 'A' },
        'MR': { '플라워': '1', '잎소재': '2', '열매': '3', '폼플라워': '4', '기타': '5' },
    };

    // ── 지점 → 코드 매핑 ──
    const BRANCH_CODE: Record<string, string> = {
        '릴리맥여의도점': '1', '릴리맥여의도2호점': '2',
        '릴리맥광화문점': '3', '릴리맥NC이스트폴점': '4',
    };

    const generateNewId = async (mainCategory: string, midCategory?: string, branch?: string) => {
        const prefix = MAIN_CAT_PREFIX[mainCategory] || 'MM';
        const midCode = (midCategory && MID_CAT_CODE[prefix]?.[midCategory]) || '0';
        const branchCode = (branch && BRANCH_CODE[branch]) || '1';
        const pattern = `${prefix}${midCode}`;

        // 해당 prefix+midCode 조합의 기존 최대 순번 조회
        const { data } = await supabase
            .from('materials')
            .select('id')
            .like('id', `${pattern}%`);

        let maxSeq = 0;
        if (data && data.length > 0) {
            // ID 형식: XX + Y + ZZZZ + B (8자리)
            const regex = new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d{4})\\d$`);
            for (const item of data) {
                const match = item.id.match(regex);
                if (match) {
                    const seq = parseInt(match[1], 10);
                    if (seq > maxSeq) maxSeq = seq;
                }
            }
        }
        return `${pattern}${String(maxSeq + 1).padStart(4, '0')}${branchCode}`;
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
            const newId = await generateNewId(data.mainCategory, data.midCategory, data.branch);
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
            if (currentFilters) await fetchMaterials(currentFilters);
            else await fetchMaterials();
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
                color: data.color,
                supplier: data.supplier,
                branch: data.branch,
                memo: data.memo,
                updated_at: new Date().toISOString()
            }).eq('id', docId);

            if (error) throw error;
            await syncCategory(data.mainCategory, data.midCategory);
            toast({ title: "성공", description: "자재 정보가 수정되었습니다." });
            if (currentFilters) await fetchMaterials(currentFilters);
            else await fetchMaterials();
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
            if (currentFilters) await fetchMaterials(currentFilters);
            else await fetchMaterials();
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
                const { data: material } = await supabase.from('materials').select('stock, price, supplier').eq('id', item.id).eq('branch', branchName).single();
                if (material) {
                    const currentStock = material.stock || 0;
                    const change = type === 'in' ? item.quantity : -item.quantity;
                    const newStock = currentStock + change;

                    await supabase.from('materials').update({
                        stock: newStock,
                        price: item.price || material.price, // Update master price
                        supplier: item.supplier || material.supplier, // Update master supplier
                        updated_at: new Date().toISOString()
                    }).eq('id', item.id).eq('branch', branchName);

                    await supabase.from('stock_history').insert([{
                        id: crypto.randomUUID(),
                        occurred_at: new Date().toISOString(),
                        type,
                        item_type: "material",
                        item_id: item.id,
                        item_name: item.name,
                        quantity: item.quantity,
                        from_stock: currentStock,
                        to_stock: newStock,
                        resulting_stock: newStock,
                        branch: branchName,
                        operator,
                        price: item.price, // New field for tracking
                        supplier: item.supplier, // New field for tracking
                        total_amount: (item.price || 0) * item.quantity // New field for tracking
                    }]);
                }
            } catch (error) {
                console.error(error);
            }
        }
        if (currentFilters) await fetchMaterials(currentFilters);
        else await fetchMaterials();
    };

    const manualUpdateStock = async (itemId: string, itemName: string, newStock: number, branchName: string, operator: string) => {
        try {
            const { data: material } = await supabase.from('materials').select('stock').eq('id', itemId).eq('branch', branchName).single();
            if (!material) return;

            const currentStock = material.stock || 0;
            await supabase.from('materials').update({ stock: newStock, updated_at: new Date().toISOString() }).eq('id', itemId).eq('branch', branchName);

            await supabase.from('stock_history').insert([{
                id: crypto.randomUUID(),
                occurred_at: new Date().toISOString(),
                type: "manual_update",
                item_type: "material",
                item_id: itemId,
                item_name: itemName,
                quantity: newStock - currentStock,
                from_stock: currentStock,
                to_stock: newStock,
                resulting_stock: newStock,
                branch: branchName,
                operator,
            }]);
            if (currentFilters) await fetchMaterials(currentFilters);
            else await fetchMaterials();
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

            // Deduplicate by ID
            const uniqueMaterialsMap = new Map();
            materialsToInsert.forEach(m => {
                if (m.id) uniqueMaterialsMap.set(m.id, m);
            });
            const finalMaterials = Array.from(uniqueMaterialsMap.values());

            const { error } = await supabase.from('materials').upsert(finalMaterials);
            if (error) throw error;

            // Category sync for all inserted items
            for (const item of data) {
                if (item.mainCategory && item.midCategory) {
                    await syncCategory(item.mainCategory, item.midCategory);
                }
            }

            toast({ title: "성공", description: `${data.length}개의 자재가 등록되었습니다.` });
            if (currentFilters) await fetchMaterials(currentFilters);
            else await fetchMaterials();
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
