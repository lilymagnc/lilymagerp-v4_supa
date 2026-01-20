"use client";
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
export interface Notification {
  id: string;
  type: 'budget_alert' | 'expense_approval' | 'purchase_request' | 'system';
  subType: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  // 대상자 정보
  userId?: string;
  userRole?: string;
  branchId?: string;
  departmentId?: string;
  // 관련 데이터
  relatedId?: string;
  relatedType?: string;
  actionUrl?: string;
  // 상태
  isRead: boolean;
  readAt?: Timestamp;
  isArchived: boolean;
  // 자동 처리
  autoExpire?: boolean;
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
export interface NotificationRule {
  id: string;
  name: string;
  type: Notification['type'];
  conditions: {
    field: string;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
    value: any;
  }[];
  actions: {
    type: 'email' | 'push' | 'sms';
    template: string;
    recipients: string[];
  }[];
  isActive: boolean;
  createdAt: Timestamp;
}
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  // 알림 목록 조회
  const fetchNotifications = useCallback(async (userId?: string, limit_count = 50) => {
    try {
      setLoading(true);
      let notificationQuery = query(
        collection(db, 'notifications'),
        orderBy('createdAt', 'desc'),
        limit(limit_count)
      );
      if (userId) {
        notificationQuery = query(
          notificationQuery,
          where('userId', '==', userId)
        );
      }
      const snapshot = await getDocs(notificationQuery);
      const notificationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        variant: 'destructive',
        title: '알림 조회 실패',
        description: '알림을 불러오는 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  // 실시간 알림 구독
  const subscribeToNotifications = useCallback((userId?: string) => {
    let notificationQuery = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    if (userId) {
      notificationQuery = query(
        notificationQuery,
        where('userId', '==', userId)
      );
    }
    const unsubscribe = onSnapshot(notificationQuery, (snapshot) => {
      const notificationData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.isRead).length);
    });
    return unsubscribe;
  }, []);
  // 알림 생성
  const createNotification = useCallback(async (data: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const notification: Omit<Notification, 'id'> = {
        ...data,
        isRead: false,
        isArchived: false,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      await addDoc(collection(db, 'notifications'), notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }, []);
  // 예산 초과 알림 생성
  const createBudgetAlert = useCallback(async (
    budgetId: string,
    budgetName: string,
    usage: number,
    severity: Notification['severity'] = 'medium'
  ) => {
    const message = usage >= 100 
      ? `${budgetName}이 예산을 ${(usage - 100).toFixed(1)}% 초과했습니다.`
      : `${budgetName}의 예산 사용률이 ${usage.toFixed(1)}%에 도달했습니다.`;
    await createNotification({
      type: 'budget_alert',
      subType: usage >= 100 ? 'over_budget' : 'near_limit',
      title: '예산 알림',
      message,
      severity,
      relatedId: budgetId,
      relatedType: 'budget',
      actionUrl: `/dashboard/budgets`,
      autoExpire: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) as any // 7일 후 만료
    });
  }, [createNotification]);
  // 비용 승인 알림 생성
  const createExpenseApprovalAlert = useCallback(async (
    expenseId: string,
    expenseTitle: string,
    amount: number,
    approverId: string
  ) => {
    await createNotification({
      type: 'expense_approval',
      subType: 'approval_required',
      title: '비용 승인 요청',
      message: `${expenseTitle} (${new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW'
      }).format(amount)})의 승인이 필요합니다.`,
      severity: amount >= 1000000 ? 'high' : 'medium',
      userId: approverId,
      relatedId: expenseId,
      relatedType: 'expense',
      actionUrl: `/dashboard/expenses?tab=approval`,
      autoExpire: true,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) as any // 3일 후 만료
    });
  }, [createNotification]);
  // 구매 요청 알림 생성
  const createPurchaseRequestAlert = useCallback(async (
    requestId: string,
    requestTitle: string,
    urgency: 'normal' | 'urgent',
    managerId?: string
  ) => {
    await createNotification({
      type: 'purchase_request',
      subType: urgency === 'urgent' ? 'urgent_request' : 'new_request',
      title: '구매 요청 알림',
      message: `새로운 ${urgency === 'urgent' ? '긴급 ' : ''}구매 요청: ${requestTitle}`,
      severity: urgency === 'urgent' ? 'high' : 'medium',
      userId: managerId,
      relatedId: requestId,
      relatedType: 'purchase_request',
      actionUrl: `/dashboard/purchase-request`,
      autoExpire: true,
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) as any // 5일 후 만료
    });
  }, [createNotification]);
  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, {
        isRead: true,
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // 로컬 상태 업데이트
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, isRead: true, readAt: new Date() as any }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);
  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async (userId?: string) => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const updatePromises = unreadNotifications.map(notification => {
        const docRef = doc(db, 'notifications', notification.id);
        return updateDoc(docRef, {
          isRead: true,
          readAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
      await Promise.all(updatePromises);
      // 로컬 상태 업데이트
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true, readAt: new Date() as any }))
      );
      setUnreadCount(0);
      toast({
        title: '알림 읽음 처리 완료',
        description: '모든 알림을 읽음으로 처리했습니다.'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        variant: 'destructive',
        title: '알림 처리 실패',
        description: '알림 읽음 처리 중 오류가 발생했습니다.'
      });
    }
  }, [notifications, toast]);
  // 알림 아카이브
  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, {
        isArchived: true,
        updatedAt: serverTimestamp()
      });
      // 로컬 상태에서 제거
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error archiving notification:', error);
    }
  }, []);
  // 만료된 알림 자동 정리
  const cleanupExpiredNotifications = useCallback(async () => {
    try {
      const now = new Date();
      const expiredQuery = query(
        collection(db, 'notifications'),
        where('autoExpire', '==', true),
        where('expiresAt', '<=', now)
      );
      const snapshot = await getDocs(expiredQuery);
      const updatePromises = snapshot.docs.map(doc => {
        const docRef = doc.ref;
        return updateDoc(docRef, {
          isArchived: true,
          updatedAt: serverTimestamp()
        });
      });
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error cleaning up expired notifications:', error);
    }
  }, []);
  // 알림 통계
  const getNotificationStats = useCallback(() => {
    const stats = {
      total: notifications.length,
      unread: unreadCount,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };
    notifications.forEach(notification => {
      // 타입별 통계
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      // 심각도별 통계
      stats.bySeverity[notification.severity] = (stats.bySeverity[notification.severity] || 0) + 1;
    });
    return stats;
  }, [notifications, unreadCount]);
  // 초기 데이터 로드
  useEffect(() => {
    fetchNotifications();
    // 만료된 알림 정리 (1시간마다)
    const cleanupInterval = setInterval(cleanupExpiredNotifications, 60 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, [fetchNotifications, cleanupExpiredNotifications]);
  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    subscribeToNotifications,
    createNotification,
    createBudgetAlert,
    createExpenseApprovalAlert,
    createPurchaseRequestAlert,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    cleanupExpiredNotifications,
    getNotificationStats
  };
}
