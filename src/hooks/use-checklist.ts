import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './use-auth';
import { useUserRole } from './use-user-role';
import { 
  ChecklistTemplate, 
  ChecklistRecord, 
  ChecklistItem, 
  ChecklistItemRecord,
  Worker,
  ChecklistStats,
  ChecklistFilter 
} from '@/types/checklist';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export const useChecklist = () => {
  const { user } = useAuth();
  const { userRole, isHQManager } = useUserRole();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 함수들을 useCallback으로 메모이제이션하여 불필요한 재생성 방지

  // 기본 체크리스트 템플릿 생성
  const createDefaultTemplate = useCallback(async (branchId: string): Promise<string> => {
    try {
      const defaultItems: ChecklistItem[] = [
        // Daily 항목들
        { id: '1', order: 1, title: '1. 오픈준비 및 청소', category: 'daily', required: true },
        { id: '2', order: 2, title: '2. 식물상태체크 및 관수', category: 'daily', required: true },
        { id: '3', order: 3, title: '3. 꽃냉장고안 꽃상태점검', category: 'daily', required: true },
        { id: '4', order: 4, title: '4. 상품제작 및 촬영', category: 'daily', required: true },
        { id: '5', order: 5, title: '5. 상품 메뉴얼 작성', category: 'daily', required: false },
        { id: '6', order: 6, title: '6. 블로그 포스팅(최소한 주2회)', category: 'daily', required: false },
        { id: '7', order: 7, title: '7. 인스타그램 업데이트(3컷씩)', category: 'daily', required: false },
        { id: '8', order: 8, title: '8. 생화정리 및 꽃냉장고청소(주3회 기본, 최소한 주2회)', category: 'daily', required: true },
        { id: '9', order: 9, title: '9. 상품아이디어 써칭', category: 'daily', required: false },
        { id: '10', order: 10, title: '10. 쇼핑백에 로고스티커 부착', category: 'daily', required: true },
        { id: '11', order: 11, title: '11. 쓰레기 및 재활용품 버리기', category: 'daily', required: true },
        { id: '12', order: 12, title: '12. 마감전 매장바닥 및 작업대청소', category: 'daily', required: true },
        { id: '13', order: 13, title: '13. 사용한걸레는 빨아서 널어둠', category: 'daily', required: true },
        { id: '14', order: 14, title: '14. 싱크대 및 싱크볼 청소 및 정리', category: 'daily', required: true },
        
        // Weekly 항목들
        { id: '15', order: 15, title: '1. 주간 매출 정리', category: 'weekly', required: true },
        { id: '16', order: 16, title: '2. 재고 점검', category: 'weekly', required: true },
        { id: '17', order: 17, title: '3. 주간 업무 계획 수립', category: 'weekly', required: true },
        { id: '18', order: 18, title: '4. 직원 교육 및 훈련', category: 'weekly', required: false },
        { id: '19', order: 19, title: '5. 고객 피드백 검토', category: 'weekly', required: false },
        
        // Monthly 항목들
        { id: '20', order: 20, title: '1. 월간 매출 분석', category: 'monthly', required: true },
        { id: '21', order: 21, title: '2. 월간 예산 검토', category: 'monthly', required: true },
        { id: '22', order: 22, title: '3. 직원 평가', category: 'monthly', required: true },
        { id: '23', order: 23, title: '4. 시장 동향 분석', category: 'monthly', required: false },
        { id: '24', order: 24, title: '5. 다음 달 계획 수립', category: 'monthly', required: true },
      ];

      const template: Omit<ChecklistTemplate, 'id'> = {
        name: '릴리맥 매장업무 체크리스트',
        category: 'daily',
        items: defaultItems,
        branchId,
        createdAt: serverTimestamp() as Timestamp,
      };

      const docRef = await addDoc(collection(db, 'checklistTemplates'), template);
      return docRef.id;
    } catch (err) {
      console.error('Error creating default template:', err);
      throw err;
    }
  }, []);

  // 템플릿 가져오기
  const getTemplate = useCallback(async (branchId: string): Promise<ChecklistTemplate | null> => {
    try {
      const q = query(
        collection(db, 'checklistTemplates'),
        where('branchId', '==', branchId),
        limit(1)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // 템플릿이 없으면 기본 템플릿 생성
        const templateId = await createDefaultTemplate(branchId);
        const docRef = doc(db, 'checklistTemplates', templateId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as ChecklistTemplate;
        }
        return null;
      }

      const docSnapshot = snapshot.docs[0];
      return { id: docSnapshot.id, ...docSnapshot.data() } as ChecklistTemplate;
    } catch (err) {
      console.error('Error getting template:', err);
      throw err;
    }
  }, [createDefaultTemplate]);

  // 템플릿 업데이트
  const updateTemplate = useCallback(async (templateId: string, template: ChecklistTemplate): Promise<void> => {
    try {
      const docRef = doc(db, 'checklistTemplates', templateId);
      await updateDoc(docRef, {
        items: template.items,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating template:', err);
      throw err;
    }
  }, []);

  // 체크리스트 생성
  const createChecklist = useCallback(async (
    templateId: string,
    date: string,
    category: 'daily' | 'weekly' | 'monthly',
    workerInfo: {
      openWorker: string;
      closeWorker: string;
      responsiblePerson: string;
    },
    metaInfo?: {
      notes?: string;
      weather?: string;
      specialEvents?: string;
    }
  ): Promise<string> => {
    try {
      // 사용자의 지점 ID 가져오기
      const branchId = userRole?.branchId || user?.franchise || '';
      if (!branchId) {
        throw new Error('Branch ID not found for user');
      }

      const template = await getTemplate(branchId);
      if (!template) throw new Error('Template not found');

      // 날짜 정보 계산
      const dateObj = new Date(date);
      const week = format(dateObj, 'yyyy-\'W\'ww');
      const month = format(dateObj, 'yyyy-MM');

      // 항목들 초기화
      const items: ChecklistItemRecord[] = template.items
        .filter(item => item.category === category)
        .map(item => ({
          itemId: item.id,
          checked: false,
        }));

      const checklist: Omit<ChecklistRecord, 'id'> = {
        templateId,
        branchId,
        branchName: userRole?.branchName || user?.franchise || '',
        date,
        week,
        month,
        category,
        openWorker: workerInfo.openWorker,
        closeWorker: workerInfo.closeWorker,
        responsiblePerson: workerInfo.responsiblePerson,
        items,
        completedBy: user?.uid || '',
        completedAt: serverTimestamp() as Timestamp,
        status: 'pending',
        notes: metaInfo?.notes || '',
        weather: metaInfo?.weather || '',
        specialEvents: metaInfo?.specialEvents || '',
      };

      const docRef = await addDoc(collection(db, 'checklists'), checklist);
      return docRef.id;
    } catch (err) {
      console.error('Error creating checklist:', err);
      throw err;
    }
  }, [getTemplate, user, userRole]);

  // 체크리스트 가져오기
  const getChecklist = useCallback(async (id: string): Promise<ChecklistRecord | null> => {
    try {
      const docRef = doc(db, 'checklists', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ChecklistRecord;
      }
      return null;
    } catch (err) {
      console.error('Error getting checklist:', err);
      throw err;
    }
  }, []);

  // 체크리스트 목록 가져오기
  const getChecklists = useCallback(async (filter: ChecklistFilter = {}): Promise<ChecklistRecord[]> => {
    try {
      let q;
      
      // 본사 관리자는 모든 체크리스트를 볼 수 있음
      if (isHQManager() || user?.role === '본사 관리자') {
        q = query(collection(db, 'checklists'));
      } else {
        // 지점 사용자는 자신의 지점 체크리스트만 볼 수 있음
        const branchId = userRole?.branchId || user?.franchise || '';
        if (!branchId) {
          console.error('Branch ID not found for user');
          return [];
        }
        q = query(
          collection(db, 'checklists'),
          where('branchId', '==', branchId)
        );
      }
      
      const snapshot = await getDocs(q);
      let checklists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChecklistRecord);
      
      // 클라이언트 사이드에서 필터링 및 정렬
      if (filter.date) {
        checklists = checklists.filter(c => c.date === filter.date);
      }
      if (filter.week) {
        checklists = checklists.filter(c => c.week === filter.week);
      }
      if (filter.month) {
        checklists = checklists.filter(c => c.month === filter.month);
      }
      if (filter.status) {
        checklists = checklists.filter(c => c.status === filter.status);
      }
      if (filter.worker) {
        checklists = checklists.filter(c => c.responsiblePerson === filter.worker);
      }
      if (filter.branchId && isHQManager()) {
        checklists = checklists.filter(c => c.branchId === filter.branchId);
      }
      
      // 날짜별 내림차순 정렬
      const sortedChecklists = checklists.sort((a, b) => b.date.localeCompare(a.date));
      
      return sortedChecklists;
    } catch (err) {
      console.error('Error getting checklists:', err);
      throw err;
    }
  }, [user, userRole, isHQManager]);

  // 체크리스트 업데이트
  const updateChecklist = useCallback(async (
    id: string,
    updates: Partial<ChecklistRecord>
  ): Promise<void> => {
    try {
      const docRef = doc(db, 'checklists', id);
      await updateDoc(docRef, {
        ...updates,
        completedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating checklist:', err);
      throw err;
    }
  }, []);

  // 항목 체크/언체크
  const toggleItem = useCallback(async (
    checklistId: string,
    itemId: string,
    checked: boolean,
    workerName?: string,
    notes?: string
  ): Promise<void> => {
    try {
      const checklist = await getChecklist(checklistId);
      if (!checklist) throw new Error('Checklist not found');

      const updatedItems = checklist.items.map(item => {
        if (item.itemId === itemId) {
          return {
            ...item,
            checked,
            checkedAt: checked ? new Date() : undefined,
            checkedBy: checked ? workerName || user?.displayName || 'Unknown' : undefined,
            notes: notes || item.notes,
          };
        }
        return item;
      });

      // 템플릿에서 해당 항목의 required 정보 가져오기
      const template = await getTemplate(checklist.branchId);
      if (!template) throw new Error('Template not found');

      // 필수 항목만으로 완료율 계산
      const requiredItems = template.items.filter(item => item.required && item.category === checklist.category);
      const requiredItemIds = requiredItems.map(item => item.id);
      
      const completedRequiredItems = updatedItems.filter(item => 
        item.checked && requiredItemIds.includes(item.itemId)
      ).length;
      
      const totalRequiredItems = requiredItemIds.length;
      const completionRate = totalRequiredItems > 0 ? (completedRequiredItems / totalRequiredItems) * 100 : 0;
      
      let status: 'pending' | 'completed' | 'partial' = 'pending';
      if (completionRate === 100) status = 'completed';
      else if (completionRate > 0) status = 'partial';

      await updateChecklist(checklistId, {
        items: updatedItems,
        status,
      });
    } catch (err) {
      console.error('Error toggling item:', err);
      throw err;
    }
  }, [getChecklist, updateChecklist, getTemplate, user]);

  // 체크리스트 삭제
  const deleteChecklist = useCallback(async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, 'checklists', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error('Error deleting checklist:', err);
      throw err;
    }
  }, []);

  // 근무자 목록 가져오기
  const getWorkers = useCallback(async (): Promise<Worker[]> => {
    try {
      // 사용자의 지점 ID 가져오기
      const branchId = userRole?.branchId || user?.franchise || '';
      if (!branchId) {
        console.error('Branch ID not found for user');
        return [];
      }

      const q = query(
        collection(db, 'workers'),
        where('branchId', '==', branchId)
      );
      const snapshot = await getDocs(q);
      const workers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Worker);
      
      // 클라이언트 사이드에서 정렬 (임시 해결책)
      return workers.sort((a, b) => {
        if (!a.lastUsed || !b.lastUsed) return 0;
        return b.lastUsed.toDate().getTime() - a.lastUsed.toDate().getTime();
      });
    } catch (err) {
      console.error('Error getting workers:', err);
      throw err;
    }
  }, [user, userRole]);

  // 근무자 추가/업데이트
  const addWorker = useCallback(async (name: string): Promise<void> => {
    try {
      // 사용자의 지점 ID 가져오기
      const branchId = userRole?.branchId || user?.franchise || '';
      if (!branchId) {
        throw new Error('Branch ID not found for user');
      }

      const q = query(
        collection(db, 'workers'),
        where('branchId', '==', branchId),
        where('name', '==', name)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // 새 근무자 추가
        await addDoc(collection(db, 'workers'), {
          name,
          branchId,
          createdAt: serverTimestamp(),
          lastUsed: serverTimestamp(),
        });
      } else {
        // 기존 근무자 lastUsed 업데이트
        const docRef = doc(db, 'workers', snapshot.docs[0].id);
        await updateDoc(docRef, {
          lastUsed: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Error adding worker:', err);
      throw err;
    }
  }, [user, userRole]);

  // 통계 가져오기
  const getStats = useCallback(async (period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<ChecklistStats[]> => {
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = now;
          break;
        case 'weekly':
          startDate = startOfWeek(now, { weekStartsOn: 1 });
          endDate = endOfWeek(now, { weekStartsOn: 1 });
          break;
        case 'monthly':
          startDate = startOfMonth(now);
          endDate = endOfMonth(now);
          break;
      }

      let q;
      
      // 본사 관리자는 모든 체크리스트를 볼 수 있음
      if (isHQManager() || user?.role === '본사 관리자') {
        q = query(collection(db, 'checklists'));
      } else {
        // 지점 사용자는 자신의 지점 체크리스트만 볼 수 있음
        const branchId = userRole?.branchId || user?.franchise || '';
        if (!branchId) {
          console.error('Branch ID not found for user');
          return [];
        }
        q = query(
          collection(db, 'checklists'),
          where('branchId', '==', branchId)
        );
      }

      const snapshot = await getDocs(q);
      let checklists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ChecklistRecord);
      
      // 클라이언트 사이드에서 날짜 필터링
      checklists = checklists.filter(checklist => {
        const checklistDate = new Date(checklist.date);
        return checklistDate >= startDate && checklistDate <= endDate;
      });

      return checklists.map(checklist => {
        const totalItems = checklist.items.length;
        const completedItems = checklist.items.filter(item => item.checked).length;
        const completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

        return {
          totalItems,
          completedItems,
          completionRate,
          lastUpdated: checklist.completedAt,
        };
      });
    } catch (err) {
      console.error('Error getting stats:', err);
      throw err;
    }
  }, [user, userRole, isHQManager]);

  return {
    loading,
    error,
    createDefaultTemplate,
    getTemplate,
    updateTemplate,
    createChecklist,
    getChecklist,
    getChecklists,
    updateChecklist,
    toggleItem,
    deleteChecklist,
    getWorkers,
    addWorker,
    getStats,
  };
};
