"use client";
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { updateDailyStats } from '@/lib/stats-utils';
import { useAuth } from '@/hooks/use-auth';
import { useBranches } from '@/hooks/use-branches';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';
import { useDisplayBoard } from '@/hooks/use-display-board';
import {
  OrderTransfer,
  OrderTransferForm,
  TransferStatusUpdate,
  TransferFilter,
  TransferStats,
  TransferPermissions
} from '@/types/order-transfer';

export function useOrderTransfers() {
  const [transfers, setTransfers] = useState<OrderTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastIndexRef = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  const { user } = useAuth();
  const { branches } = useBranches();
  const { toast } = useToast();
  const { createOrderTransferNotification, createOrderTransferCancelNotification, createOrderTransferCompleteNotification, createOrderTransferAcceptedNotification } = useRealtimeNotifications();
  const { createOrderTransferDisplay } = useDisplayBoard();

  const mapRowToTransfer = (row: any): OrderTransfer => ({
    id: row.id,
    originalOrderId: row.original_order_id,
    orderBranchId: row.order_branch_id,
    orderBranchName: row.order_branch_name,
    processBranchId: row.process_branch_id,
    processBranchName: row.process_branch_name,
    transferDate: row.transfer_date,
    transferReason: row.transfer_reason,
    transferBy: row.transfer_by,
    transferByUser: row.transfer_by_user,
    status: row.status,
    amountSplit: row.amount_split,
    originalOrderAmount: row.original_order_amount,
    notes: row.notes,
    acceptedAt: row.accepted_at,
    acceptedBy: row.accepted_by,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    cancelledAt: row.cancelled_at,
    cancelledBy: row.cancelled_by,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const getTransferPermissions = useCallback((): TransferPermissions => {
    if (!user) {
      return {
        canCreateTransfer: false, canAcceptTransfer: false, canRejectTransfer: false,
        canCompleteTransfer: false, canViewAllTransfers: false, canManageSettings: false
      };
    }
    const isAdmin = user.role === '본사 관리자';
    const canManageTransfers = isAdmin || user.role === '가맹점 관리자' || user.role === '직원';
    return {
      canCreateTransfer: canManageTransfers,
      canAcceptTransfer: canManageTransfers,
      canRejectTransfer: canManageTransfers,
      canCompleteTransfer: canManageTransfers,
      canViewAllTransfers: isAdmin,
      canManageSettings: isAdmin
    };
  }, [user]);

  const fetchTransfers = useCallback(async (loadMore: boolean = false, filter?: TransferFilter, pageSize: number = 20) => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      let query = supabase.from('order_transfers').select('*');

      if (filter?.status) query = query.eq('status', filter.status);
      if (filter?.startDate) query = query.gte('transfer_date', filter.startDate.toISOString());
      if (filter?.endDate) query = query.lte('transfer_date', filter.endDate.toISOString());

      const rangeStart = loadMore ? lastIndexRef.current : 0;
      const { data, error } = await query
        .order('transfer_date', { ascending: false })
        .range(rangeStart, rangeStart + pageSize - 1);

      if (error) throw error;

      const transfersData = (data || []).map(mapRowToTransfer);
      let filteredData = transfersData;

      const permissions = getTransferPermissions();
      if (!permissions.canViewAllTransfers && user?.franchise) {
        filteredData = transfersData.filter(t => t.orderBranchName === user.franchise || t.processBranchName === user.franchise);
      }

      setTransfers(prev => loadMore ? [...prev, ...filteredData] : filteredData);
      lastIndexRef.current = rangeStart + transfersData.length;
      setHasMore(transfersData.length >= pageSize);

    } catch (err) {
      console.error('이관 목록 조회 오류:', err);
      setError('이관 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, getTransferPermissions]);

  const createTransfer = useCallback(async (orderId: string, transferForm: OrderTransferForm) => {
    try {
      setError(null);
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      const orderBranch = branches.find(b => b.id === order.branch_id);
      const processBranch = branches.find(b => b.id === transferForm.processBranchId);
      if (!orderBranch || !processBranch) throw new Error('지점 정보를 찾을 수 없습니다.');

      const transferId = crypto.randomUUID();
      const transferPayload = {
        id: transferId,
        original_order_id: orderId,
        order_branch_id: order.branch_id,
        order_branch_name: orderBranch.name,
        process_branch_id: transferForm.processBranchId,
        process_branch_name: processBranch.name,
        transfer_date: new Date().toISOString(),
        transfer_reason: transferForm.transferReason,
        transfer_by: user?.uid || '',
        transfer_by_user: user?.email || '',
        status: 'pending',
        amount_split: transferForm.amountSplit,
        original_order_amount: order.summary?.total || 0,
        notes: transferForm.notes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: tError } = await supabase.from('order_transfers').insert([transferPayload]);
      if (tError) throw tError;

      await supabase.from('orders').update({
        transfer_info: {
          isTransferred: true,
          transferId,
          originalBranchId: order.branch_id,
          originalBranchName: orderBranch.name,
          processBranchId: transferForm.processBranchId,
          processBranchName: processBranch.name,
          status: 'pending',
          amountSplit: transferForm.amountSplit,
          transferredAt: new Date().toISOString()
        }
      }).eq('id', orderId);

      await createOrderTransferNotification(orderBranch.name, processBranch.name, order.order_number, transferId);

      await createOrderTransferDisplay(transferId, orderBranch.name, processBranch.name, order.summary.total, transferForm.transferReason, 'pending', {
        orderNumber: order.order_number,
        deliveryDate: order.delivery_info?.date || '',
        deliveryTime: order.delivery_info?.time || '',
        recipientName: order.delivery_info?.recipientName || '',
        recipientContact: order.delivery_info?.recipientContact || ''
      });

      toast({ title: '이관 요청 완료', description: `${processBranch.name}지점으로 이관 전송됨` });
      await fetchTransfers(false);
      return transferId;
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '오류', description: '이관 요청 생성 중 오류' });
      throw err;
    }
  }, [user, branches, fetchTransfers, toast, createOrderTransferNotification, createOrderTransferDisplay]);

  const updateTransferStatus = useCallback(async (transferId: string, statusUpdate: TransferStatusUpdate) => {
    try {
      const { data: transfer } = await supabase.from('order_transfers').select('*').eq('id', transferId).single();
      if (!transfer) throw new Error('이관 정보를 찾을 수 없습니다.');

      const updatePayload: any = { status: statusUpdate.status, updated_at: new Date().toISOString() };
      if (statusUpdate.status === 'accepted') { updatePayload.accepted_at = new Date().toISOString(); updatePayload.accepted_by = user?.uid; }
      else if (statusUpdate.status === 'rejected') { updatePayload.rejected_at = new Date().toISOString(); updatePayload.rejected_by = user?.uid; }
      else if (statusUpdate.status === 'completed') { updatePayload.completed_at = new Date().toISOString(); updatePayload.completed_by = user?.uid; }
      else if (statusUpdate.status === 'cancelled') { updatePayload.cancelled_at = new Date().toISOString(); updatePayload.cancelled_by = user?.uid; }

      if (statusUpdate.notes) updatePayload.notes = statusUpdate.notes;

      const { error: uError } = await supabase.from('order_transfers').update(updatePayload).eq('id', transferId);
      if (uError) throw uError;

      if (statusUpdate.status === 'rejected') {
        await supabase.from('orders').update({ 'transfer_info->>status': 'rejected' }).eq('id', transfer.original_order_id);
      } else if (statusUpdate.status === 'completed') {
        await supabase.from('orders').update({ status: 'completed', 'transfer_info->>status': 'completed' }).eq('id', transfer.original_order_id);
        await createOrderTransferCompleteNotification(transfer.process_branch_name, transfer.order_branch_name, "이관 완료됨", transferId);
      } else if (statusUpdate.status === 'accepted') {
        const { data: order } = await supabase.from('orders').select('*').eq('id', transfer.original_order_id).single();
        if (order) {
          await supabase.from('orders').update({ 'transfer_info->>status': 'accepted' }).eq('id', order.id);
          const total = transfer.original_order_amount;
          const orderBranchShare = Math.round(total * ((transfer.amount_split?.orderBranch || 100) / 100));
          const processBranchShare = total - orderBranchShare;

          await updateDailyStats(order.order_date, transfer.order_branch_name, { revenueDelta: -(total - orderBranchShare), orderCountDelta: 0, settledAmountDelta: 0 });

          if (order.payment?.status === 'paid' || order.payment?.status === 'completed') {
            const now = new Date();
            await updateDailyStats(now, transfer.order_branch_name, { revenueDelta: 0, orderCountDelta: 0, settledAmountDelta: -(total - orderBranchShare) });
            await updateDailyStats(now, transfer.process_branch_name, { revenueDelta: processBranchShare, orderCountDelta: 0, settledAmountDelta: processBranchShare });
          } else {
            await updateDailyStats(order.order_date, transfer.process_branch_name, { revenueDelta: processBranchShare, orderCountDelta: 0, settledAmountDelta: 0 });
          }

          await createOrderTransferDisplay(transferId, transfer.order_branch_name, transfer.process_branch_name, total, transfer.transfer_reason, 'accepted', {
            orderNumber: order.order_number,
            deliveryDate: order.delivery_info?.date || '',
            deliveryTime: order.delivery_info?.time || '',
            recipientName: order.delivery_info?.recipientName || '',
            recipientContact: order.delivery_info?.recipientContact || ''
          });
          await createOrderTransferAcceptedNotification(transfer.process_branch_name, transfer.order_branch_name, transferId);
        }
      }

      toast({ title: '상태 업데이트 완료', description: `${statusUpdate.status} 처리되었습니다.` });
      await fetchTransfers(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '오류', description: '상태 업데이트 중 오류' });
      throw err;
    }
  }, [user, fetchTransfers, toast, createOrderTransferCompleteNotification, createOrderTransferDisplay, createOrderTransferAcceptedNotification]);

  const cancelTransfer = useCallback(async (transferId: string, cancelReason?: string) => {
    try {
      const { data: transfer } = await supabase.from('order_transfers').select('*').eq('id', transferId).single();
      if (!transfer || transfer.status !== 'pending') throw new Error('취소 불가능한 상태입니다.');

      await supabase.from('order_transfers').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.uid,
        cancel_reason: cancelReason,
        updated_at: new Date().toISOString()
      }).eq('id', transferId);

      await supabase.from('orders').update({ transfer_info: null }).eq('id', transfer.original_order_id);
      await createOrderTransferCancelNotification(transfer.order_branch_name, transfer.process_branch_name, transfer.original_order_id, transferId, cancelReason);

      toast({ title: '이관 취소 완료', description: '성공적으로 취소되었습니다.' });
      await fetchTransfers(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '오류', description: '이관 취소 중 오류' });
      throw err;
    }
  }, [user, fetchTransfers, toast, createOrderTransferCancelNotification]);

  const deleteTransfer = useCallback(async (transferId: string) => {
    try {
      const { data: transfer } = await supabase.from('order_transfers').select('*').eq('id', transferId).single();
      if (!transfer) throw new Error('이관 기록을 찾을 수 없습니다.');

      await supabase.from('orders').update({ transfer_info: null }).eq('id', transfer.original_order_id);
      await supabase.from('order_transfers').delete().eq('id', transferId);

      toast({ title: "기록 삭제 완료", description: "성공했습니다." });
      await fetchTransfers(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '오류', description: '삭제 실패' });
    }
  }, [fetchTransfers, toast]);

  const cleanupOrphanTransfers = useCallback(async () => {
    try {
      const { data: transfers } = await supabase.from('order_transfers').select('id, original_order_id');
      if (!transfers) return;

      let deletedCount = 0;
      for (const t of transfers) {
        const { data: order } = await supabase.from('orders').select('id').eq('id', t.original_order_id).maybeSingle();
        if (!order) {
          await supabase.from('order_transfers').delete().eq('id', t.id);
          deletedCount++;
        }
      }
      toast({ title: "정리 완료", description: `${deletedCount}개 기록 삭제됨` });
      await fetchTransfers(false);
    } catch (err) { console.error(err); }
  }, [fetchTransfers, toast]);
  const getTransferStats = useCallback(async (): Promise<TransferStats> => {
    try {
      const { data } = await supabase.from('order_transfers').select('*');
      const transfersData = (data || []).map(mapRowToTransfer);
      const userBranch = user?.franchise;
      const filtered = (!getTransferPermissions().canViewAllTransfers && userBranch)
        ? transfersData.filter(t => t.orderBranchName === userBranch || t.processBranchName === userBranch)
        : transfersData;

      return {
        totalTransfers: filtered.length,
        pendingTransfers: filtered.filter(t => t.status === 'pending').length,
        acceptedTransfers: filtered.filter(t => t.status === 'accepted').length,
        rejectedTransfers: filtered.filter(t => t.status === 'rejected').length,
        completedTransfers: filtered.filter(t => t.status === 'completed').length,
        cancelledTransfers: filtered.filter(t => t.status === 'cancelled').length,
        totalAmount: filtered.reduce((sum, t) => sum + t.originalOrderAmount, 0),
        orderBranchAmount: userBranch ? filtered.filter(t => t.orderBranchName === userBranch).reduce((sum, t) => sum + Math.round(t.originalOrderAmount * ((t.amountSplit?.orderBranch ?? 100) / 100)), 0) : 0,
        processBranchAmount: userBranch ? filtered.filter(t => t.processBranchName === userBranch).reduce((sum, t) => sum + Math.round(t.originalOrderAmount * ((t.amountSplit?.processBranch ?? 0) / 100)), 0) : 0
      };
    } catch (err) { console.error(err); throw err; }
  }, [user, getTransferPermissions]);

  const calculateAmountSplit = useCallback((totalAmount: number, orderType: string) => {
    // 기본 분배 비율 설정 (현장/전화 주문은 보통 발주지점 비중이 높음)
    if (orderType === '현장주문' || orderType === '전화주문') {
      return { orderBranch: 100, processBranch: 0 };
    }
    // 기타(네이버/카카오 등)은 수주지점에 일부 배분할 수도 있으나 기본은 100/0으로 시작
    return { orderBranch: 100, processBranch: 0 };
  }, []);

  return {
    transfers, loading, error, hasMore,
    fetchTransfers, createTransfer, updateTransferStatus, cancelTransfer, deleteTransfer, cleanupOrphanTransfers, getTransferStats, getTransferPermissions, calculateAmountSplit
  };
}
