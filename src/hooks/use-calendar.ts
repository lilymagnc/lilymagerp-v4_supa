"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';

export interface CalendarEvent {
  id: string;
  type: 'delivery' | 'pickup' | 'material' | 'employee' | 'notice' | 'payment';
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  branchName: string;
  status: 'pending' | 'completed' | 'cancelled';
  relatedId?: string;
  color: string;
  isAllDay?: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  createdByRole?: string;
  createdByBranch?: string;
}

export interface CreateCalendarEventData {
  type: CalendarEvent['type'];
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  branchName: string;
  status: CalendarEvent['status'];
  relatedId?: string;
  color: string;
  isAllDay?: boolean;
}

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const mapRowToEvent = (row: any): CalendarEvent => ({
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    startDate: new Date(row.start_date),
    endDate: row.end_date ? new Date(row.end_date) : undefined,
    branchName: row.branch_name,
    status: row.status,
    relatedId: row.related_id,
    color: row.color,
    isAllDay: row.is_all_day,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    createdBy: row.created_by,
    createdByRole: row.created_by_role,
    createdByBranch: row.created_by_branch
  });

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      let query = supabase.from('calendar_events').select('*');

      const isAdmin = user.role === '본사 관리자' ||
        user.email?.toLowerCase() === 'lilymag0301@gmail.com' ||
        user.email?.toLowerCase() === 'lilymagg01@gmail.com';

      if (!isAdmin) {
        query = query.in('branch_name', [user.franchise, '전체']);
      }

      const { data, error } = await query.order('start_date', { ascending: false });
      if (error) throw error;
      setEvents((data || []).map(mapRowToEvent));
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({ variant: 'destructive', title: '로드 실패', description: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const createEvent = useCallback(async (data: CreateCalendarEventData) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('calendar_events').insert([{
        id: crypto.randomUUID(),
        type: data.type,
        title: data.title,
        description: data.description,
        start_date: data.startDate.toISOString(),
        end_date: data.endDate?.toISOString(),
        branch_name: data.branchName,
        status: data.status,
        related_id: data.relatedId,
        color: data.color,
        is_all_day: data.isAllDay,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user.id,
        created_by_role: user.role,
        created_by_branch: user.franchise
      }]);

      if (error) throw error;
      toast({ title: '추가 완료', description: '성공적으로 추가되었습니다.' });
      await fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({ variant: 'destructive', title: '추가 실패', description: '오류 발생' });
    }
  }, [user, toast, fetchEvents]);

  const updateEvent = useCallback(async (eventId: string, data: Partial<CreateCalendarEventData>) => {
    if (!user) return;
    try {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (data.type) updatePayload.type = data.type;
      if (data.title) updatePayload.title = data.title;
      if (data.description !== undefined) updatePayload.description = data.description;
      if (data.startDate) updatePayload.start_date = data.startDate.toISOString();
      if (data.endDate !== undefined) updatePayload.end_date = data.endDate?.toISOString();
      if (data.branchName) updatePayload.branch_name = data.branchName;
      if (data.status) updatePayload.status = data.status;
      if (data.relatedId !== undefined) updatePayload.related_id = data.relatedId;
      if (data.color) updatePayload.color = data.color;
      if (data.isAllDay !== undefined) updatePayload.is_all_day = data.isAllDay;

      const { error } = await supabase.from('calendar_events').update(updatePayload).eq('id', eventId);
      if (error) throw error;
      toast({ title: '수정 완료', description: '성공적으로 수정되었습니다.' });
      await fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({ variant: 'destructive', title: '수정 실패', description: '오류 발생' });
    }
  }, [user, toast, fetchEvents]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
      if (error) throw error;
      toast({ title: '삭제 완료', description: '성공적으로 삭제되었습니다.' });
      await fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({ variant: 'destructive', title: '삭제 실패', description: '오류 발생' });
    }
  }, [user, toast, fetchEvents]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, createEvent, updateEvent, deleteEvent, fetchEvents };
}
