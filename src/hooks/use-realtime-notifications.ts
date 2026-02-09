"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useBranches } from '@/hooks/use-branches';
import { useSettings } from '@/hooks/use-settings';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order_transfer' | 'order_complete' | 'delivery' | 'system';
  isRead: boolean;
  createdAt: string;
  userId?: string;
  branchId?: string;
  relatedId?: string;
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { branches } = useBranches();
  const { settings } = useSettings();

  const mapRowToNotification = useCallback((row: any): Notification => ({
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
    userId: row.user_id,
    branchId: row.branch_id,
    relatedId: row.related_id
  }), []);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase.from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (user.branchId) {
        query = query.or(`user_id.eq.${user.id},branch_id.eq.${user.branchId}`);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotifications((data || []).map(mapRowToNotification));
    } catch (err) {
      console.error('알림 구독 오류:', err);
      setError('알림을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user, mapRowToNotification]);

  // Debounce ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    const channel = supabase.channel(`user_notifications_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications'
      }, () => {
        // Debounce: Clear previous timer if exists
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }

        // Set new timer
        debounceTimer.current = setTimeout(() => {
          fetchNotifications();
        }, 1000);
      })
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      // 채널 클린업: 
      // 즉시 제거 시 '연결 전 종료(WebSocket is closed before the connection is established)' 경고가 
      // 발생할 수 있으므로, 아주 짧은 지연(0ms)을 주어 현재 이벤트 루프를 넘깁니다.
      if (channel) {
        setTimeout(() => {
          try {
            supabase.removeChannel(channel).catch(() => { });
          } catch (e) { }
        }, 0);
      }
    };
  }, [user, fetchNotifications]);

  const createNotification = useCallback(async (notificationData: any) => {
    try {
      const payload = {
        id: crypto.randomUUID(),
        title: notificationData.title,
        message: notificationData.message,
        type: notificationData.type,
        is_read: false,
        user_id: notificationData.userId,
        branch_id: notificationData.branchId,
        related_id: notificationData.relatedId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('notifications').insert([payload]);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('알림 생성 오류:', error);
      return false;
    }
  }, []);

  const createOrderTransferNotification = useCallback(async (orderBranchName: string, processBranchName: string, orderNumber: string, transferId: string) => {
    if (!settings?.orderTransferSettings?.autoNotification) return false;
    const processBranch = branches.find(b => b.name === processBranchName);
    const orderBranch = branches.find(b => b.name === orderBranchName);

    const n1 = createNotification({
      title: '주문 이관 신청',
      message: `${orderBranchName}지점에서 주문이관 신청을 하였습니다`,
      type: 'order_transfer',
      relatedId: transferId,
      branchId: processBranch?.id || ''
    });
    const n2 = createNotification({
      title: '주문 이관 신청 완료',
      message: `${processBranchName}지점으로 주문이관 신청을 했습니다.`,
      type: 'order_transfer',
      relatedId: transferId,
      branchId: orderBranch?.id || ''
    });
    await Promise.all([n1, n2]);
    return true;
  }, [createNotification, settings?.orderTransferSettings, branches]);

  const createOrderTransferCancelNotification = useCallback(async (orderBranchName: string, processBranchName: string, orderNumber: string, transferId: string, cancelReason?: string) => {
    if (!settings?.orderTransferSettings?.autoNotification) return false;
    const processBranch = branches.find(b => b.name === processBranchName);
    return await createNotification({
      title: '주문 이관 취소 알림',
      message: `${orderBranchName}지점에서 주문 이관을 취소했습니다.${cancelReason ? ` 사유: ${cancelReason}` : ''}`,
      type: 'order_transfer',
      relatedId: transferId,
      branchId: processBranch?.id || ''
    });
  }, [createNotification, settings?.orderTransferSettings, branches]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('is_read', false);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
      return false;
    }
  }, []);

  const cleanupExpiredNotifications = useCallback(async () => {
    // This could be implemented with a delete query based on date
    return true;
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const createOrderTransferCompleteNotification = useCallback(async (processBranchName: string, orderBranchName: string, messageContent: string, transferId: string) => {
    if (settings?.orderTransferSettings?.autoNotification === false) return false;
    const orderBranch = branches.find(b => b.name === orderBranchName);
    const processBranch = branches.find(b => b.name === processBranchName);
    const n1 = createNotification({
      title: '이관 주문 완료',
      message: `${processBranchName}지점으로 주문이관된 상품의 배송이 완료처리 되었습니다.`,
      type: 'order_complete',
      relatedId: transferId,
      branchId: orderBranch?.id || ''
    });
    const n2 = createNotification({
      title: '이관 주문 완료 처리됨',
      message: `이관된 주문의 배송이 완료되어 ${orderBranchName}지점으로 알림을 보냅니다.`,
      type: 'order_complete',
      relatedId: transferId,
      branchId: processBranch?.id || ''
    });
    await Promise.all([n1, n2]);
    return true;
  }, [createNotification, settings?.orderTransferSettings, branches]);

  const createOrderTransferAcceptedNotification = useCallback(async (processBranchName: string, orderBranchName: string, transferId: string) => {
    if (settings?.orderTransferSettings?.autoNotification === false) return false;
    const orderBranch = branches.find(b => b.name === orderBranchName);
    const processBranch = branches.find(b => b.name === processBranchName);
    const n1 = createNotification({
      title: '이관 요청 수락됨',
      message: `${processBranchName}지점에서 이관된 주문을 수락하였습니다`,
      type: 'order_transfer',
      relatedId: transferId,
      branchId: orderBranch?.id || ''
    });
    const n2 = createNotification({
      title: '이관 주문 수락함',
      message: `${processBranchName}지점의 이관주문이 수락되었습니다. 상품을 제작하여 배송해주세요`,
      type: 'order_transfer',
      relatedId: transferId,
      branchId: processBranch?.id || ''
    });
    await Promise.all([n1, n2]);
    return true;
  }, [createNotification, settings?.orderTransferSettings, branches]);

  return {
    notifications, loading, error, unreadCount, createNotification, createOrderTransferNotification, createOrderTransferAcceptedNotification, createOrderTransferCompleteNotification, createOrderTransferCancelNotification, markAsRead, markAllAsRead, cleanupExpiredNotifications
  };
}
