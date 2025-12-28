"use client";
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  runTransaction,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
import {
  ExpenseStatus,
  ExpenseCategory,
  generateExpenseNumber,
  getRequiredApprovalLevel
} from '@/types/expense';
import type {
  ExpenseRequest,
  ExpenseItem,
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
  // 비용 신청 목록 조회
  const fetchExpenses = useCallback(async (filters?: {
    status?: ExpenseStatus;
    category?: ExpenseCategory;
    branchId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => {
    try {
      setLoading(true);

      // [Supabase 우선 조회]
      let queryBuilder = supabase
        .from('expense_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        queryBuilder = queryBuilder.eq('status', filters.status);
      }
      if (filters?.branchId) {
        queryBuilder = queryBuilder.eq('branch_id', filters.branchId);
      }

      const { data: supabaseItems, error: supabaseError } = await queryBuilder;

      if (!supabaseError && supabaseItems && supabaseItems.length > 0) {
        let expenseData = supabaseItems.map(item => ({
          id: item.id,
          requestNumber: item.request_number,
          status: item.status as ExpenseStatus,
          branchId: item.branch_id,
          branchName: item.branch_name,
          totalAmount: Number(item.total_amount),
          totalTaxAmount: Number(item.total_tax_amount),
          items: item.items,
          approvalRecords: item.approval_records,
          requiredApprovalLevel: item.required_approval_level,
          currentApprovalLevel: item.current_approval_level,
          fiscalYear: item.fiscal_year,
          fiscalMonth: item.fiscal_month,
          createdAt: item.created_at ? Timestamp.fromDate(new Date(item.created_at)) : undefined,
          updatedAt: item.updated_at ? Timestamp.fromDate(new Date(item.updated_at)) : undefined,
          submittedAt: item.submitted_at ? Timestamp.fromDate(new Date(item.submitted_at)) : undefined,
          approvedAt: item.approved_at ? Timestamp.fromDate(new Date(item.approved_at)) : undefined,
          paidAt: item.paid_at ? Timestamp.fromDate(new Date(item.paid_at)) : undefined,
          paymentMethod: item.payment_method,
          paymentDate: item.payment_date,
          paymentReference: item.payment_reference
        } as unknown as ExpenseRequest));

        // 클라이언트 사이드 필터링
        if (filters?.category) {
          expenseData = expenseData.filter(expense =>
            expense.items.some(item => item.category === filters.category)
          );
        }
        if (filters?.dateFrom) {
          expenseData = expenseData.filter(expense => {
            if (!expense.createdAt) return false;
            const expenseDate = expense.createdAt.toDate();
            return expenseDate >= filters.dateFrom!;
          });
        }
        if (filters?.dateTo) {
          expenseData = expenseData.filter(expense => {
            if (!expense.createdAt) return false;
            const expenseDate = expense.createdAt.toDate();
            return expenseDate <= filters.dateTo!;
          });
        }

        setExpenses(expenseData);

        // 통계 계산
        const totalRequests = expenseData.length;
        const pendingRequests = expenseData.filter(e => e.status === 'pending').length;
        const approvedRequests = expenseData.filter(e => e.status === 'approved' || e.status === 'paid').length;
        const totalAmountSum = expenseData.reduce((sum, e) => sum + e.totalAmount, 0);
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const monthlyAmount = expenseData
          .filter(e => {
            if (!e.createdAt) return false;
            const expenseDate = e.createdAt.toDate();
            return expenseDate >= currentMonth;
          })
          .reduce((sum, e) => sum + e.totalAmount, 0);

        setStats({
          totalRequests,
          pendingRequests,
          approvedRequests,
          totalAmount: totalAmountSum,
          monthlyAmount
        });

        setLoading(false);
        return;
      }

      let expenseQuery = query(
        collection(db, 'expenseRequests'),
        orderBy('createdAt', 'desc')
      );
      if (filters?.status) {
        expenseQuery = query(expenseQuery, where('status', '==', filters.status));
      }
      if (filters?.branchId) {
        expenseQuery = query(expenseQuery, where('branchId', '==', filters.branchId));
      }
      const snapshot = await getDocs(expenseQuery);
      const expenseData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExpenseRequest[];
      // 클라이언트 사이드 필터링 (Firestore 복합 쿼리 제한)
      let filteredData = expenseData;
      if (filters?.category) {
        filteredData = filteredData.filter(expense =>
          expense.items.some(item => item.category === filters.category)
        );
      }
      if (filters?.dateFrom) {
        filteredData = filteredData.filter(expense => {
          if (!expense.createdAt) return false;
          const expenseDate = expense.createdAt.toDate();
          return expenseDate >= filters.dateFrom!;
        });
      }
      if (filters?.dateTo) {
        filteredData = filteredData.filter(expense => {
          if (!expense.createdAt) return false;
          const expenseDate = expense.createdAt.toDate();
          return expenseDate <= filters.dateTo!;
        });
      }
      setExpenses(filteredData);
      // 통계 계산
      const totalRequests = filteredData.length;
      const pendingRequests = filteredData.filter(e => e.status === 'pending').length;
      const approvedRequests = filteredData.filter(e => e.status === 'approved' || e.status === 'paid').length;
      const totalAmount = filteredData.reduce((sum, e) => sum + e.totalAmount, 0);
      const currentMonth = new Date();
      currentMonth.setDate(1);
      const monthlyAmount = filteredData
        .filter(e => {
          if (!e.createdAt) return false;
          const expenseDate = e.createdAt.toDate();
          return expenseDate >= currentMonth;
        })
        .reduce((sum, e) => sum + e.totalAmount, 0);
      setStats({
        totalRequests,
        pendingRequests,
        approvedRequests,
        totalAmount,
        monthlyAmount
      });
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '비용 신청 목록을 불러오는 중 오류가 발생했습니다.'
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  // 비용 신청 생성
  const createExpenseRequest = useCallback(async (data: CreateExpenseRequestData) => {
    try {
      const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
      const totalTaxAmount = data.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
      const requiredApprovalLevel = getRequiredApprovalLevel(totalAmount);
      const expenseRequest: Omit<ExpenseRequest, 'id'> = {
        requestNumber: generateExpenseNumber(),
        ...data,
        items: data.items.map((item, index) => ({
          ...item,
          id: `item-${Date.now()}-${index}`
        } as ExpenseItem)),
        totalAmount,
        totalTaxAmount,
        status: ExpenseStatus.DRAFT,
        requiredApprovalLevel,
        approvalRecords: [],
        fiscalYear: new Date().getFullYear(),
        fiscalMonth: new Date().getMonth() + 1,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      const docRef = await addDoc(collection(db, 'expenseRequests'), expenseRequest);

      // [이중 저장: Supabase]
      await supabase.from('expense_requests').insert([{
        id: docRef.id,
        request_number: expenseRequest.requestNumber,
        status: ExpenseStatus.DRAFT,
        branch_id: data.branchId,
        branch_name: data.branchName,
        total_amount: totalAmount,
        total_tax_amount: totalTaxAmount,
        items: expenseRequest.items,
        approval_records: [],
        required_approval_level: requiredApprovalLevel,
        current_approval_level: 1, // 초기값
        fiscal_year: expenseRequest.fiscalYear,
        fiscal_month: expenseRequest.fiscalMonth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      toast({
        title: '비용 신청 생성 완료',
        description: '비용 신청이 성공적으로 생성되었습니다.'
      });
      await fetchExpenses();
      return docRef.id;
    } catch (error) {
      console.error('Error creating expense request:', error);
      toast({
        variant: 'destructive',
        title: '비용 신청 생성 실패',
        description: '비용 신청 생성 중 오류가 발생했습니다.'
      });
      throw error;
    }
  }, [toast, fetchExpenses]);
  // 비용 신청 제출
  const submitExpenseRequest = useCallback(async (requestId: string) => {
    try {
      const docRef = doc(db, 'expenseRequests', requestId);
      await updateDoc(docRef, {
        status: ExpenseStatus.PENDING,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // [이중 저장: Supabase]
      await supabase.from('expense_requests').update({
        status: ExpenseStatus.PENDING,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', requestId);
      toast({
        title: '비용 신청 제출 완료',
        description: '비용 신청이 승인 대기 상태로 변경되었습니다.'
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error submitting expense request:', error);
      toast({
        variant: 'destructive',
        title: '비용 신청 제출 실패',
        description: '비용 신청 제출 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchExpenses]);
  // 승인 처리
  const processApproval = useCallback(async (data: ProcessApprovalData) => {
    try {
      await runTransaction(db, async (transaction) => {
        const docRef = doc(db, 'expenseRequests', data.requestId);
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists()) {
          throw new Error('비용 신청을 찾을 수 없습니다.');
        }
        const expense = docSnap.data() as ExpenseRequest;
        const updatedApprovalRecords = [...expense.approvalRecords];
        // 현재 승인 단계 기록 업데이트
        const currentLevelIndex = updatedApprovalRecords.findIndex(
          record => record.level === expense.currentApprovalLevel && record.status === 'pending'
        );
        if (currentLevelIndex >= 0) {
          updatedApprovalRecords[currentLevelIndex] = {
            ...updatedApprovalRecords[currentLevelIndex],
            approverId: data.approverId,
            approverName: data.approverName,
            approverRole: data.approverRole,
            status: data.action === 'approve' ? 'approved' : 'rejected',
            comment: data.comment,
            processedAt: serverTimestamp() as Timestamp
          };
        }
        let newStatus: ExpenseStatus = expense.status;
        let approvedAt: Timestamp | undefined;
        if (data.action === 'reject') {
          newStatus = ExpenseStatus.REJECTED;
        } else if (data.action === 'approve') {
          // 모든 필요한 승인이 완료되었는지 확인
          const allApproved = updatedApprovalRecords
            .filter(record => record.level <= expense.requiredApprovalLevel)
            .every(record => record.status === 'approved');
          if (allApproved) {
            newStatus = ExpenseStatus.APPROVED;
            approvedAt = serverTimestamp() as Timestamp;
          }
        }
        const updateData: any = {
          approvalRecords: updatedApprovalRecords,
          status: newStatus,
          updatedAt: serverTimestamp()
        };
        if (approvedAt) {
          updateData.approvedAt = approvedAt;
        }
        transaction.update(docRef, updateData);

        // [이중 저장: Supabase]
        await supabase.from('expense_requests').update({
          approval_records: updatedApprovalRecords,
          status: newStatus,
          approved_at: approvedAt ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }).eq('id', data.requestId);
      });
      toast({
        title: '승인 처리 완료',
        description: `비용 신청이 ${data.action === 'approve' ? '승인' : '반려'}되었습니다.`
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error processing approval:', error);
      toast({
        variant: 'destructive',
        title: '승인 처리 실패',
        description: '승인 처리 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchExpenses]);
  // 지급 처리
  const processPayment = useCallback(async (data: ProcessPaymentData) => {
    try {
      const docRef = doc(db, 'expenseRequests', data.requestId);
      await updateDoc(docRef, {
        status: ExpenseStatus.PAID,
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate,
        paymentReference: data.paymentReference,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // [이중 저장: Supabase]
      await supabase.from('expense_requests').update({
        status: ExpenseStatus.PAID,
        payment_method: data.paymentMethod,
        payment_date: data.paymentDate instanceof Timestamp ? data.paymentDate.toDate().toISOString() : data.paymentDate,
        payment_reference: data.paymentReference,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', data.requestId);
      toast({
        title: '지급 처리 완료',
        description: '비용 지급이 완료되었습니다.'
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        variant: 'destructive',
        title: '지급 처리 실패',
        description: '지급 처리 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchExpenses]);
  // 비용 신청 수정
  const updateExpenseRequest = useCallback(async (
    requestId: string,
    data: Partial<CreateExpenseRequestData>
  ) => {
    try {
      const docRef = doc(db, 'expenseRequests', requestId);
      const updateData: any = {
        ...data,
        updatedAt: serverTimestamp()
      };
      if (data.items) {
        const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
        const totalTaxAmount = data.items.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
        updateData.totalAmount = totalAmount;
        updateData.totalTaxAmount = totalTaxAmount;
        updateData.requiredApprovalLevel = getRequiredApprovalLevel(totalAmount);
        updateData.items = data.items.map((item, index) => ({
          ...item,
          id: (item as any).id || `item-${Date.now()}-${index}`
        } as ExpenseItem));
      }
      await updateDoc(docRef, updateData);

      // [이중 저장: Supabase]
      const supabaseUpdate: any = {
        updated_at: new Date().toISOString()
      };
      if (data.items) {
        supabaseUpdate.items = updateData.items;
        supabaseUpdate.total_amount = updateData.totalAmount;
        supabaseUpdate.total_tax_amount = updateData.totalTaxAmount;
        supabaseUpdate.required_approval_level = updateData.requiredApprovalLevel;
      }
      // 다른 필드들도 있으면 매핑...
      await supabase.from('expense_requests').update(supabaseUpdate).eq('id', requestId);
      toast({
        title: '비용 신청 수정 완료',
        description: '비용 신청이 성공적으로 수정되었습니다.'
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error updating expense request:', error);
      toast({
        variant: 'destructive',
        title: '비용 신청 수정 실패',
        description: '비용 신청 수정 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchExpenses]);
  // 비용 신청 삭제
  const deleteExpenseRequest = useCallback(async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'expenseRequests', requestId));

      // [이중 저장: Supabase]
      await supabase.from('expense_requests').delete().eq('id', requestId);

      toast({
        title: '비용 신청 삭제 완료',
        description: '비용 신청이 삭제되었습니다.'
      });
      await fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense request:', error);
      toast({
        variant: 'destructive',
        title: '비용 신청 삭제 실패',
        description: '비용 신청 삭제 중 오류가 발생했습니다.'
      });
    }
  }, [toast, fetchExpenses]);
  // 특정 비용 신청 조회
  const getExpenseRequest = useCallback(async (requestId: string): Promise<ExpenseRequest | null> => {
    try {
      // [Supabase 우선 조회]
      const { data: item, error: supabaseError } = await supabase
        .from('expense_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (!supabaseError && item) {
        return {
          id: item.id,
          requestNumber: item.request_number,
          status: item.status as ExpenseStatus,
          branchId: item.branch_id,
          branchName: item.branch_name,
          totalAmount: Number(item.total_amount),
          totalTaxAmount: Number(item.total_tax_amount),
          items: item.items,
          approvalRecords: item.approval_records,
          requiredApprovalLevel: item.required_approval_level,
          currentApprovalLevel: item.current_approval_level,
          fiscalYear: item.fiscal_year,
          fiscalMonth: item.fiscal_month,
          createdAt: item.created_at ? Timestamp.fromDate(new Date(item.created_at)) : undefined,
          updatedAt: item.updated_at ? Timestamp.fromDate(new Date(item.updated_at)) : undefined,
          submittedAt: item.submitted_at ? Timestamp.fromDate(new Date(item.submitted_at)) : undefined,
          approvedAt: item.approved_at ? Timestamp.fromDate(new Date(item.approved_at)) : undefined,
          paidAt: item.paid_at ? Timestamp.fromDate(new Date(item.paid_at)) : undefined,
          paymentMethod: item.payment_method,
          paymentDate: item.payment_date,
          paymentReference: item.payment_reference
        } as unknown as ExpenseRequest;
      }

      const docRef = doc(db, 'expenseRequests', requestId);
      const docSnap = await getDocs(query(collection(db, 'expenseRequests'), where('__name__', '==', requestId)));
      if (docSnap.empty) {
        return null;
      }
      return {
        id: docSnap.docs[0].id,
        ...docSnap.docs[0].data()
      } as ExpenseRequest;
    } catch (error) {
      console.error('Error getting expense request:', error);
      return null;
    }
  }, []);
  // 초기 데이터 로드
  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);
  return {
    expenses,
    loading,
    stats,
    fetchExpenses,
    createExpenseRequest,
    submitExpenseRequest,
    processApproval,
    processPayment,
    updateExpenseRequest,
    deleteExpenseRequest,
    getExpenseRequest
  };
}
