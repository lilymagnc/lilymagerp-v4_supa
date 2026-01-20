"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';

export interface Category {
  id: string;
  name: string;
  type: 'main' | 'mid';
  parentCategory?: string;
  createdAt: string;
}

// Supabase 동기화


export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const categoriesCollection = collection(db, 'categories');
      const categoriesData = (await getDocs(categoriesCollection)).docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Category;
      });
      setCategories(categoriesData);
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
      // 중복 확인
      const existingQuery = query(
        collection(db, 'categories'),
        where('name', '==', name),
        where('type', '==', type)
      );
      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        return false; // 이미 존재함
      }
      const categoryData = {
        name,
        type,
        parentCategory,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, 'categories'), categoryData);


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
