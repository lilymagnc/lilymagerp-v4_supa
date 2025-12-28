import { useState, useEffect, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
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
  createdByRole?: string; // 작성자 역할 추가
  createdByBranch?: string; // 작성자 지점 추가
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

  // 일정 목록 가져오기
  const fetchEvents = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // [Supabase 우선 조회]
      let queryBuilder = supabase
        .from('calendar_events')
        .select('*')
        .order('start_date', { ascending: false });

      if (user.role !== '본사 관리자') {
        queryBuilder = queryBuilder.or(`branch_name.eq."${user.franchise}",branch_name.eq."전체"`);
      }

      const { data: supabaseItems, error: supabaseError } = await queryBuilder;

      if (!supabaseError && supabaseItems) {
        const eventsData = supabaseItems.map(item => ({
          id: item.id,
          type: item.type as any,
          title: item.title,
          description: item.description,
          startDate: new Date(item.start_date),
          endDate: item.end_date ? new Date(item.end_date) : undefined,
          branchName: item.branch_name,
          status: item.status as any,
          relatedId: item.related_id,
          color: item.color,
          isAllDay: item.is_all_day,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at),
          createdBy: item.created_by,
          createdByRole: item.created_by_role,
          createdByBranch: item.created_by_branch
        } as CalendarEvent));

        setEvents(eventsData);
        setLoading(false);
        return;
      }

      const eventsRef = collection(db, 'calendarEvents');

      // 사용자 권한에 따른 쿼리 조건
      let q;
      if (user.role === '본사 관리자') {
        q = query(eventsRef, orderBy('startDate', 'desc'));
      } else {
        q = query(
          eventsRef,
          where('branchName', 'in', [user.franchise, '전체']),
          orderBy('startDate', 'desc')
        );
      }

      const querySnapshot = await getDocs(q);
      const eventsData: CalendarEvent[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        eventsData.push({
          id: doc.id,
          type: data.type,
          title: data.title,
          description: data.description,
          startDate: data.startDate.toDate(),
          endDate: data.endDate?.toDate(),
          branchName: data.branchName,
          status: data.status,
          relatedId: data.relatedId,
          color: data.color,
          isAllDay: data.isAllDay,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
          createdBy: data.createdBy,
          createdByRole: data.createdByRole,
          createdByBranch: data.createdByBranch
        });
      });

      setEvents(eventsData);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        variant: 'destructive',
        title: '일정 로드 실패',
        description: '일정을 불러오는 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // 일정 생성
  const createEvent = useCallback(async (data: CreateCalendarEventData) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인이 필요합니다.'
      });
      return;
    }

    try {
      const eventData = {
        ...data,
        startDate: Timestamp.fromDate(data.startDate),
        endDate: data.endDate ? Timestamp.fromDate(data.endDate) : null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
        createdByRole: user.role, // 작성자 역할 저장
        createdByBranch: user.franchise // 작성자 지점 저장
      };

      const docRef = await addDoc(collection(db, 'calendarEvents'), eventData);

      // [이중 저장: Supabase]
      await supabase.from('calendar_events').insert([{
        id: docRef.id,
        type: data.type,
        title: data.title,
        description: data.description,
        start_date: data.startDate.toISOString(),
        end_date: data.endDate ? data.endDate.toISOString() : null,
        branch_name: data.branchName,
        status: data.status,
        related_id: data.relatedId,
        color: data.color,
        is_all_day: data.isAllDay,
        created_by: user.uid,
        created_by_role: user.role,
        created_by_branch: user.franchise,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      toast({
        title: '일정 추가 완료',
        description: '일정이 성공적으로 추가되었습니다.'
      });

      await fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        variant: 'destructive',
        title: '일정 추가 실패',
        description: '일정 추가 중 오류가 발생했습니다.'
      });
    }
  }, [user, toast, fetchEvents]);

  // 일정 수정
  const updateEvent = useCallback(async (eventId: string, data: Partial<CreateCalendarEventData>) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인이 필요합니다.'
      });
      return;
    }

    try {
      const eventRef = doc(db, 'calendarEvents', eventId);
      const updateData: any = {
        ...data,
        updatedAt: Timestamp.now()
      };

      // 날짜 필드 변환
      if (data.startDate) {
        updateData.startDate = Timestamp.fromDate(data.startDate);
      }
      if (data.endDate) {
        updateData.endDate = Timestamp.fromDate(data.endDate);
      }

      await updateDoc(eventRef, updateData);

      // [이중 저장: Supabase]
      const supabaseUpdateData: any = {};
      if (data.type) supabaseUpdateData.type = data.type;
      if (data.title) supabaseUpdateData.title = data.title;
      if (data.description !== undefined) supabaseUpdateData.description = data.description;
      if (data.startDate) supabaseUpdateData.start_date = data.startDate.toISOString();
      if (data.endDate !== undefined) supabaseUpdateData.end_date = data.endDate ? data.endDate.toISOString() : null;
      if (data.branchName) supabaseUpdateData.branch_name = data.branchName;
      if (data.status) supabaseUpdateData.status = data.status;
      if (data.relatedId !== undefined) supabaseUpdateData.related_id = data.relatedId;
      if (data.color) supabaseUpdateData.color = data.color;
      if (data.isAllDay !== undefined) supabaseUpdateData.is_all_day = data.isAllDay;
      supabaseUpdateData.updated_at = new Date().toISOString();

      await supabase.from('calendar_events').update(supabaseUpdateData).eq('id', eventId);

      toast({
        title: '일정 수정 완료',
        description: '일정이 성공적으로 수정되었습니다.'
      });

      await fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        variant: 'destructive',
        title: '일정 수정 실패',
        description: '일정 수정 중 오류가 발생했습니다.'
      });
    }
  }, [user, toast, fetchEvents]);

  // 일정 삭제
  const deleteEvent = useCallback(async (eventId: string) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인이 필요합니다.'
      });
      return;
    }

    try {

      await deleteDoc(doc(db, 'calendarEvents', eventId));

      // [이중 저장: Supabase]
      await supabase.from('calendar_events').delete().eq('id', eventId);


      toast({
        title: '일정 삭제 완료',
        description: '일정이 성공적으로 삭제되었습니다.'
      });

      await fetchEvents();

    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        variant: 'destructive',
        title: '일정 삭제 실패',
        description: '일정 삭제 중 오류가 발생했습니다.'
      });
    }
  }, [user, toast, fetchEvents]);

  // 초기 로드
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchEvents
  };
}
