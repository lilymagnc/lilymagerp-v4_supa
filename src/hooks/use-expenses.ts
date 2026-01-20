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
        })),
        totalAmount,
        totalTaxAmount,
        status: 'draft' as ExpenseStatus,
        requiredApprovalLevel,
        approvalRecords: [],
        fiscalYear: new Date().getFullYear(),
        fiscalMonth: new Date().getMonth() + 1,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp
      };
      const docRef = await addDoc(collection(db, 'expenseRequests'), expenseRequest);



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
        status: 'pending',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
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
          newStatus = 'rejected';
        } else if (data.action === 'approve') {
          // 모든 필요한 승인이 완료되었는지 확인
          const allApproved = updatedApprovalRecords
            .filter(record => record.level <= expense.requiredApprovalLevel)
            .every(record => record.status === 'approved');
          if (allApproved) {
            newStatus = 'approved';
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
        status: 'paid',
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate,
        paymentReference: data.paymentReference,
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
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
          id: item.id || `item-${Date.now()}-${index}`
        }));
      }
      await updateDoc(docRef, updateData);
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
