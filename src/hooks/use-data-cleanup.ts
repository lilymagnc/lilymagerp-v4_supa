"use client";
import { useState } from 'react';
import { collection, getDocs, deleteDoc, doc, writeBatch, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  const cleanupCollection = async (collectionName: string, description: string) => {
    try {
      setProgress(prev => ({ 
        total: prev?.total || 0, 
        completed: prev?.completed || 0, 
        current: `${description} 삭제 중...` 
      }));
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      if (snapshot.empty) {
        return 0;
      }
      // 더 작은 배치 크기로 안전하게 처리
      const batchSize = 400; // 안전한 배치 크기
      let batch = writeBatch(db);
      let batchCount = 0;
      let totalProcessed = 0;

      for (const docSnapshot of snapshot.docs) {
        try {
          batch.delete(docSnapshot.ref);
          batchCount++;
          
          if (batchCount >= batchSize) {
            await batch.commit();
            console.log(`${collectionName}: ${batchCount}개 문서 삭제 완료 (총 ${totalProcessed + batchCount}/${snapshot.size})`);
            
            // 새로운 배치 생성
            batch = writeBatch(db);
            totalProcessed += batchCount;
            batchCount = 0;
          }
        } catch (error) {
          console.error(`문서 삭제 실패 (${docSnapshot.id}):`, error);
          // 개별 문서 삭제 실패 시 새 배치로 계속
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      
      // 남은 배치가 있으면 커밋
      if (batchCount > 0) {
        try {
          await batch.commit();
          console.log(`${collectionName}: 마지막 ${batchCount}개 문서 삭제 완료`);
        } catch (error) {
          console.error(`마지막 배치 커밋 실패:`, error);
        }
      }
      return snapshot.size;
    } catch (error) {
      console.error(`${collectionName} 삭제 오류:`, error);
      throw error;
    }
  };
  const cleanupOrders = async () => {
    return await cleanupCollection('orders', '주문 데이터');
  };
  const cleanupCustomers = async () => {
    return await cleanupCollection('customers', '고객 데이터');
  };
  const cleanupProducts = async () => {
    return await cleanupCollection('products', '상품 데이터');
  };
  const cleanupMaterials = async () => {
    return await cleanupCollection('materials', '자재 데이터');
  };
  const cleanupExpenses = async () => {
    return await cleanupCollection('simpleExpenses', '간편지출 데이터');
  };
  const cleanupMaterialRequests = async () => {
    return await cleanupCollection('materialRequests', '자재요청 데이터');
  };
  const cleanupEmployees = async () => {
    return await cleanupCollection('employees', '직원 데이터');
  };
  const cleanupPartners = async () => {
    return await cleanupCollection('partners', '거래처 데이터');
  };
  const cleanupStockHistory = async () => {
    return await cleanupCollection('stockHistory', '재고이력 데이터');
  };
  const cleanupSampleAlbums = async () => {
    return await cleanupCollection('albums', '샘플앨범 데이터');
  };
  const cleanupAllData = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인이 필요합니다.'
      });
      return;
    }
    setLoading(true);
    setProgress({ total: 10, completed: 0, current: '초기화 시작...' });
    try {
      const cleanupTasks = [
        { name: '주문 데이터', task: cleanupOrders },
        { name: '고객 데이터', task: cleanupCustomers },
        { name: '상품 데이터', task: cleanupProducts },
        { name: '자재 데이터', task: cleanupMaterials },
        { name: '간편지출 데이터', task: cleanupExpenses },
        { name: '자재요청 데이터', task: cleanupMaterialRequests },
        { name: '직원 데이터', task: cleanupEmployees },
        { name: '거래처 데이터', task: cleanupPartners },
        { name: '재고이력 데이터', task: cleanupStockHistory },
        { name: '샘플앨범 데이터', task: cleanupSampleAlbums }
      ];
      let totalDeleted = 0;
      for (let i = 0; i < cleanupTasks.length; i++) {
        const task = cleanupTasks[i];
        setProgress(prev => ({ 
          total: cleanupTasks.length, 
          completed: i, 
          current: `${task.name} 삭제 중...` 
        }));
        try {
          const deleted = await task.task();
          totalDeleted += deleted;
        } catch (error) {
          console.error(`${task.name} 삭제 실패:`, error);
          // 개별 실패해도 계속 진행
        }
      }
      setProgress({ total: cleanupTasks.length, completed: cleanupTasks.length, current: '완료' });
      toast({
        title: '데이터 초기화 완료',
        description: `총 ${totalDeleted}개의 데이터가 삭제되었습니다.`
      });
    } catch (error) {
      console.error('데이터 초기화 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '데이터 초기화 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };
  const cleanupSpecificData = async (dataType: string) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인이 필요합니다.'
      });
      return;
    }
    setLoading(true);
    setProgress({ total: 1, completed: 0, current: `${dataType} 삭제 중...` });
    try {
      let deleted = 0;
      switch (dataType) {
        case 'orders':
          deleted = await cleanupOrders();
          break;
        case 'customers':
          deleted = await cleanupCustomers();
          break;
        case 'products':
          deleted = await cleanupProducts();
          break;
        case 'materials':
          deleted = await cleanupMaterials();
          break;
        case 'expenses':
          deleted = await cleanupExpenses();
          break;
        case 'materialRequests':
          deleted = await cleanupMaterialRequests();
          break;
        case 'employees':
          deleted = await cleanupEmployees();
          break;
        case 'partners':
          deleted = await cleanupPartners();
          break;
        case 'stockHistory':
          deleted = await cleanupStockHistory();
          break;
        case 'albums':
          deleted = await cleanupSampleAlbums();
          break;
        default:
          throw new Error('알 수 없는 데이터 타입');
      }
      setProgress({ total: 1, completed: 1, current: '완료' });
      toast({
        title: '삭제 완료',
        description: `${dataType} ${deleted}개가 삭제되었습니다.`
      });
    } catch (error) {
      console.error(`${dataType} 삭제 오류:`, error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: `${dataType} 삭제 중 오류가 발생했습니다.`
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };
  return {
    loading,
    progress,
    cleanupAllData,
    cleanupSpecificData
  };
}
