"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface Category {
  id: string;
  name: string;
  type: 'main' | 'mid';
  parentCategory?: string;
  createdAt: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const mapRowToCategory = (row: any): Category => ({
    id: row.id,
    name: row.name,
    type: row.type,
    parentCategory: row.parent_category,
    createdAt: row.created_at
  });

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories((data || []).map(mapRowToCategory));
    } catch (error) {
      console.error("Error fetching categories: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '카테고리 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (name: string, type: 'main' | 'mid', parentCategory?: string) => {
    try {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('name', name)
        .eq('type', type)
        .maybeSingle();

      if (existing) return false;

      const { error } = await supabase
        .from('categories')
        .insert([{
          id: crypto.randomUUID(),
          name,
          type,
          parent_category: parentCategory,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;
      await fetchCategories();
      return true;
    } catch (error) {
      console.error("Error adding category:", error);
      toast({ variant: 'destructive', title: '오류', description: '카테고리 추가 중 오류가 발생했습니다.' });
      return false;
    }
  };

  const getMainCategories = () => {
    return categories.filter(cat => cat.type === 'main').map(cat => cat.name);
  };

  const getMidCategories = (mainCategory?: string) => {
    if (mainCategory) {
      return categories.filter(cat => cat.type === 'mid' && cat.parentCategory === mainCategory).map(cat => cat.name);
    }
    return categories.filter(cat => cat.type === 'mid').map(cat => cat.name);
  };

  return {
    categories,
    loading,
    fetchCategories,
    addCategory,
    getMainCategories,
    getMidCategories
  };
}
