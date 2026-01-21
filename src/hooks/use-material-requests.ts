"use client";
import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import type {
  MaterialRequest,
  CreateMaterialRequestData,
  RequestStatus
} from '@/types/material-request';

export function useMaterialRequests() {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    completedRequests: 0,
    totalCost: 0,
    averageProcessingTime: 0
  });
  const { toast } = useToast();

  const mapRowToRequest = (row: any): MaterialRequest => ({
    id: row.id,
    requestNumber: row.request_number,
    status: row.status,
    branchId: row.branch_id,
    branchName: row.branch_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requestedItems: row.items || [],
    actualPurchase: row.actual_purchase,
    delivery: row.delivery,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const getRequestById = useCallback(async (requestId: string): Promise<MaterialRequest | null> => {
    try {
      const { data, error } = await supabase.from('material_requests').select('*').eq('id', requestId).single();
      if (error) throw error;
      return data ? mapRowToRequest(data) : null;
    } catch (error) {
      console.error('ID로 요청 조회 오류:', error);
      throw error;
    }
  }, []);

  const generateRequestNumber = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-6);
    return `REQ-${year}${month}${day}-${time}`;
  };

  const createRequest = useCallback(async (requestData: CreateMaterialRequestData): Promise<string> => {
    setLoading(true);
    try {
      const requestNumber = generateRequestNumber();
      const id = crypto.randomUUID();
      const payload = {
        id,
        request_number: requestNumber,
        branch_id: requestData.branchId,
        branch_name: requestData.branchName,
        requester_id: requestData.requesterId,
        requester_name: requestData.requesterName,
        items: requestData.requestedItems,
        status: 'submitted' as RequestStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('material_requests').insert([payload]);
      if (error) throw error;

      // 알림 생성
      try {
        await supabase.from('notifications').insert([{
          id: crypto.randomUUID(),
          type: 'material_request',
          sub_type: 'request_submitted',
          title: '새 자재 요청',
          message: `${requestData.branchName}에서 자재 요청이 접수되었습니다. (${requestNumber})`,
          user_role: '본사 관리자',
          related_id: id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

        const hasUrgentItems = requestData.requestedItems.some(item => item.urgency === 'urgent');
        if (hasUrgentItems) {
          await supabase.from('notifications').insert([{
            id: crypto.randomUUID(),
            type: 'material_request',
            sub_type: 'urgent_request',
            title: '긴급 자재 요청',
            message: `${requestData.branchName}에서 긴급 자재 요청이 접수되었습니다. (${requestNumber})`,
            user_role: '본사 관리자',
            related_id: id,
            severity: 'high',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        }
      } catch (err) {
        console.warn('알림 생성 실패:', err);
      }

      return requestNumber;
    } catch (error) {
      console.error('요청 생성 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRequestsByBranch = useCallback(async (branchName: string): Promise<MaterialRequest[]> => {
    try {
      const { data, error } = await supabase.from('material_requests').select('*').eq('branch_name', branchName).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRowToRequest);
    } catch (error) {
      console.error('지점별 요청 조회 오류:', error);
      throw error;
    }
  }, []);

  const getRequestsByBranchId = useCallback(async (branchId: string): Promise<MaterialRequest[]> => {
    try {
      const { data, error } = await supabase.from('material_requests').select('*').eq('branch_id', branchId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRowToRequest);
    } catch (error) {
      console.error('branchId로 요청 조회 오류:', error);
      throw error;
    }
  }, []);

  const getAllRequests = useCallback(async (): Promise<MaterialRequest[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false });
      if (error) throw error;

      const requestsData = (data || []).map(mapRowToRequest);
      setRequests(requestsData);

      const totalRequests = requestsData.length;
      const pendingRequests = requestsData.filter(r => ['submitted', 'reviewing', 'purchasing'].includes(r.status)).length;
      const completedRequests = requestsData.filter(r => r.status === 'completed').length;
      const totalCost = requestsData.reduce((sum, request) =>
        sum + request.requestedItems.reduce((itemSum: number, item: any) =>
          itemSum + (item.requestedQuantity * item.estimatedPrice), 0
        ), 0
      );

      setStats({
        totalRequests,
        pendingRequests,
        completedRequests,
        totalCost,
        averageProcessingTime: 0
      });

      return requestsData;
    } catch (error) {
      console.error('전체 요청 조회 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateRequestStatus = useCallback(async (
    requestId: string,
    newStatus: RequestStatus,
    additionalData?: Partial<MaterialRequest>
  ): Promise<void> => {
    setLoading(true);
    try {
      const payload: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (additionalData) {
        if (additionalData.actualPurchase) payload.actual_purchase = additionalData.actualPurchase;
        if (additionalData.delivery) payload.delivery = additionalData.delivery;
      }

      const { error } = await supabase.from('material_requests').update(payload).eq('id', requestId);
      if (error) throw error;

      // 알림 생성
      try {
        const { data: request } = await supabase.from('material_requests').select('branch_id').eq('id', requestId).single();
        if (request?.branch_id) {
          const statusMessages: Record<string, string> = {
            submitted: '요청이 제출되었습니다',
            reviewing: '요청이 검토 중입니다',
            purchasing: '구매가 진행 중입니다',
            purchased: '구매가 완료되었습니다',
            shipping: '배송이 시작되었습니다',
            delivered: '배송이 완료되었습니다',
            completed: '요청이 완료되었습니다'
          };

          await supabase.from('notifications').insert([{
            id: crypto.randomUUID(),
            type: 'material_request',
            sub_type: 'status_updated',
            title: '요청 상태 업데이트',
            message: statusMessages[newStatus] || `상태가 ${newStatus}로 변경되었습니다.`,
            branch_id: request.branch_id,
            related_id: requestId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        }
      } catch (err) {
        console.warn('알림 생성 실패:', err);
      }
    } catch (error) {
      console.error('요청 상태 업데이트 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRequestsByStatus = useCallback(async (status: RequestStatus): Promise<MaterialRequest[]> => {
    try {
      const { data, error } = await supabase.from('material_requests').select('*').eq('status', status).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRowToRequest);
    } catch (error) {
      console.error('상태별 요청 조회 오류:', error);
      throw error;
    }
  }, []);

  const completeRequestFromExpense = useCallback(async (
    requestId: string,
    actualItems: { id: string; name: string; quantity: number; unitPrice?: number }[]
  ): Promise<void> => {
    try {
      const { error } = await supabase.from('material_requests').update({
        status: 'completed',
        actual_delivery: {
          deliveredAt: new Date().toISOString(),
          items: actualItems,
          completedBy: 'expense_system'
        },
        updated_at: new Date().toISOString()
      }).eq('id', requestId);

      if (error) throw error;

      toast({
        title: "자재 요청 완료",
        description: "간편지출 입력으로 자재 요청이 자동 완료되었습니다."
      });
    } catch (error) {
      console.error('자재 요청 완료 처리 오류:', error);
    }
  }, [toast]);

  const deleteRequest = useCallback(async (requestId: string): Promise<void> => {
    setLoading(true);
    try {
      const { error } = await supabase.from('material_requests').delete().eq('id', requestId);
      if (error) throw error;
      toast({
        title: "요청 삭제 완료",
        description: "자재 요청이 성공적으로 삭제되었습니다."
      });
    } catch (error) {
      console.error('요청 삭제 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading, requests, stats, createRequest, getRequestsByBranch, getRequestsByBranchId, getAllRequests, updateRequestStatus, getRequestsByStatus, getRequestById, completeRequestFromExpense, deleteRequest
  };
}
