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
import { useSettings } from '@/hooks/use-settings';

export interface DisplayBoardItem {
  id: string;
  transferId: string;
  orderBranchName: string;
  processBranchName: string;
  orderAmount: number;
  transferReason: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  isActive: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

export function useDisplayBoard() {
  const [displayItems, setDisplayItems] = useState<DisplayBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { settings } = useSettings();

  // 전광판 아이템 실시간 구독
  useEffect(() => {
    if (!settings?.orderTransferSettings?.displayBoardEnabled) {
      setDisplayItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const displayBoardRef = collection(db, 'display_board');
    const q = query(
      displayBoardRef,
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: DisplayBoardItem[] = [];
        snapshot.forEach((doc) => {
          items.push({
            id: doc.id,
            ...doc.data()
          } as DisplayBoardItem);
        });

        setDisplayItems(items);
        setLoading(false);
      },
      (error) => {
        console.error('전광판 구독 오류:', error);
        setError('전광판을 불러오는 중 오류가 발생했습니다.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [settings?.orderTransferSettings?.displayBoardEnabled]);

  // 전광판 아이템 생성
  const createDisplayItem = useCallback(async (itemData: Omit<DisplayBoardItem, 'id' | 'createdAt' | 'expiresAt'>) => {
    try {
      const displayBoardRef = collection(db, 'display_board');

      // 표시 시간 설정 (기본 30분)
      const displayDuration = settings?.orderTransferSettings?.displayBoardDuration || 30;
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + displayDuration);

      await addDoc(displayBoardRef, {
        ...itemData,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      });
      return true;
    } catch (error) {
      console.error('전광판 아이템 생성 오류:', error);
      return false;
    }
  }, [settings?.orderTransferSettings?.displayBoardDuration]);

  // 주문 이관 전광판 아이템 생성
  const createOrderTransferDisplay = useCallback(async (
    transferId: string,
    orderBranchName: string,
    processBranchName: string,
    orderAmount: number,
    transferReason: string,
    status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
  ) => {


    if (!settings?.orderTransferSettings?.displayBoardEnabled) {

      return false;
    }

    const result = await createDisplayItem({
      transferId,
      orderBranchName,
      processBranchName,
      orderAmount,
      transferReason,
      status,
      isActive: true
    });


    return result;
  }, [createDisplayItem, settings?.orderTransferSettings?.displayBoardEnabled]);

  // 전광판 아이템 비활성화
  const deactivateDisplayItem = useCallback(async (itemId: string) => {
    try {
      const itemRef = doc(db, 'display_board', itemId);
      await updateDoc(itemRef, {
        isActive: false
      });
      return true;
    } catch (error) {
      console.error('전광판 아이템 비활성화 오류:', error);
      return false;
    }
  }, []);

  // 만료된 전광판 아이템 정리
  const cleanupExpiredDisplayItems = useCallback(async () => {
    try {
      const now = new Date();
      const expiredItems = displayItems.filter(
        item => item.expiresAt.toDate() < now
      );

      const deactivatePromises = expiredItems.map(item =>
        updateDoc(doc(db, 'display_board', item.id), {
          isActive: false
        })
      );

      await Promise.all(deactivatePromises);

      return true;
    } catch (error) {
      console.error('만료된 전광판 아이템 정리 오류:', error);
      return false;
    }
  }, [displayItems]);

  // 주기적으로 만료된 아이템 정리 (5분마다)
  useEffect(() => {
    if (!settings?.orderTransferSettings?.displayBoardEnabled) {
      return;
    }

    const interval = setInterval(cleanupExpiredDisplayItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cleanupExpiredDisplayItems, settings?.orderTransferSettings?.displayBoardEnabled]);

  return {
    displayItems,
    loading,
    error,
    createDisplayItem,
    createOrderTransferDisplay,
    deactivateDisplayItem,
    cleanupExpiredDisplayItems
  };
}
