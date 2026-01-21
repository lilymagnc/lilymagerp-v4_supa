"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';

export interface CleanupProgress {
  total: number;
  completed: number;
  current: string;
}

export function useDataCleanup() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<CleanupProgress | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const cleanupTable = async (tableName: string, description: string) => {
    try {
      setProgress(prev => ({
        total: prev?.total || 0,
        completed: prev?.completed || 0,
        current: `${description} 삭제 중...`
      }));

      // Supabase table delete all
      const { error, count } = await supabase.from(tableName).delete().neq('id', 'placeholder_that_does_not_exist');
      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error(`${tableName} 삭제 오류:`, error);
      throw error;
    }
  };

  const cleanupAllData = async () => {
    if (!user) {
      toast({ variant: 'destructive', title: '오류', description: '로그인이 필요합니다.' });
      return;
    }
    setLoading(true);
    const tables = [
      { id: 'orders', name: '주문 데이터' },
      { id: 'customers', name: '고객 데이터' },
      { id: 'products', name: '상품 데이터' },
      { id: 'materials', name: '자재 데이터' },
      { id: 'simple_expenses', name: '간편지출 데이터' },
      { id: 'material_requests', name: '자재요청 데이터' },
      { id: 'employees', name: '직원 데이터' },
      { id: 'partners', name: '거래처 데이터' },
      { id: 'stock_history', name: '재고이력 데이터' },
      { id: 'albums', name: '샘플앨범 데이터' }
    ];

    setProgress({ total: tables.length, completed: 0, current: '초기화 시작...' });
    try {
      let totalDeleted = 0;
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        setProgress(prev => ({ total: tables.length, completed: i, current: `${table.name} 삭제 중...` }));
        try {
          const deleted = await cleanupTable(table.id, table.name);
          totalDeleted += deleted;
        } catch (error) {
          console.error(`${table.name} 삭제 실패:`, error);
        }
      }
      setProgress({ total: tables.length, completed: tables.length, current: '완료' });
      toast({ title: '데이터 초기화 완료', description: `초기화 처리가 완료되었습니다.` });
    } catch (error) {
      console.error('데이터 초기화 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '데이터 초기화 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const cleanupSpecificData = async (dataType: string) => {
    if (!user) {
      toast({ variant: 'destructive', title: '오류', description: '로그인이 필요합니다.' });
      return;
    }
    setLoading(true);
    setProgress({ total: 1, completed: 0, current: `${dataType} 삭제 중...` });
    try {
      const deleted = await cleanupTable(dataType, dataType);
      setProgress({ total: 1, completed: 1, current: '완료' });
      toast({ title: '삭제 완료', description: `${dataType} 초기화 처리가 완료되었습니다.` });
    } catch (error) {
      console.error(`${dataType} 삭제 오류:`, error);
      toast({ variant: 'destructive', title: '오류', description: `${dataType} 삭제 중 오류가 발생했습니다.` });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return { loading, progress, cleanupAllData, cleanupSpecificData };
}
