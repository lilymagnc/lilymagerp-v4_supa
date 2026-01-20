import { Timestamp } from 'firebase/firestore';
// 요청 상태 enum (배송 단계 포함)
export type RequestStatus = 
  | 'submitted'    // 요청됨
  | 'purchased'    // 구매완료
  | 'shipping'     // 배송중
  | 'delivered'    // 배송완료
  | 'completed';   // 입고완료
// 긴급도 타입
export type UrgencyLevel = 'normal' | 'urgent';
// 구매 품목 상태
export type PurchaseItemStatus = 
  | 'purchased'    // 구매완료
  | 'unavailable'  // 구매불가
  | 'substituted'  // 대체품
  | 'partial';     // 부분구매
// 요청 품목 인터페이스
export interface RequestItem {
  materialId: string;
  materialName: string;
  requestedQuantity: number;
  estimatedPrice: number;
  urgency: UrgencyLevel;
  memo?: string;
}
// 실제 구매 품목 인터페이스
export interface ActualPurchaseItem {
  originalMaterialId: string;
  originalMaterialName: string;
  requestedQuantity: number;
  // 실제 구매 정보
  actualMaterialId?: string; // 대체품인 경우
  actualMaterialName: string;
  actualQuantity: number;
  actualPrice: number;
  totalAmount: number;
  status: PurchaseItemStatus;
  memo: string;
  purchaseDate: Timestamp;
  supplier?: string;
}
// 배송 정보 인터페이스
export interface DeliveryInfo {
  shippingDate: Timestamp;
  deliveryDate?: Timestamp;
  deliveryMethod: string;
  trackingNumber?: string;
  deliveryStatus: 'preparing' | 'shipped' | 'delivered';
}
// 실제 구매 정보 인터페이스
export interface ActualPurchaseInfo {
  purchaseDate: Timestamp;
  purchaserId: string;
  purchaserName: string;
  items: ActualPurchaseItem[];
  totalCost: number;
  notes: string;
}
// 자재 요청 메인 인터페이스
export interface MaterialRequest {
  id: string;
  requestNumber: string; // REQ-2024-001
  branchId: string;
  branchName: string;
  requesterId: string;
  requesterName: string;
  requestedItems: RequestItem[];
  status: RequestStatus;
  // 실제 구매 정보 (구매 완료 후)
  actualPurchase?: ActualPurchaseInfo;
  // 배송 정보
  delivery?: DeliveryInfo;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
// 구매 배치 인터페이스
export interface PurchaseBatch {
  id: string;
  batchNumber: string; // BATCH-2024-001
  purchaseDate: Timestamp;
  purchaserId: string;
  purchaserName: string;
  // 포함된 요청들
  includedRequests: string[];
  // 실제 구매 내역
  purchasedItems: ActualPurchaseItem[];
  totalCost: number;
  // 지점별 배송 계획
  deliveryPlan: DeliveryPlanItem[];
  status: 'planning' | 'purchasing' | 'completed';
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
// 취합 배치 (신규)
export interface ConsolidatedBatch {
  id: string;
  batchNumber: string;
  createdAt: Timestamp;
  createdBy: string;
  status: ConsolidationStatus;
  includedRequestIds: string[];
  consolidatedItems: ConsolidatedItem[];
  totalEstimatedCost: number;
  notes?: string;
}
export enum ConsolidationStatus {
  DRAFT = 'draft',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  PURCHASING = 'purchasing',
  COMPLETED = 'completed'
}
// 우선순위 enum 추가
export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}
// 배송 계획 품목
export interface DeliveryPlanItem {
  branchId: string;
  branchName: string;
  items: ActualPurchaseItem[];
  estimatedCost: number;
}
// 취합된 품목 (대시보드용)
export interface ConsolidatedItem {
  materialId: string;
  materialName: string;
  category: string;
  currentPrice: number;
  supplier: string;
  totalQuantity: number;
  requestingBranches: BranchRequestSummary[];
  estimatedTotalCost: number;
  hasUrgent: boolean;
  priority: Priority;
}
// 지점별 요청 요약
export interface BranchRequestSummary {
  branchId: string;
  branchName: string;
  quantity: number;
  urgency: UrgencyLevel;
  requestIds: string[];
  estimatedPrice: number;
}
// 요청 생성 데이터
export interface CreateMaterialRequestData {
  branchId: string;
  branchName: string;
  requesterId: string;
  requesterName: string;
  requestedItems: RequestItem[];
}
// 구매 배치 생성 데이터
export interface CreatePurchaseBatchData {
  purchaserId: string;
  purchaserName: string;
  includedRequests: string[];
  notes?: string;
}
// 실제 구매 입력 데이터
export interface ActualPurchaseInputData {
  batchId: string;
  purchaseDate: Timestamp;
  items: ActualPurchaseItem[];
  totalCost: number;
  notes: string;
}
// 상태 라벨 매핑
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: '요청됨',
  purchased: '구매완료',
  shipping: '배송중',
  delivered: '배송완료',
  completed: '입고완료'
};
// 긴급도 라벨 매핑
export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  normal: '일반',
  urgent: '긴급'
};
// 구매 품목 상태 라벨 매핑
export const PURCHASE_ITEM_STATUS_LABELS: Record<PurchaseItemStatus, string> = {
  purchased: '구매완료',
  unavailable: '구매불가',
  substituted: '대체품',
  partial: '부분구매'
};
// 요청 번호 생성 함수
export const generateRequestNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-6); // 마지막 6자리
  return `REQ-${year}${month}${day}-${time}`;
};
// 배치 번호 생성 함수
export const generateBatchNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-6); // 마지막 6자리
  return `BATCH-${year}${month}${day}-${time}`;
};
// 알림 관련 타입
export type NotificationType = 'material_request';
export type NotificationSubType = 
  | 'request_submitted'   // 요청 제출됨
  | 'purchase_completed'  // 구매 완료됨
  | 'shipping_started'    // 배송 시작됨
  | 'delivery_requested'  // 입고 요청됨
  | 'urgent_request';     // 긴급 요청
