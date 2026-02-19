"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

  const mapRowToTemplate = (row: any): ChecklistTemplate => ({
    id: row.id,
    name: row.name,
    category: row.category,
    items: row.items || [],
    branchId: row.branch_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const mapRowToRecord = (row: any): ChecklistRecord => ({
    id: row.id,
    templateId: row.template_id,
    branchId: row.branch_id,
    branchName: row.branch_name,
    date: row.record_date,
    week: row.week,
    month: row.month,
    category: row.category,
    openWorker: row.open_worker,
    closeWorker: row.close_worker,
    responsiblePerson: row.responsible_person,
    items: row.items || [],
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    status: row.status,
    notes: row.notes,
    weather: row.weather,
    specialEvents: row.special_events
  });

  const mapRowToWorker = (row: any): Worker => ({
    id: row.id,
    name: row.name,
    branchId: row.branch_id,
    createdAt: row.created_at,
    lastUsed: row.last_used
  });

  const createDefaultTemplate = useCallback(async (branchId: string): Promise<string> => {
    try {
      const defaultItems: ChecklistItem[] = [
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
        { id: '15', order: 15, title: '1. 주간 매출 정리', category: 'weekly', required: true },
        { id: '16', order: 16, title: '2. 재고 점검', category: 'weekly', required: true },
        { id: '17', order: 17, title: '3. 주간 업무 계획 수립', category: 'weekly', required: true },
        { id: '18', order: 18, title: '4. 직원 교육 및 훈련', category: 'weekly', required: false },
        { id: '19', order: 19, title: '5. 고객 피드백 검토', category: 'weekly', required: false },
        { id: '20', order: 20, title: '1. 월간 매출 분석', category: 'monthly', required: true },
        { id: '21', order: 21, title: '2. 월간 예산 검토', category: 'monthly', required: true },
        { id: '22', order: 22, title: '3. 직원 평가', category: 'monthly', required: true },
        { id: '23', order: 23, title: '4. 시장 동향 분석', category: 'monthly', required: false },
        { id: '24', order: 24, title: '5. 다음 달 계획 수립', category: 'monthly', required: true },
      ];

      const id = crypto.randomUUID();
      const payload = {
        id,
        name: '릴리맥 매장업무 체크리스트',
        category: 'daily',
        items: defaultItems,
        branch_id: branchId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('checklist_templates').insert([payload]);
      if (error) throw error;
      return id;
    } catch (err) {
      console.error('Error creating default template:', err);
      throw err;
    }
  }, []);

  const getTemplate = useCallback(async (branchId: string): Promise<ChecklistTemplate | null> => {
    try {
      const { data, error } = await supabase.from('checklist_templates')
        .select('*')
        .eq('branch_id', branchId)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        const templateId = await createDefaultTemplate(branchId);
        const { data: newData } = await supabase.from('checklist_templates').select('*').eq('id', templateId).single();
        return newData ? mapRowToTemplate(newData) : null;
      }

      return mapRowToTemplate(data);
    } catch (err) {
      console.error('Error getting template:', err);
      throw err;
    }
  }, [createDefaultTemplate]);

  const updateTemplate = useCallback(async (templateId: string, template: ChecklistTemplate): Promise<void> => {
    try {
      const { error } = await supabase.from('checklist_templates').update({
        items: template.items,
        updated_at: new Date().toISOString()
      }).eq('id', templateId);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating template:', err);
      throw err;
    }
  }, []);

  const createChecklist = useCallback(async (
    templateId: string,
    date: string,
    category: 'daily' | 'weekly' | 'monthly',
    metaInfo?: { notes?: string; weather?: string; specialEvents?: string; }
  ): Promise<string> => {
    try {
      const branchId = userRole?.branchId || user?.franchise || '';
      if (!branchId) throw new Error('Branch ID not found');

      const template = await getTemplate(branchId);
      if (!template) throw new Error('Template not found');

      const dateObj = new Date(date);
      const week = format(dateObj, 'yyyy-\'W\'ww');
      const month = format(dateObj, 'yyyy-MM');

      const items: ChecklistItemRecord[] = template.items
        .filter(item => item.category === category)
        .map(item => ({ itemId: item.id, checked: false }));

      const id = crypto.randomUUID();
      const payload = {
        id,
        template_id: templateId,
        branch_id: branchId,
        branch_name: userRole?.branchName || user?.franchise || '',
        record_date: date,
        week,
        month,
        category,
        open_worker: '',
        close_worker: '',
        responsible_person: '',
        items,
        completed_by: user?.id || (user as any).uid || '',
        completed_at: new Date().toISOString(),
        status: 'pending',
        notes: metaInfo?.notes || '',
        weather: metaInfo?.weather || '',
        special_events: metaInfo?.specialEvents || ''
      };

      const { error } = await supabase.from('checklists').insert([payload]);
      if (error) throw error;
      return id;
    } catch (err) {
      console.error('Error creating checklist:', err);
      throw err;
    }
  }, [getTemplate, user, userRole]);

  const getChecklist = useCallback(async (id: string): Promise<ChecklistRecord | null> => {
    try {
      const { data, error } = await supabase.from('checklists').select('*').eq('id', id).single();
      if (error) throw error;
      return data ? mapRowToRecord(data) : null;
    } catch (err) {
      console.error('Error getting checklist:', err);
      throw err;
    }
  }, []);

  const getChecklists = useCallback(async (filter: ChecklistFilter = {}): Promise<ChecklistRecord[]> => {
    try {
      let query = supabase.from('checklists').select('*');

      if (!(isHQManager() || user?.role === '본사 관리자')) {
        const branchId = userRole?.branchId || user?.franchise || '';
        if (branchId) query = query.eq('branch_id', branchId);
      } else if (filter.branchId) {
        query = query.eq('branch_id', filter.branchId);
      }

      if (filter.date) query = query.eq('record_date', filter.date);
      if (filter.week) query = query.eq('week', filter.week);
      if (filter.month) query = query.eq('month', filter.month);
      if (filter.status) query = query.eq('status', filter.status);
      if (filter.worker) query = query.eq('responsible_person', filter.worker);

      const { data, error } = await query.order('record_date', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRowToRecord);
    } catch (err) {
      console.error('Error getting checklists:', err);
      throw err;
    }
  }, [user, userRole, isHQManager]);

  const updateChecklist = useCallback(async (id: string, updates: Partial<ChecklistRecord>): Promise<void> => {
    try {
      const payload: any = {
        // updated_at: new Date().toISOString() // Column missing in DB
      };

      if (updates.status) payload.status = updates.status;
      if (updates.items) payload.items = updates.items;
      if (updates.notes) payload.notes = updates.notes;
      if (updates.weather) payload.weather = updates.weather;
      if (updates.specialEvents) payload.special_events = updates.specialEvents;
      if (updates.completedBy) payload.completed_by = updates.completedBy;
      if (updates.completedAt) payload.completed_at = updates.completedAt;

      const { error } = await supabase.from('checklists').update(payload).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error updating checklist:', err);
      throw err;
    }
  }, []);

  const toggleItem = useCallback(async (
    checklistId: string, itemId: string, checked: boolean, workerName?: string, notes?: string
  ): Promise<void> => {
    try {
      const checklist = await getChecklist(checklistId);
      if (!checklist) throw new Error('Checklist not found');

      const updatedItems = checklist.items.map(item => {
        if (item.itemId === itemId) {
          return {
            ...item,
            checked,
            checkedAt: checked ? new Date().toISOString() : undefined,
            checkedBy: checked ? workerName || user?.email?.split('@')[0] || 'Unknown' : undefined,
            notes: notes || item.notes,
          };
        }
        return item;
      });

      const template = await getTemplate(checklist.branchId);
      if (!template) throw new Error('Template not found');

      const requiredItems = template.items.filter(item => item.required && item.category === checklist.category);
      const requiredItemIds = requiredItems.map(item => item.id);
      const completedRequiredItems = updatedItems.filter(item => item.checked && requiredItemIds.includes(item.itemId)).length;
      const totalRequiredItems = requiredItemIds.length;
      const completionRate = totalRequiredItems > 0 ? (completedRequiredItems / totalRequiredItems) * 100 : 0;

      let status: 'pending' | 'completed' | 'partial' = 'pending';
      if (completionRate === 100) status = 'completed';
      else if (completionRate > 0) status = 'partial';

      await updateChecklist(checklistId, { items: updatedItems, status });
    } catch (err) {
      console.error('Error toggling item:', err);
      throw err;
    }
  }, [getChecklist, updateChecklist, getTemplate, user]);

  const deleteChecklist = useCallback(async (id: string): Promise<void> => {
    try {
      const { error } = await supabase.from('checklists').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error deleting checklist:', err);
      throw err;
    }
  }, []);

  const getWorkers = useCallback(async (): Promise<Worker[]> => {
    try {
      const branchId = userRole?.branchId || user?.franchise || '';
      if (!branchId) return [];

      const { data, error } = await supabase.from('workers')
        .select('*')
        .eq('branch_id', branchId)
        .order('last_used', { ascending: false });

      if (error) throw error;
      return (data || []).map(mapRowToWorker);
    } catch (err) {
      console.error('Error getting workers:', err);
      throw err;
    }
  }, [user, userRole]);

  const addWorker = useCallback(async (name: string): Promise<void> => {
    try {
      const branchId = userRole?.branchId || user?.franchise || '';
      if (!branchId) throw new Error('Branch ID not found');

      const { data: existing } = await supabase.from('workers')
        .select('id')
        .eq('branch_id', branchId)
        .eq('name', name)
        .maybeSingle();

      if (!existing) {
        await supabase.from('workers').insert([{
          id: crypto.randomUUID(),
          name,
          branch_id: branchId,
          created_at: new Date().toISOString(),
          last_used: new Date().toISOString()
        }]);
      } else {
        await supabase.from('workers').update({ last_used: new Date().toISOString() }).eq('id', existing.id);
      }
    } catch (err) {
      console.error('Error adding worker:', err);
      throw err;
    }
  }, [user, userRole]);

  const getStats = useCallback(async (period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<ChecklistStats[]> => {
    try {
      const now = new Date();
      let startDate: string;

      switch (period) {
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString().split('T')[0];
          break;
        case 'weekly':
          startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString().split('T')[0];
          break;
        case 'monthly':
          startDate = startOfMonth(now).toISOString().split('T')[0];
          break;
        default:
          startDate = format(now, 'yyyy-MM-dd');
      }

      let query = supabase.from('checklists').select('*');
      if (!(isHQManager() || user?.role === '본사 관리자')) {
        const branchId = userRole?.branchId || user?.franchise || '';
        if (branchId) query = query.eq('branch_id', branchId);
      }
      query = query.gte('record_date', startDate);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(checklist => {
        const totalItems = checklist.items.length;
        const completedItems = checklist.items.filter((item: any) => item.checked).length;
        const completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
        return {
          totalItems,
          completedItems,
          completionRate,
          lastUpdated: checklist.completed_at
        };
      });
    } catch (err) {
      console.error('Error getting stats:', err);
      throw err;
    }
  }, [user, userRole, isHQManager]);

  return {
    loading, error, createDefaultTemplate, getTemplate, updateTemplate, createChecklist, getChecklist, getChecklists, updateChecklist, toggleItem, deleteChecklist, getWorkers, addWorker, getStats,
  };
};
