import { useState, useEffect, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
      const eventsRef = collection(db, 'calendarEvents');

      // 사용자 권한에 따른 쿼리 조건
      let q;
      if (user.role === '본사 관리자') {
        // 관리자는 모든 일정을 볼 수 있음
        q = query(eventsRef, orderBy('startDate', 'desc'));
      } else {
        // 일반 사용자는 자신의 지점 일정과 전체 공지사항만 볼 수 있음
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
          createdByRole: data.createdByRole, // 작성자 역할 로드
          createdByBranch: data.createdByBranch // 작성자 지점 로드
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


      toast({
        title: '일정 추가 완료',
        description: '일정이 성공적으로 추가되었습니다.'
      });

      await fetchEvents();

      const docRef = await addDoc(collection(db, 'calendarEvents'), eventData);
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
      console.log('Firebase에서 삭제 완료:', eventId);

      toast({
        title: '일정 삭제 완료',
        description: '일정이 성공적으로 삭제되었습니다.'
      });

      await fetchEvents();


      console.log('이벤트 목록 새로고침 완료');
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
