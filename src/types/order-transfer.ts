import { Timestamp } from 'firebase/firestore';

// 주문 이관 설정 타입
export interface OrderTransferSettings {
  defaultTransferSplit: {
    orderBranch: number; // 발주지점 비율 (예: 20)
    processBranch: number; // 수주지점 비율 (예: 80)
  };
  transferRules: {
    [orderType: string]: {
      orderBranch: number;
      processBranch: number;
    };
  };
  autoNotification: boolean;
  notificationTemplate: string;

  displayBoardEnabled: boolean;
  displayBoardDuration: number; // 분 단위
}

// 주문 이관 데이터 타입
export interface OrderTransfer {
  id: string;
  originalOrderId: string;
  orderBranchId: string;
  orderBranchName: string;
  processBranchId: string;
  processBranchName: string;
  transferDate: Date | Timestamp;
  transferReason: string;
  transferBy: string;
  transferByUser: string; // 이관한 사용자 이름
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  amountSplit: {
    orderBranch: number;
    processBranch: number;
  };
  originalOrderAmount: number;
  notes?: string;
  acceptedAt?: Date | Timestamp;
  acceptedBy?: string;
  rejectedAt?: Date | Timestamp;
  rejectedBy?: string;
  completedAt?: Date | Timestamp;
  completedBy?: string;
}



// 전광판 데이터 타입
export interface DisplayBoardItem {
  id: string;
  type: 'order_transfer' | 'new_order' | 'delivery_complete' | 'pickup_ready';
  title: string;
  content: string;
  branchId: string;
  branchName: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date | Timestamp;
  expiresAt: Date | Timestamp;
  isActive: boolean;
  transferId?: string; // 주문 이관 관련 전광판인 경우
  orderId?: string; // 주문 관련 전광판인 경우
  
  // 주문 이관 관련 추가 정보
  orderBranchName?: string;
  processBranchName?: string;
  orderAmount?: number;
  transferReason?: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  
  // 주문 상세 정보
  orderNumber?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  recipientName?: string;
  recipientContact?: string;
}

// 이관 요청 폼 타입
export interface OrderTransferForm {
  processBranchId: string;
  transferReason: string;
  amountSplit: {
    orderBranch: number;
    processBranch: number;
  };
  notes?: string;
}

// 이관 상태 업데이트 타입
export interface TransferStatusUpdate {
  status: 'accepted' | 'rejected' | 'completed';
  notes?: string;
}

// 이관 통계 타입
export interface TransferStats {
  totalTransfers: number;
  pendingTransfers: number;
  acceptedTransfers: number;
  rejectedTransfers: number;
  completedTransfers: number;
  cancelledTransfers: number;
  totalAmount: number;
  orderBranchAmount: number;
  processBranchAmount: number;
  orderBranchCount?: number; // 발주 이관 건수
  processBranchCount?: number; // 수주 이관 건수
  orderBranchDetails?: Record<string, number>; // 발주 이관 상세 (수주지점별 건수)
  processBranchDetails?: Record<string, number>; // 수주 이관 상세 (발주지점별 건수)
}

// 이관 필터 타입
export interface TransferFilter {
  status?: 'pending' | 'accepted' | 'rejected' | 'completed';
  orderBranchId?: string;
  processBranchId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

// 이관 권한 타입
export interface TransferPermissions {
  canCreateTransfer: boolean;
  canAcceptTransfer: boolean;
  canRejectTransfer: boolean;
  canCompleteTransfer: boolean;
  canViewAllTransfers: boolean;
  canManageSettings: boolean;
}
