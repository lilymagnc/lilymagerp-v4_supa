"use client";
import { useState, useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  // ID로 특정 요청 조회
  const getRequestById = useCallback(async (requestId: string): Promise<MaterialRequest | null> => {
    try {
      const docRef = doc(db, 'materialRequests', requestId);
      const docSnap = await getDoc(docRef, { source: 'server' }); // source: 'server' 추가
      if (docSnap.exists()) {
        const data = docSnap.data();
        return { 
          id: docSnap.id, 
          ...data,
          createdAt: data.createdAt?.toDate(), // Timestamp를 Date 객체로 변환
          updatedAt: data.updatedAt?.toDate(), // Timestamp를 Date 객체로 변환
        } as MaterialRequest;
      }
      return null;
    } catch (error) {
      console.error('ID로 요청 조회 오류:', error);
      throw error;
    }
  }, []);
  // 요청 번호 생성 함수
  const generateRequestNumber = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getTime()).slice(-6); // 마지막 6자리
    return `REQ-${year}${month}${day}-${time}`;
  };
  // 요청 검증 함수
  const validateMaterialRequest = (request: CreateMaterialRequestData) => {
    if (!request.branchId || !request.branchName) {
      return {
        code: 'INVALID_BRANCH',
        message: '지점 정보가 필요합니다.'
      };
    }
    if (!request.requesterId || !request.requesterName) {
      return {
        code: 'INVALID_REQUESTER',
        message: '요청자 정보가 필요합니다.'
      };
    }
    if (!request.requestedItems || request.requestedItems.length === 0) {
      return {
        code: 'NO_ITEMS',
        message: '요청할 자재를 선택해주세요.'
      };
    }
    for (const item of request.requestedItems) {
      if (!item.materialId || !item.materialName) {
        return {
          code: 'INVALID_MATERIAL',
          message: '자재 정보가 올바르지 않습니다.'
        };
      }
      if (item.requestedQuantity <= 0) {
        return {
          code: 'INVALID_QUANTITY',
          message: '수량은 0보다 커야 합니다.'
        };
      }
      if (item.estimatedPrice < 0) {
        return {
          code: 'INVALID_PRICE',
          message: '가격은 0 이상이어야 합니다.'
        };
      }
    }
    return null;
  };
  // 새 요청 생성
  const createRequest = useCallback(async (requestData: CreateMaterialRequestData): Promise<string> => {
    setLoading(true);
    try {
      // Firebase 연결 상태 확인
      if (!db) {
        throw new Error('Firestore 데이터베이스가 초기화되지 않았습니다.');
      }
      // 요청 데이터 검증
      const validationError = validateMaterialRequest(requestData);
      if (validationError) {
        console.error('검증 오류:', validationError);
        throw new Error(validationError.message);
      }
      const requestNumber = generateRequestNumber();
      const now = serverTimestamp();
      const materialRequest: Omit<MaterialRequest, 'id'> = {
        requestNumber,
        branchId: requestData.branchId,
        branchName: requestData.branchName,
        requesterId: requestData.requesterId,
        requesterName: requestData.requesterName,
        requestedItems: requestData.requestedItems.map(item => ({
          materialId: item.materialId,
          materialName: item.materialName,
          requestedQuantity: Number(item.requestedQuantity),
          estimatedPrice: Number(item.estimatedPrice),
          urgency: item.urgency || 'normal',
          memo: item.memo || ''
        })),
        status: 'submitted',
        createdAt: now as any,
        updatedAt: now as any
      };
      // 필수 필드 검증
      if (!materialRequest.requestNumber || !materialRequest.branchId || !materialRequest.branchName || 
          !materialRequest.requesterId || !materialRequest.requesterName || !materialRequest.requestedItems) {
        console.error('필수 필드 누락:', {
          requestNumber: !!materialRequest.requestNumber,
          branchId: !!materialRequest.branchId,
          branchName: !!materialRequest.branchName,
          requesterId: !!materialRequest.requesterId,
          requesterName: !!materialRequest.requesterName,
          requestedItems: !!materialRequest.requestedItems
        });
        throw new Error('필수 필드가 누락되었습니다.');
      }
      // 데이터 구조 검증
      // Firestore에 전송할 데이터 정리 (undefined 값 제거)
      const cleanData = Object.fromEntries(
        Object.entries(materialRequest).filter(([_, value]) => value !== undefined)
      );
      // 더 안전한 데이터 구조로 변환
      const safeData = {
        requestNumber: cleanData.requestNumber,
        branchId: cleanData.branchId,
        branchName: cleanData.branchName,
        requesterId: cleanData.requesterId,
        requesterName: cleanData.requesterName,
        requestedItems: cleanData.requestedItems,
        status: cleanData.status,
        createdAt: cleanData.createdAt,
        updatedAt: cleanData.updatedAt
      };
      
      // 최종 데이터 검증
      if (!safeData.requestNumber || !safeData.branchId || !safeData.branchName) {
        throw new Error('필수 필드가 누락되었습니다: requestNumber, branchId, branchName');
      }
      // Firestore에 저장하기 전에 최종 확인
      const docRef = await addDoc(collection(db, 'materialRequests'), safeData);
      // 알림 생성 (본사 관리자에게)
      try {
        await createNotification({
          type: 'material_request',
          subType: 'request_submitted',
          title: '새 자재 요청',
          message: `${requestData.branchName}에서 자재 요청이 접수되었습니다. (${requestNumber})`,
          role: '본사 관리자',
          relatedRequestId: docRef.id
        });
        // 긴급 요청인 경우 추가 알림
        const hasUrgentItems = requestData.requestedItems.some(item => item.urgency === 'urgent');
        if (hasUrgentItems) {
          await createNotification({
            type: 'material_request',
            subType: 'urgent_request',
            title: '긴급 자재 요청',
            message: `${requestData.branchName}에서 긴급 자재 요청이 접수되었습니다. (${requestNumber})`,
            role: '본사 관리자',
            relatedRequestId: docRef.id
          });
        }
        } catch (notificationError) {
        console.warn('알림 생성 실패 (무시됨):', notificationError);
        // 알림 생성 실패는 전체 프로세스를 중단시키지 않음
      }
      return requestNumber;
    } catch (error) {
      console.error('요청 생성 오류:', error);
      // Firebase 오류 상세 정보 로깅
      if (error instanceof Error) {
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
      }
      // Firebase 특정 오류 처리
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Firebase 오류 코드:', (error as any).code);
        console.error('Firebase 오류 메시지:', (error as any).message);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  // 지점별 요청 목록 조회
  const getRequestsByBranch = useCallback(async (branchName: string): Promise<MaterialRequest[]> => {
    try {
      // 먼저 지점 정보를 가져와서 branchId를 찾습니다
      const branchesQuery = query(
        collection(db, 'branches'),
        where('name', '==', branchName)
      );
      const branchesSnapshot = await getDocs(branchesQuery);
      if (branchesSnapshot.empty) {
        return [];
      }
      const branchId = branchesSnapshot.docs[0].id;
      const q = query(
        collection(db, 'materialRequests'),
        where('branchId', '==', branchId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q, { source: 'server' }); // source: 'server' 추가
      const requests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(), // Timestamp를 Date 객체로 변환
          updatedAt: data.updatedAt?.toDate(), // Timestamp를 Date 객체로 변환
        } as MaterialRequest;
      });
      return requests;
    } catch (error) {
      console.error('지점별 요청 조회 오류:', error);
      throw error;
    }
  }, []);
  // branchId로 요청 목록 조회
  const getRequestsByBranchId = useCallback(async (branchId: string): Promise<MaterialRequest[]> => {
    try {
      const q = query(
        collection(db, 'materialRequests'),
        where('branchId', '==', branchId)
      );
      const querySnapshot = await getDocs(q, { source: 'server' });
      const requests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as MaterialRequest;
      });
      // 클라이언트 사이드에서 정렬
      return requests.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error('branchId로 요청 조회 오류:', error);
      throw error;
    }
  }, []);
  // 모든 요청 목록 조회 (본사용)
  const getAllRequests = useCallback(async (): Promise<MaterialRequest[]> => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'materialRequests')
      );
      const querySnapshot = await getDocs(q);
      const requestsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(), // Timestamp를 Date 객체로 변환
          updatedAt: data.updatedAt?.toDate(), // Timestamp를 Date 객체로 변환
        } as MaterialRequest;
      });
      // 클라이언트 사이드에서 정렬
      const sortedRequests = requestsData.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      // 상태 업데이트
      setRequests(sortedRequests);
      // 통계 계산
      const totalRequests = sortedRequests.length;
      const pendingRequests = sortedRequests.filter(r => ['submitted', 'reviewing', 'purchasing'].includes(r.status)).length;
      const completedRequests = sortedRequests.filter(r => r.status === 'completed').length;
      const totalCost = sortedRequests.reduce((sum, request) => 
        sum + request.requestedItems.reduce((itemSum, item) => 
          itemSum + (item.requestedQuantity * item.estimatedPrice), 0
        ), 0
      );
      setStats({
        totalRequests,
        pendingRequests,
        completedRequests,
        totalCost,
        averageProcessingTime: 0 // 계산 로직 필요
      });
      return sortedRequests;
    } catch (error) {
      console.error('전체 요청 조회 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  // 요청 상태 업데이트
  const updateRequestStatus = useCallback(async (
    requestId: string, 
    newStatus: RequestStatus,
    additionalData?: Partial<MaterialRequest>
  ): Promise<void> => {
    setLoading(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...additionalData
      };
      await updateDoc(doc(db, 'materialRequests', requestId), updateData);
      // 상태 변경 알림 생성
      if (additionalData?.branchId) {
        await createStatusChangeNotification(requestId, newStatus, additionalData.branchId);
      }
    } catch (error) {
      console.error('요청 상태 업데이트 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  // 상태별 요청 조회
  const getRequestsByStatus = useCallback(async (status: RequestStatus): Promise<MaterialRequest[]> => {
    try {
      const q = query(
        collection(db, 'materialRequests'),
        where('status', '==', status)
      );
      const querySnapshot = await getDocs(q, { source: 'server' }); // source: 'server' 추가
      const requests = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate(), // Timestamp를 Date 객체로 변환
          updatedAt: data.updatedAt?.toDate(), // Timestamp를 Date 객체로 변환
        } as MaterialRequest;
      });
      // 클라이언트 사이드에서 정렬
      return requests.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
    } catch (error) {
      console.error('상태별 요청 조회 오류:', error);
      throw error;
    }
  }, []);
  // 알림 생성 헬퍼 함수
  const createNotification = async (notificationData: {
    type: string;
    subType: string;
    title: string;
    message: string;
    userId?: string;
    branchId?: string;
    role?: string;
    relatedRequestId?: string;
  }) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notificationData,
        isRead: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('알림 생성 오류:', error);
      // 알림 생성 실패는 전체 프로세스를 중단시키지 않음
    }
  };
  // 상태 변경 알림 생성
  const createStatusChangeNotification = async (
    requestId: string, 
    newStatus: RequestStatus, 
    branchId: string
  ) => {
    const statusMessages: Record<RequestStatus, string> = {
      submitted: '요청이 제출되었습니다',
      reviewing: '요청이 검토 중입니다',
      purchasing: '구매가 진행 중입니다',
      purchased: '구매가 완료되었습니다',
      shipping: '배송이 시작되었습니다',
      delivered: '배송이 완료되었습니다',
      completed: '요청이 완료되었습니다'
    };
    await createNotification({
      type: 'material_request',
      subType: 'status_updated',
      title: '요청 상태 업데이트',
      message: statusMessages[newStatus],
      branchId,
      relatedRequestId: requestId
    });
  };
  // 실제 구매 내역 저장
  const saveActualPurchase = useCallback(async (
    requestIds: string[],
    purchaseData: {
      purchaseDate: Timestamp;
      items: any[];
      totalCost: number;
      notes: string;
    }
  ): Promise<void> => {
    setLoading(true);
    try {
      // 각 요청에 실제 구매 정보 업데이트
      const updatePromises = requestIds.map(requestId => {
        const actualPurchaseInfo = {
          purchaseDate: purchaseData.purchaseDate,
          purchaserId: 'current-user-id', // 실제로는 현재 사용자 ID
          purchaserName: '구매담당자', // 실제로는 현재 사용자 이름
          items: purchaseData.items,
          totalCost: purchaseData.totalCost,
          notes: purchaseData.notes
        };
        return updateDoc(doc(db, 'materialRequests', requestId), {
          actualPurchase: actualPurchaseInfo,
          status: 'purchased',
          updatedAt: serverTimestamp()
        });
      });
      await Promise.all(updatePromises);
      // 구매 완료 알림 생성
      for (const requestId of requestIds) {
        await createNotification({
          type: 'material_request',
          subType: 'purchase_completed',
          title: '구매 완료',
          message: '요청하신 자재의 구매가 완료되었습니다.',
          relatedRequestId: requestId
        });
      }
    } catch (error) {
      console.error('실제 구매 내역 저장 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  // 구매 배치 생성
  const createPurchaseBatch = useCallback(async (
    requestIds: string[],
    batchData: {
      purchaserId: string;
      purchaserName: string;
      notes?: string;
    }
  ): Promise<string> => {
    setLoading(true);
    try {
      const batchNumber = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-6)}`;
      const now = serverTimestamp();
      const batch = {
        batchNumber,
        purchaseDate: now,
        purchaserId: batchData.purchaserId,
        purchaserName: batchData.purchaserName,
        includedRequests: requestIds,
        purchasedItems: [],
        totalCost: 0,
        deliveryPlan: [],
        status: 'planning',
        notes: batchData.notes || '',
        createdAt: now,
        updatedAt: now
      };
      const docRef = await addDoc(collection(db, 'purchaseBatches'), batch);
      // 포함된 요청들의 상태를 'purchasing'으로 업데이트
      await Promise.all(
        requestIds.map(requestId => 
          updateRequestStatus(requestId, 'purchasing')
        )
      );
      return docRef.id;
    } catch (error) {
      console.error('구매 배치 생성 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  // 구매 완료 처리 (기존 함수 수정)
  const completePurchase = useCallback(async (
    requestId: string,
    actualPurchaseInfo: any
  ): Promise<void> => {
    setLoading(true);
    try {
      // 요청 정보 조회
      const requestDoc = await getDoc(doc(db, 'materialRequests', requestId));
      if (!requestDoc.exists()) {
        throw new Error('요청을 찾을 수 없습니다.');
      }
      const requestData = requestDoc.data() as MaterialRequest;
      // 요청 상태 업데이트
      await updateDoc(doc(db, 'materialRequests', requestId), {
        status: 'purchased',
        actualPurchase: actualPurchaseInfo,
        updatedAt: serverTimestamp()
      });
      // 간편지출 자동 등록은 제거 (순환 참조 방지)
      // 필요시 별도 프로세스에서 처리
    } catch (error) {
      console.error('구매 완료 처리 오류:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  // 자재 요청 완료 처리 (간편지출에서 호출)
  const completeRequestFromExpense = useCallback(async (
    requestId: string,
    actualItems: { id: string; name: string; quantity: number; unitPrice?: number }[]
  ): Promise<void> => {
    try {
      await updateDoc(doc(db, 'materialRequests', requestId), {
        status: 'completed',
        actualDelivery: {
          deliveredAt: serverTimestamp(),
          items: actualItems,
          completedBy: 'expense_system'
        },
        updatedAt: serverTimestamp()
      });
      toast({
        title: "자재 요청 완료",
        description: "간편지출 입력으로 자재 요청이 자동 완료되었습니다."
      });
    } catch (error) {
      console.error('자재 요청 완료 처리 오류:', error);
    }
  }, [toast]);
  // 요청 삭제
  const deleteRequest = useCallback(async (requestId: string): Promise<void> => {
    setLoading(true);
    try {
      const docRef = doc(db, 'materialRequests', requestId);
      await deleteDoc(docRef);
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
    loading,
    requests,
    stats,
    createRequest,
    getRequestsByBranch,
    getRequestsByBranchId,
    getAllRequests,
    updateRequestStatus,
    getRequestsByStatus,
    saveActualPurchase,
    createPurchaseBatch,
    getRequestById,
    completePurchase,
    completeRequestFromExpense,
    deleteRequest
  };
}
