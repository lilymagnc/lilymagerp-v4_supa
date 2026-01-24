"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type { ProductFormValues } from '@/app/dashboard/products/components/product-form';

export interface Product {
  id: string;
  docId: string;
  name: string;
  mainCategory: string;
  midCategory: string;
  price: number;
  supplier: string;
  stock: number;
  size: string;
  color: string;
  branch: string;
  code?: string;
  category?: string;
  status: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastIndex, setLastIndex] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    lowStock: 0,
    outOfStock: 0,
    totalStock: 0
  });

  const { toast } = useToast();

  const getStatus = (stock: number): string => {
    if (stock === 0) return 'out_of_stock';
    if (stock < 10) return 'low_stock';
    return 'active';
  }

  const mapRowToProduct = (row: any): Product => ({
    id: row.id,
    docId: row.id,
    name: row.name,
    mainCategory: row.main_category,
    midCategory: row.mid_category,
    price: Number(row.price),
    supplier: row.supplier,
    stock: row.stock,
    size: row.size,
    color: row.color,
    branch: row.branch,
    code: row.code,
    category: row.category,
    status: getStatus(row.stock)
  });

  const fetchStats = useCallback(async (filters?: { branch?: string; mainCategory?: string }) => {
    try {
      let query = supabase.from('products').select('*', { count: 'exact', head: true });
      if (filters?.branch && filters.branch !== 'all') query = query.eq('branch', filters.branch);
      if (filters?.mainCategory && filters.mainCategory !== 'all') query = query.eq('main_category', filters.mainCategory);
      const { count: total } = await query;

      let lowQuery = supabase.from('products').select('*', { count: 'exact', head: true }).gt('stock', 0).lt('stock', 10);
      if (filters?.branch && filters.branch !== 'all') lowQuery = lowQuery.eq('branch', filters.branch);
      if (filters?.mainCategory && filters.mainCategory !== 'all') lowQuery = lowQuery.eq('main_category', filters.mainCategory);
      const { count: lowStock } = await lowQuery;

      let outQuery = supabase.from('products').select('*', { count: 'exact', head: true }).eq('stock', 0);
      if (filters?.branch && filters.branch !== 'all') outQuery = outQuery.eq('branch', filters.branch);
      if (filters?.mainCategory && filters.mainCategory !== 'all') outQuery = outQuery.eq('main_category', filters.mainCategory);
      const { count: outOfStock } = await outQuery;

      let sumQuery = supabase.from('products').select('stock');
      if (filters?.branch && filters.branch !== 'all') sumQuery = sumQuery.eq('branch', filters.branch);
      if (filters?.mainCategory && filters.mainCategory !== 'all') sumQuery = sumQuery.eq('main_category', filters.mainCategory);
      const { data: stockData } = await sumQuery;
      const totalStock = stockData?.reduce((acc, curr) => acc + (curr.stock || 0), 0) || 0;

      setStats({
        total: total || 0,
        lowStock: lowStock || 0,
        outOfStock: outOfStock || 0,
        totalStock
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  const fetchProducts = useCallback(async (filters?: {
    branch?: string;
    searchTerm?: string;
    mainCategory?: string;
    pageSize?: number;
  }) => {
    try {
      setLoading(true);
      fetchStats({ branch: filters?.branch, mainCategory: filters?.mainCategory });

      let query = supabase.from('products').select('*');
      if (filters?.branch && filters.branch !== 'all') query = query.eq('branch', filters.branch);
      if (filters?.mainCategory && filters.mainCategory !== 'all') query = query.eq('main_category', filters.mainCategory);
      if (filters?.searchTerm) query = query.ilike('name', `%${filters.searchTerm}%`);

      const pageSize = filters?.pageSize || 50;
      const { data, error } = await query
        .order('id', { ascending: true })
        .range(0, pageSize - 1);

      if (error) throw error;

      setProducts((data || []).map(mapRowToProduct));
      setLastIndex(pageSize);
      setHasMore((data || []).length >= pageSize);
    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '상품 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, fetchStats]);

  const loadMore = async (filters?: {
    branch?: string;
    mainCategory?: string;
    pageSize?: number;
  }) => {
    if (!hasMore) return;
    try {
      setLoading(true);
      const pageSize = filters?.pageSize || 50;
      let query = supabase.from('products').select('*');
      if (filters?.branch && filters.branch !== 'all') query = query.eq('branch', filters.branch);
      if (filters?.mainCategory && filters.mainCategory !== 'all') query = query.eq('main_category', filters.mainCategory);

      const { data, error } = await query
        .order('id', { ascending: true })
        .range(lastIndex, lastIndex + pageSize - 1);

      if (error) throw error;

      const newProducts = (data || []).map(mapRowToProduct);
      setProducts(prev => [...prev, ...newProducts]);
      setLastIndex(prev => prev + pageSize);
      setHasMore(newProducts.length >= pageSize);
    } catch (error) {
      console.error("Error loading more products:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateNewId = async () => {
    const { data } = await supabase
      .from('products')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    let lastIdNumber = 0;
    if (data && data.length > 0) {
      const lastId = data[0].id;
      if (lastId && lastId.startsWith('P')) {
        lastIdNumber = parseInt(lastId.replace('P', ''), 10);
      }
    }
    return `P${String(lastIdNumber + 1).padStart(5, '0')}`;
  }

  const addProduct = async (data: ProductFormValues) => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('name', data.name)
        .limit(1)
        .maybeSingle();

      const productId = existing ? existing.id : await generateNewId();

      const { error } = await supabase
        .from('products')
        .insert([{
          id: productId,
          name: data.name,
          main_category: data.mainCategory,
          mid_category: data.midCategory,
          price: Number(data.price),
          supplier: data.supplier,
          stock: Number(data.stock),
          size: data.size,
          color: data.color,
          branch: data.branch,
          code: data.code,
          category: data.category,
          status: getStatus(Number(data.stock))
        }]);

      if (error) throw error;
      toast({ title: "성공", description: `새 상품이 '${data.branch}' 지점에 추가되었습니다.` });
      await fetchProducts({ branch: data.branch });
    } catch (error) {
      console.error("Error adding product:", error);
      toast({ variant: 'destructive', title: '오류', description: '상품 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (docId: string, data: ProductFormValues) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: data.name,
          main_category: data.mainCategory,
          mid_category: data.midCategory,
          price: Number(data.price),
          supplier: data.supplier,
          stock: Number(data.stock),
          size: data.size,
          color: data.color,
          branch: data.branch,
          code: data.code,
          category: data.category,
          status: getStatus(Number(data.stock))
        })
        .eq('id', docId);

      if (error) throw error;
      toast({ title: "성공", description: "상품 정보가 수정되었습니다." });
      setProducts(prev => prev.map(p => p.id === docId ? { ...p, ...data, price: Number(data.price), stock: Number(data.stock) } : p));
    } catch (error) {
      console.error("Error updating product:", error);
      toast({ variant: 'destructive', title: '오류', description: '상품 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (docId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', docId);
      if (error) throw error;
      toast({ title: "성공", description: "상품이 삭제되었습니다." });
      setProducts(prev => prev.filter(p => p.id !== docId));
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({ variant: 'destructive', title: '오류', description: '상품 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkAddProducts = async (data: any[], selectedBranch?: string) => {
    setLoading(true);
    try {
      const productsToInsert = data.map(row => ({
        id: row.id || row.code || row.상품코드 || crypto.randomUUID(),
        name: row.name || row.상품명,
        main_category: row.mainCategory || row.대분류,
        mid_category: row.midCategory || row.중분류,
        price: Number(row.price || row.가격 || 0),
        supplier: row.supplier || row.공급업체,
        stock: Number(row.stock || row.재고 || 0),
        size: row.size || row.규격,
        color: row.color || row.색상,
        branch: row.branch || row.지점 || selectedBranch,
        status: getStatus(Number(row.stock || 0))
      }));

      // Deduplicate by ID
      const uniqueProductsMap = new Map();
      productsToInsert.forEach(p => {
        if (p.id) uniqueProductsMap.set(p.id, p);
      });
      const finalProducts = Array.from(uniqueProductsMap.values());

      const { error } = await supabase.from('products').upsert(finalProducts);
      if (error) throw error;

      toast({ title: '처리 완료', description: `${productsToInsert.length}개의 상품 정보가 반영되었습니다.` });
      await fetchProducts({ branch: selectedBranch });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '오류', description: '일괄 등록 중 오류 발생' });
    } finally {
      setLoading(false);
    }
  };

  const manualUpdateStock = async (productId: string, productName: string, newStock: number, branch: string, userEmail: string) => {
    try {
      setLoading(true);
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('branch', branch)
        .single();

      if (!product) throw new Error("상품을 찾을 수 없습니다.");

      const currentStock = product.stock || 0;
      await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', productId)
        .eq('branch', branch);

      await supabase.from('stock_history').insert([{
        id: crypto.randomUUID(),
        type: 'manual_update',
        item_type: 'product',
        item_id: productId,
        item_name: productName,
        quantity: newStock - currentStock,
        from_stock: currentStock,
        to_stock: newStock,
        branch: branch,
        operator: userEmail,
        created_at: new Date().toISOString()
      }]);

      toast({ title: "성공", description: "재고가 업데이트되었습니다." });
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '오류', description: '재고 업데이트 실패' });
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (
    items: { id: string; name: string; quantity: number, price?: number, supplier?: string }[],
    type: 'in' | 'out',
    branchName: string,
    operator: string
  ) => {
    for (const item of items) {
      try {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .eq('branch', branchName)
          .single();

        if (product) {
          const change = type === 'in' ? item.quantity : -item.quantity;
          const newStock = (product.stock || 0) + change;
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.id)
            .eq('branch', branchName);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return {
    products,
    loading,
    hasMore,
    stats,
    addProduct,
    updateProduct,
    deleteProduct,
    bulkAddProducts,
    manualUpdateStock,
    updateStock,
    fetchProducts,
    loadMore
  };
}
