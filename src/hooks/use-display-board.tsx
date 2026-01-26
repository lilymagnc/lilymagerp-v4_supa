import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
  createdAt: Date;
  expiresAt: Date;
}

export function useDisplayBoard() {
  const [displayItems, setDisplayItems] = useState<DisplayBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { settings } = useSettings();

  const fetchDisplayItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('display_board')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items: DisplayBoardItem[] = (data || []).map((row) => ({
        id: row.id,
        transferId: row.transfer_id,
        isActive: row.is_active,
        createdAt: new Date(row.created_at),
        expiresAt: row.expires_at ? new Date(row.expires_at) : new Date(),
        // Map extra_data fields
        orderBranchName: row.extra_data?.orderBranchName || '',
        processBranchName: row.extra_data?.processBranchName || '',
        orderAmount: row.extra_data?.orderAmount || 0,
        transferReason: row.extra_data?.transferReason || '',
        status: row.extra_data?.status || 'pending',
      }));

      setDisplayItems(items);
      setError(null);
    } catch (err: any) {
      console.error('전광판 데이터 로드 오류:', err);
      setError('전광판을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  // 전광판 아이템 실시간 구독
  useEffect(() => {
    if (!settings?.orderTransferSettings?.displayBoardEnabled) {
      setDisplayItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchDisplayItems();

    const channel = supabase
      .channel('display_board_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'display_board',
          filter: 'is_active=eq.true', // Active items only
        },
        () => {
          fetchDisplayItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [settings?.orderTransferSettings?.displayBoardEnabled, fetchDisplayItems]);

  // 전광판 아이템 생성
  const createDisplayItem = useCallback(async (itemData: Omit<DisplayBoardItem, 'id' | 'createdAt' | 'expiresAt'>) => {
    try {
      // 표시 시간 설정 (기본 30분)
      const displayDuration = settings?.orderTransferSettings?.displayBoardDuration || 30;
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + displayDuration);

      const { error } = await supabase.from('display_board').insert({
        transfer_id: itemData.transferId,
        is_active: itemData.isActive,
        expires_at: expiresAt.toISOString(),
        extra_data: {
          orderBranchName: itemData.orderBranchName,
          processBranchName: itemData.processBranchName,
          orderAmount: itemData.orderAmount,
          transferReason: itemData.transferReason,
          status: itemData.status,
        },
        // We can create a title/content if generic usage is needed, but irrelevant for now
        title: '주문 이관 알림',
        content: itemData.transferReason,
      });

      if (error) throw error;
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
      id: '', // Placeholder, ignored by omit
      isActive: true,
      // createdAt and expiresAt will be handled in createDisplayItem
      createdAt: new Date(), // Placeholder
      expiresAt: new Date()  // Placeholder
    } as any); // Cast as any to bypass Omit check for helper function if needed, or structured better

    return result;
  }, [createDisplayItem, settings?.orderTransferSettings?.displayBoardEnabled]);

  // 전광판 아이템 비활성화
  const deactivateDisplayItem = useCallback(async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('display_board')
        .update({ is_active: false, deactivated_at: new Date().toISOString() })
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('전광판 아이템 비활성화 오류:', error);
      return false;
    }
  }, []);

  // 만료된 전광판 아이템 정리
  const cleanupExpiredDisplayItems = useCallback(async () => {
    try {
      // In Supabase/SQL, we can do this with a query, but here we iterate current items or rely on backend.
      // Better to query items that are expired but active.
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('display_board')
        .update({ is_active: false })
        .eq('is_active', true)
        .lt('expires_at', now);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('만료된 전광판 아이템 정리 오류:', error);
      return false;
    }
  }, []);

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
