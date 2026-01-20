import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useBranches } from '@/hooks/use-branches';

import { useSettings } from '@/hooks/use-settings';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order_transfer' | 'order_complete' | 'delivery' | 'system';
  isRead: boolean;
  createdAt: Timestamp;
  userId?: string;
  branchId?: string;
  relatedId?: string; // 관련 주문 ID 또는 이관 ID
}

export function useRealtimeNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { branches } = useBranches();

  const { settings } = useSettings();

  // 알림 목록 실시간 구독
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const notificationsRef = collection(db, 'notifications');

    // 사용자별 알림 필터링
    let q = query(
      notificationsRef,
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    // 지점 사용자의 경우 지점별 알림도 포함
    if (user.franchise) {
      // 지점별 알림을 쿼리
      q = query(
        notificationsRef,
        where('branchId', '==', user.franchise),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationList: Notification[] = [];
        snapshot.forEach((doc) => {
          notificationList.push({
            id: doc.id,
            ...doc.data()
          } as Notification);
        });

        setNotifications(notificationList);
        setLoading(false);


      },
      (error) => {
        console.error('알림 구독 오류:', error);
        setError('알림을 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 알림 생성
  const createNotification = useCallback(async (notificationData: Omit<Notification, 'id' | 'createdAt'>) => {
    try {
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        ...notificationData,
        createdAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('알림 생성 오류:', error);
      return false;
    }
  }, []);

  // 주문 이관 알림 생성 (신청 시)
  const createOrderTransferNotification = useCallback(async (
    orderBranchName: string,
    processBranchName: string,
    orderNumber: string,
    transferId: string
  ) => {
    if (!settings?.orderTransferSettings?.autoNotification) {
      return false;
    }

    // 1. 수주지점 (받는 곳) 알림
    const processBranch = branches.find(b => b.name === processBranchName);
    const processMsg = `${orderBranchName}지점에서 주문이관 신청을 하였습니다`;

    const noti1 = createNotification({
      title: '주문 이관 신청',
      message: processMsg,
      type: 'order_transfer',
      isRead: false,
      relatedId: transferId,
      branchId: processBranch?.id || '',
      userId: ''
    });

    // 2. 발주지점 (보내는 곳) 알림 - 확인용
    const orderBranch = branches.find(b => b.name === orderBranchName);
    const orderMsg = `${processBranchName}지점으로 주문이관 신청을 했습니다.`;

    const noti2 = createNotification({
      title: '주문 이관 신청 완료',
      message: orderMsg,
      type: 'order_transfer',
      isRead: false,
      relatedId: transferId,
      branchId: orderBranch?.id || '',
      userId: ''
    });

    await Promise.all([noti1, noti2]);
    return true;
  }, [createNotification, settings?.orderTransferSettings, branches]);

  // 주문 이관 취소 알림 생성
  const createOrderTransferCancelNotification = useCallback(async (
    orderBranchName: string,
    processBranchName: string,
    orderNumber: string,
    transferId: string,
    cancelReason?: string
  ) => {
    if (!settings?.orderTransferSettings?.autoNotification) {
      return false;
    }

    const message = `${orderBranchName}지점에서 주문 이관을 취소했습니다.${cancelReason ? ` 사유: ${cancelReason}` : ''}`;

    // 수주지점의 사용자들에게 취소 알림을 보내기 위해 지점 ID를 사용
    const processBranch = branches.find(b => b.name === processBranchName);

    return await createNotification({
      title: '주문 이관 취소 알림',
      message,
      type: 'order_transfer',
      isRead: false,
      relatedId: transferId,
      branchId: processBranch?.id || '',
      userId: '' // 지점별 알림이므로 userId는 비워둠
    });
  }, [createNotification, settings?.orderTransferSettings, branches]);

  // 알림 읽음 처리
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        isRead: true
      });
      return true;
    } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
      return false;
    }
  }, []);

  // 모든 알림 읽음 처리
  const markAllAsRead = useCallback(async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead);
      const updatePromises = unreadNotifications.map(notification =>
        updateDoc(doc(db, 'notifications', notification.id), {
          isRead: true
        })
      );

      await Promise.all(updatePromises);
      return true;
    } catch (error) {
      console.error('모든 알림 읽음 처리 오류:', error);
      return false;
    }
  }, [notifications]);

  // 만료된 알림 정리 (30일 이상 된 알림)
  const cleanupExpiredNotifications = useCallback(async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const expiredNotifications = notifications.filter(
        notification => notification.createdAt.toDate() < thirtyDaysAgo
      );

      // 실제 삭제는 서버 사이드에서 처리하는 것이 좋습니다
      // 여기서는 클라이언트에서만 필터링

      return true;
    } catch (error) {
      console.error('만료된 알림 정리 오류:', error);
      return false;
    }
  }, [notifications]);

  // 읽지 않은 알림 개수
  const unreadCount = notifications.filter(n => !n.isRead).length;



  // 주문 이관 완료 알림 생성
  const createOrderTransferCompleteNotification = useCallback(async (
    processBranchName: string, // 이관 수행한 지점 (수주지점)
    orderBranchName: string,   // 알림 받을 지점 (발주지점)
    messageContent: string,    // 메시지 내용 (선택적)
    transferId: string
  ) => {
    if (settings?.orderTransferSettings?.autoNotification === false) {
      return false;
    }

    // 1. 발주지점 (신청했던 곳) 알림 - 배송 완료 통보
    const orderBranch = branches.find(b => b.name === orderBranchName);
    const orderMsg = `${processBranchName}지점으로 주문이관된 상품의 배송이 완료처리 되었습니다.`;

    const noti1 = createNotification({
      title: '이관 주문 완료',
      message: orderMsg,
      type: 'order_complete',
      isRead: false,
      relatedId: transferId,
      branchId: orderBranch?.id || '',
      userId: ''
    });

    // 2. 수주지점 (완료 처리한 곳) 알림 - 처리 확인
    const processBranch = branches.find(b => b.name === processBranchName);
    const processMsg = `이관된 주문의 배송이 완료되어 ${orderBranchName}지점으로 알림을 보냅니다.`;

    const noti2 = createNotification({
      title: '이관 주문 완료 처리됨',
      message: processMsg,
      type: 'order_complete',
      isRead: false,
      relatedId: transferId,
      branchId: processBranch?.id || '',
      userId: ''
    });

    await Promise.all([noti1, noti2]);
    return true;
  }, [createNotification, settings?.orderTransferSettings, branches]);

  // 주문 이관 수락 알림 생성 (발주/수주 지점 모두에게)
  const createOrderTransferAcceptedNotification = useCallback(async (
    processBranchName: string, // 수락한 지점 (수주지점)
    orderBranchName: string,   // 요청한 지점 (발주지점)
    transferId: string
  ) => {
    if (settings?.orderTransferSettings?.autoNotification === false) {
      return false;
    }

    // 1. 발주지점 (신청했던 곳) 알림
    const orderBranch = branches.find(b => b.name === orderBranchName);
    const orderMsg = `${processBranchName}지점에서 이관된 주문을 수락하였습니다`;

    const noti1 = createNotification({
      title: '이관 요청 수락됨',
      message: orderMsg,
      type: 'order_transfer',
      isRead: false,
      relatedId: transferId,
      branchId: orderBranch?.id || '',
      userId: ''
    });

    // 2. 수주지점 (수락한 곳) 알림
    const processBranch = branches.find(b => b.name === processBranchName);
    const processMsg = `${processBranchName}지점의 이관주문이 수락되었습니다. 상품을 제작하여 배송해주세요`;

    const noti2 = createNotification({
      title: '이관 주문 수락함',
      message: processMsg,
      type: 'order_transfer',
      isRead: false,
      relatedId: transferId,
      branchId: processBranch?.id || '',
      userId: ''
    });

    await Promise.all([noti1, noti2]);
    return true;
  }, [createNotification, settings?.orderTransferSettings, branches]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    createNotification,
    createOrderTransferNotification,
    createOrderTransferAcceptedNotification,
    createOrderTransferCompleteNotification,
    createOrderTransferCancelNotification,
    markAsRead,
    markAllAsRead,
    cleanupExpiredNotifications

  };
}