export interface MaterialRequestNotification {
  id: string;
  type: NotificationType;
  subType: NotificationSubType;
  title: string;
  message: string;
  userId?: string;
  branchId?: string;
  role?: string;
  relatedRequestId?: string;
  relatedBatchId?: string;
  isRead: boolean;
  readAt?: Timestamp;
  createdAt: Timestamp;
}
// 자재 정보 확장 (구매 관련)
export interface MaterialPurchaseInfo {
  suppliers?: string[];
  averagePrice?: number;
  lastPurchasePrice?: number;
  lastPurchaseDate?: Timestamp;
  purchaseUnit?: string;
  minimumOrderQuantity?: number;
}
// 재고 기록 확장 (구매 관련)
export interface StockHistoryPurchaseInfo {
  relatedRequestId?: string;
  relatedBatchId?: string;
  purchasePrice?: number;
}
// 비용 기록 확장 (구매 관련)
export interface ExpenseMaterialItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
}
export interface ExpensePurchaseInfo {
  relatedRequestId?: string;
  relatedBatchId?: string;
  materialItems?: ExpenseMaterialItem[];
}
// API 응답 타입들
export interface MaterialRequestListResponse {
  requests: MaterialRequest[];
  total: number;
  hasMore: boolean;
}
export interface PurchaseBatchListResponse {
  batches: PurchaseBatch[];
  total: number;
  hasMore: boolean;
}
// 필터 및 정렬 옵션
export interface MaterialRequestFilters {
  branchId?: string;
  status?: RequestStatus;
  urgency?: UrgencyLevel;
  dateFrom?: Date;
  dateTo?: Date;
}
export interface MaterialRequestSortOptions {
  field: 'createdAt' | 'updatedAt' | 'requestNumber';
  direction: 'asc' | 'desc';
}
// 통계 및 분석 타입
export interface MaterialRequestStats {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  totalCost: number;
  averageProcessingTime: number; // 시간 (시간 단위)
}
export interface BranchRequestStats {
  branchId: string;
  branchName: string;
  totalRequests: number;
  totalCost: number;
  averageUrgency: number; // 0-1 (긴급 요청 비율)
}
export interface MaterialUsageStats {
  materialId: string;
  materialName: string;
  totalRequested: number;
  totalPurchased: number;
  totalCost: number;
  requestFrequency: number; // 요청 횟수
}
// 에러 타입
export interface MaterialRequestError {
  code: string;
  message: string;
  details?: any;
}
// 유틸리티 함수들
export const getStatusColor = (status: RequestStatus): string => {
  const colors: Record<RequestStatus, string> = {
    submitted: 'blue',
    reviewing: 'yellow',
    purchasing: 'orange',
    purchased: 'green',
    shipping: 'purple',
    delivered: 'indigo',
    completed: 'gray'
  };
  return colors[status];
};
export const getUrgencyColor = (urgency: UrgencyLevel): string => {
  return urgency === 'urgent' ? 'red' : 'gray';
};
export const calculateTotalAmount = (items: RequestItem[]): number => {
  return items.reduce((total, item) => 
    total + (item.requestedQuantity * item.estimatedPrice), 0
  );
};
export const calculateActualTotalAmount = (items: ActualPurchaseItem[]): number => {
  return items.reduce((total, item) => total + item.totalAmount, 0);
};
// 상태 전이 검증 함수
export const canTransitionTo = (
  currentStatus: RequestStatus, 
  newStatus: RequestStatus
): boolean => {
  const validTransitions: Record<RequestStatus, RequestStatus[]> = {
    submitted: ['reviewing'],
    reviewing: ['purchasing', 'submitted'], // 되돌리기 가능
    purchasing: ['purchased', 'reviewing'],
    purchased: ['shipping'],
    shipping: ['delivered'],
    delivered: ['completed'],
    completed: [] // 최종 상태
  };
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
};
// 요청 검증 함수
export const validateMaterialRequest = (
  request: CreateMaterialRequestData
): MaterialRequestError | null => {
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
