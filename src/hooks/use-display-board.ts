"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useBranches } from '@/hooks/use-branches';
import { useSettings } from '@/hooks/use-settings';
import { DisplayBoardItem } from '@/types/order-transfer';

export function useDisplayBoard() {
  const [displayItems, setDisplayItems] = useState<DisplayBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { branches } = useBranches();
  const { settings } = useSettings();

  const mapRowToItem = useCallback((row: any): DisplayBoardItem => ({
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    branchId: row.branch_id,
    branchName: row.branch_name,
    priority: row.priority,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    transferId: row.transfer_id,
    orderId: row.order_id,
    deactivatedAt: row.deactivated_at,
    ...(row.extra_data || {})
  }), []);

  const fetchDisplayItems = useCallback(async () => {
    if (!user?.franchise) return;
    try {
      if (displayItems.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const userBranch = branches.find(b => b.name === user.franchise);
      if (!userBranch) return;

      const { data, error } = await supabase.from('display_board')
        .select('*')
        .eq('branch_id', userBranch.id)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDisplayItems((data || []).map(mapRowToItem));
    } catch (err) {
      console.error('전광판 목록 조회 오류:', err);
      setError('전광판 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.franchise, branches, mapRowToItem]);

  useEffect(() => {
    if (!user?.franchise) return;
    const userBranch = branches.find(b => b.name === user.franchise);
    if (!userBranch) return;

    fetchDisplayItems();

    const channel = supabase.channel(`display_board_${userBranch.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'display_board',
        filter: `branch_id=eq.${userBranch.id}`
      }, () => {
        fetchDisplayItems();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(err => {
        // Ignore errors during cleanup
      });
    };
  }, [user?.franchise, branches, fetchDisplayItems]);

  const createDisplayItem = useCallback(async (
    type: 'order_transfer' | 'new_order' | 'delivery_complete' | 'pickup_ready',
    title: string,
    content: string,
    branchId: string,
    branchName: string,
    priority: 'high' | 'medium' | 'low' = 'medium',
    transferId?: string,
    orderId?: string,
    orderBranchName?: string,
    processBranchName?: string,
    orderAmount?: number,
    transferReason?: string,
    status?: string,
    orderInfo?: any
  ) => {
    try {
      const displayDuration = settings.orderTransferSettings?.displayBoardDuration || 30;
      const expiresAt = new Date(Date.now() + displayDuration * 60 * 1000);

      const extraData: any = {};
      if (type === 'order_transfer' && transferId) {
        extraData.orderBranchName = orderBranchName;
        extraData.processBranchName = processBranchName;
        extraData.orderAmount = orderAmount;
        extraData.transferReason = transferReason;
        extraData.status = status;
        if (orderInfo) {
          extraData.orderNumber = orderInfo.orderNumber;
          extraData.deliveryDate = orderInfo.deliveryDate;
          extraData.deliveryTime = orderInfo.deliveryTime;
          extraData.recipientName = orderInfo.recipientName;
          extraData.recipientContact = orderInfo.recipientContact;
        }
      }

      const payload = {
        id: crypto.randomUUID(),
        type,
        title,
        content,
        branch_id: branchId,
        branch_name: branchName,
        priority,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
        transfer_id: transferId,
        order_id: orderId,
        extra_data: extraData
      };

      const { error } = await supabase.from('display_board').insert([payload]);
      if (error) throw error;
    } catch (err) {
      console.error('전광판 아이템 생성 오류:', err);
      throw err;
    }
  }, [settings.orderTransferSettings?.displayBoardDuration]);

  const createOrderTransferDisplay = useCallback(async (
    transferId: string, orderBranchName: string, processBranchName: string, orderAmount: number, transferReason: string, status: any, orderInfo?: any
  ) => {
    const userBranch = branches.find(b => b.name === processBranchName);
    if (!userBranch) return;

    let content = `주문이관배송\n${orderBranchName} → ${processBranchName}\n`;
    if (orderInfo?.orderNumber) content += `주문번호: ${orderInfo.orderNumber}\n`;
    if (orderInfo?.deliveryDate && orderInfo?.deliveryTime) content += `배송일시: ${orderInfo.deliveryDate} ${orderInfo.deliveryTime}\n`;
    if (orderInfo?.recipientName) {
      content += `수령인: ${orderInfo.recipientName}`;
      if (orderInfo?.recipientContact) content += ` (${orderInfo.recipientContact})`;
      content += '\n';
    }
    content += `금액: ${orderAmount.toLocaleString()}원\n사유: ${transferReason}`;

    const title = `주문이관배송 - ${status === 'pending' ? '대기중' : status === 'accepted' ? '수락됨' : status === 'cancelled' ? '취소됨' : status}`;

    await createDisplayItem('order_transfer', title, content, userBranch.id, processBranchName, 'high', transferId, undefined, orderBranchName, processBranchName, orderAmount, transferReason, status, orderInfo);
  }, [createDisplayItem, branches]);

  const createNewOrderDisplay = useCallback(async (branchId: string, branchName: string, orderId: string, orderNumber: string, customerName: string) => {
    await createDisplayItem('new_order', '새 주문 알림', `주문번호: ${orderNumber}\n고객명: ${customerName}`, branchId, branchName, 'medium', undefined, orderId);
  }, [createDisplayItem]);

  const createDeliveryCompleteDisplay = useCallback(async (branchId: string, branchName: string, orderId: string, orderNumber: string, customerName: string) => {
    await createDisplayItem('delivery_complete', '배송 완료 알림', `주문번호: ${orderNumber}\n고객명: ${customerName}`, branchId, branchName, 'low', undefined, orderId);
  }, [createDisplayItem]);

  const createPickupReadyDisplay = useCallback(async (branchId: string, branchName: string, orderId: string, orderNumber: string, customerName: string) => {
    await createDisplayItem('pickup_ready', '픽업 준비 완료', `주문번호: ${orderNumber}\n고객명: ${customerName}`, branchId, branchName, 'medium', undefined, orderId);
  }, [createDisplayItem]);

  const deactivateDisplayItem = useCallback(async (itemId: string) => {
    try {
      const { error } = await supabase.from('display_board').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('id', itemId);
      if (error) throw error;
    } catch (err) {
      console.error('전광판 아이템 비활성화 오류:', err);
      throw err;
    }
  }, []);

  const cleanupExpiredDisplayItems = useCallback(async () => {
    try {
      const { error } = await supabase.from('display_board').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('is_active', true).lte('expires_at', new Date().toISOString());
      if (error) throw error;
    } catch (err) {
      console.error('만료된 전광판 정리 오류:', err);
    }
  }, []);

  const removeDisplayItem = useCallback(async (itemId: string) => {
    await deactivateDisplayItem(itemId);
  }, [deactivateDisplayItem]);

  const removeAllDisplayItems = useCallback(async () => {
    if (!user?.franchise) return;
    try {
      const userBranch = branches.find(b => b.name === user.franchise);
      if (!userBranch) return;
      const { error } = await supabase.from('display_board').update({ is_active: false, deactivated_at: new Date().toISOString() }).eq('branch_id', userBranch.id).eq('is_active', true);
      if (error) throw error;
    } catch (err) {
      console.error('모든 전광판 아이템 제거 오류:', err);
      throw err;
    }
  }, [user?.franchise, branches]);

  useEffect(() => {
    const interval = setInterval(cleanupExpiredDisplayItems, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [cleanupExpiredDisplayItems]);

  return {
    displayItems, loading, error, createDisplayItem, createOrderTransferDisplay, createNewOrderDisplay, createDeliveryCompleteDisplay, createPickupReadyDisplay, deactivateDisplayItem, removeDisplayItem, removeAllDisplayItems, cleanupExpiredDisplayItems, isRefreshing
  };
}
