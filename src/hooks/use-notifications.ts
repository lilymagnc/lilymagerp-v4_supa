"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface Notification {
  id: string;
  type: 'budget_alert' | 'expense_approval' | 'purchase_request' | 'material_request' | 'system';
  subType: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  userRole?: string;
  branchId?: string;
  departmentId?: string;
  relatedId?: string;
  relatedType?: string;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  autoExpire?: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const mapRowToNotification = (row: any): Notification => ({
    id: row.id,
    type: row.type,
    subType: row.sub_type,
    title: row.title,
    message: row.message,
    severity: row.severity,
    userId: row.user_id,
    userRole: row.user_role,
    branchId: row.branch_id,
    departmentId: row.department_id,
    relatedId: row.related_id,
    relatedType: row.related_type,
    actionUrl: row.action_url,
    isRead: row.is_read,
    readAt: row.read_at,
    isArchived: row.is_archived,
    autoExpire: row.auto_expire,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchNotifications = useCallback(async (userId?: string, limitCount = 50) => {
    try {
      setLoading(true);
      let query = supabase.from('notifications')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
        .limit(limitCount);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const notificationData = (data || []).map(mapRowToNotification);
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({ variant: 'destructive', title: '알림 조회 실패', description: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const subscribeToNotifications = useCallback((userId?: string) => {
    const channel = supabase.channel('notifications_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: userId ? `user_id=eq.${userId}` : undefined
      }, (payload) => {
        fetchNotifications(userId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  const createNotification = useCallback(async (data: Omit<Notification, 'id' | 'isRead' | 'isArchived' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = crypto.randomUUID();
      const payload = {
        id,
        type: data.type,
        sub_type: data.subType,
        title: data.title,
        message: data.message,
        severity: data.severity || 'medium',
        user_id: data.userId,
        user_role: data.userRole,
        branch_id: data.branchId,
        department_id: data.departmentId,
        related_id: data.relatedId,
        related_type: data.relatedType,
        action_url: data.actionUrl,
        is_read: false,
        is_archived: false,
        auto_expire: data.autoExpire || false,
        expires_at: data.expiresAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('notifications').insert([payload]);
      if (error) throw error;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }, []);

  const createBudgetAlert = useCallback(async (budgetId: string, budgetName: string, usage: number, severity: Notification['severity'] = 'medium') => {
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
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  }, [createNotification]);

  const createExpenseApprovalAlert = useCallback(async (expenseId: string, expenseTitle: string, amount: number, approverId: string) => {
    await createNotification({
      type: 'expense_approval',
      subType: 'approval_required',
      title: '비용 승인 요청',
      message: `${expenseTitle} (${new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)})의 승인이 필요합니다.`,
      severity: amount >= 1000000 ? 'high' : 'medium',
      userId: approverId,
      relatedId: expenseId,
      relatedType: 'expense',
      actionUrl: `/dashboard/expenses?tab=approval`,
      autoExpire: true,
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    });
  }, [createNotification]);

  const createPurchaseRequestAlert = useCallback(async (requestId: string, requestTitle: string, urgency: 'normal' | 'urgent', managerId?: string) => {
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
      expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    });
  }, [createNotification]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase.from('notifications').update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', notificationId);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const markAllAsRead = useCallback(async (userId?: string) => {
    try {
      let query = supabase.from('notifications').update({
        is_read: true,
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('is_read', false);

      if (userId) query = query.eq('user_id', userId);

      const { error } = await query;
      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
      toast({ title: '알림 읽음 처리 완료', description: '모든 알림을 읽음으로 처리했습니다.' });
    } catch (error) {
      console.error(error);
    }
  }, [toast]);

  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase.from('notifications').update({
        is_archived: true,
        updated_at: new Date().toISOString()
      }).eq('id', notificationId);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const cleanupExpiredNotifications = useCallback(async () => {
    try {
      const { error } = await supabase.from('notifications').update({
        is_archived: true,
        updated_at: new Date().toISOString()
      }).eq('auto_expire', true).lte('expires_at', new Date().toISOString());

      if (error) throw error;
    } catch (error) {
      console.error(error);
    }
  }, []);

  const getNotificationStats = useCallback(() => {
    const stats = {
      total: notifications.length,
      unread: unreadCount,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>
    };
    notifications.forEach(notification => {
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
      stats.bySeverity[notification.severity] = (stats.bySeverity[notification.severity] || 0) + 1;
    });
    return stats;
  }, [notifications, unreadCount]);

  useEffect(() => {
    fetchNotifications();
    const cleanupInterval = setInterval(cleanupExpiredNotifications, 60 * 60 * 1000);
    return () => clearInterval(cleanupInterval);
  }, [fetchNotifications, cleanupExpiredNotifications]);

  return {
    notifications, unreadCount, loading, fetchNotifications, subscribeToNotifications, createNotification, createBudgetAlert, createExpenseApprovalAlert, createPurchaseRequestAlert, markAsRead, markAllAsRead, archiveNotification, cleanupExpiredNotifications, getNotificationStats
  };
}
