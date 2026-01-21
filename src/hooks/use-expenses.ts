"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import {
  ExpenseStatus,
  ExpenseCategory,
  generateExpenseNumber,
  getRequiredApprovalLevel
} from '@/types/expense';
import type {
  ExpenseRequest,
  CreateExpenseRequestData,
  ProcessApprovalData,
  ProcessPaymentData
} from '@/types/expense';

export function useExpenses() {
  const [expenses, setExpenses] = useState<ExpenseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    totalAmount: 0,
    monthlyAmount: 0
  });
  const { toast } = useToast();

  const mapRowToExpense = (row: any): ExpenseRequest => ({
    id: row.id,
    requestNumber: row.request_number,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    requesterRole: row.requester_role,
    branchId: row.branch_id,
    branchName: row.branch_name,
    status: row.status,
    totalAmount: Number(row.total_amount),
    totalTaxAmount: Number(row.total_tax_amount),
    items: row.items || [],
    purpose: row.purpose,
    requiredApprovalLevel: row.required_approval_level,
    currentApprovalLevel: row.current_approval_level,
    approvalRecords: row.approval_records || [],
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    paymentReference: row.payment_reference,
    fiscalYear: row.fiscal_year,
    fiscalMonth: row.fiscal_month,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchExpenses = useCallback(async (filters?: {
    status?: ExpenseStatus;
    category?: ExpenseCategory;
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => {
    try {
      setLoading(true);
      let query = supabase.from('expense_requests').select('*');

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.branchId) query = query.eq('branch_id', filters.branchId);
      if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom.toISOString());
      if (filters?.dateTo) query = query.lte('created_at', filters.dateTo.toISOString());

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const expenseData = (data || []).map(mapRowToExpense);
      let filteredData = expenseData;

      if (filters?.category) {
        filteredData = filteredData.filter(expense =>
          expense.items.some(item => item.category === filters.category)
        );
      }

      setExpenses(filteredData);

      // Stats calculation
      const totalRequests = filteredData.length;
      const pendingRequests = filteredData.filter(e => e.status === 'pending').length;
      const approvedRequests = filteredData.filter(e => e.status === 'approved' || e.status === 'paid').length;
      const totalAmount = filteredData.reduce((sum, e) => sum + e.totalAmount, 0);

      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      const monthlyAmount = filteredData
        .filter(e => new Date(e.createdAt) >= currentMonthStart)
        .reduce((sum, e) => sum + e.totalAmount, 0);

      setStats({ totalRequests, pendingRequests, approvedRequests, totalAmount, monthlyAmount });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({ variant: 'destructive', title: '오류', description: '로드 중 실패했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createExpenseRequest = useCallback(async (data: CreateExpenseRequestData) => {
    try {
      const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
      const totalTaxAmount = data.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const requiredApprovalLevel = getRequiredApprovalLevel(totalAmount);

      const id = crypto.randomUUID();
      const { error } = await supabase.from('expense_requests').insert([{
        id,
        request_number: generateExpenseNumber(),
        requester_id: data.requesterId,
        requester_name: data.requesterName,
        requester_role: data.requesterRole,
        branch_id: data.branchId,
        branch_name: data.branchName,
        status: 'draft',
        total_amount: totalAmount,
        total_tax_amount: totalTaxAmount,
        items: data.items.map((item, index) => ({ ...item, id: `item-${Date.now()}-${index}` })),
        purpose: data.purpose,
        required_approval_level: requiredApprovalLevel,
        current_approval_level: 1,
        approval_records: [],
        fiscal_year: new Date().getFullYear(),
        fiscal_month: new Date().getMonth() + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      if (error) throw error;
      toast({ title: '생성 완료', description: '비용 신청이 생성되었습니다.' });
      await fetchExpenses();
      return id;
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '생성 실패', description: '오류 발생' });
      throw error;
    }
  }, [toast, fetchExpenses]);

  const submitExpenseRequest = useCallback(async (requestId: string) => {
    try {
      const { error } = await supabase.from('expense_requests').update({
        status: 'pending',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', requestId);

      if (error) throw error;
      toast({ title: '제출 완료', description: '승인 대기 중입니다.' });
      await fetchExpenses();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '제출 실패', description: '오류 발생' });
    }
  }, [toast, fetchExpenses]);

  const processApproval = useCallback(async (data: ProcessApprovalData) => {
    try {
      const { data: expense } = await supabase.from('expense_requests').select('*').eq('id', data.requestId).single();
      if (!expense) throw new Error('비용 신청을 찾을 수 없습니다.');

      const updatedRecords = [...(expense.approval_records || [])];
      // Note: Logic for updating multi-level approval records should be consistent
      // This is a simplified version; in real scenario, it should handle pending levels correctly
      updatedRecords.push({
        level: expense.current_approval_level,
        approverId: data.approverId,
        approverName: data.approverName,
        approverRole: data.approverRole,
        status: data.action === 'approve' ? 'approved' : 'rejected',
        comment: data.comment,
        processedAt: new Date().toISOString()
      });

      let newStatus = expense.status;
      let approvedAt = expense.approved_at;
      if (data.action === 'reject') {
        newStatus = 'rejected';
      } else if (data.action === 'approve') {
        if (expense.current_approval_level >= expense.required_approval_level) {
          newStatus = 'approved';
          approvedAt = new Date().toISOString();
        }
      }

      const { error } = await supabase.from('expense_requests').update({
        approval_records: updatedRecords,
        status: newStatus,
        approved_at: approvedAt,
        current_approval_level: data.action === 'approve' ? expense.current_approval_level + 1 : expense.current_approval_level,
        updated_at: new Date().toISOString()
      }).eq('id', data.requestId);

      if (error) throw error;
      toast({ title: '처리 완료', description: `비용 신청이 ${data.action === 'approve' ? '승인' : '반려'}됨` });
      await fetchExpenses();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '처리 실패', description: '오류 발생' });
    }
  }, [toast, fetchExpenses]);

  const processPayment = useCallback(async (data: ProcessPaymentData) => {
    try {
      const { error } = await supabase.from('expense_requests').update({
        status: 'paid',
        payment_method: data.paymentMethod,
        payment_date: data.paymentDate,
        payment_reference: data.paymentReference,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', data.requestId);

      if (error) throw error;
      toast({ title: '지급 완료', description: '비용 지급 처리되었습니다.' });
      await fetchExpenses();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '지급 실패', description: '오류 발생' });
    }
  }, [toast, fetchExpenses]);

  const updateExpenseRequest = useCallback(async (requestId: string, data: Partial<CreateExpenseRequestData>) => {
    try {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (data.items) {
        const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
        updatePayload.total_amount = totalAmount;
        updatePayload.total_tax_amount = data.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        updatePayload.required_approval_level = getRequiredApprovalLevel(totalAmount);
        updatePayload.items = data.items.map((item, index) => ({ ...item, id: item.id || `item-${Date.now()}-${index}` }));
      }
      if (data.purpose) updatePayload.purpose = data.purpose;

      const { error } = await supabase.from('expense_requests').update(updatePayload).eq('id', requestId);
      if (error) throw error;
      toast({ title: '수정 완료', description: '성공적으로 수정되었습니다.' });
      await fetchExpenses();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '수정 실패', description: '오류 발생' });
    }
  }, [toast, fetchExpenses]);

  const deleteExpenseRequest = useCallback(async (requestId: string) => {
    try {
      const { error } = await supabase.from('expense_requests').delete().eq('id', requestId);
      if (error) throw error;
      toast({ title: '삭제 완료', description: '비용 신청이 삭제되었습니다.' });
      await fetchExpenses();
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '삭제 실패', description: '오류 발생' });
    }
  }, [toast, fetchExpenses]);

  const getExpenseRequest = useCallback(async (requestId: string): Promise<ExpenseRequest | null> => {
    try {
      const { data, error } = await supabase.from('expense_requests').select('*').eq('id', requestId).maybeSingle();
      if (error || !data) return null;
      return mapRowToExpense(data);
    } catch (error) {
      console.error(error);
      return null;
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return {
    expenses, loading, stats,
    fetchExpenses, createExpenseRequest, submitExpenseRequest, processApproval, processPayment, updateExpenseRequest, deleteExpenseRequest, getExpenseRequest
  };
}
