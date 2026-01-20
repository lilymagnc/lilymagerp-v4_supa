import { Timestamp } from 'firebase/firestore';
// 비용 카테고리
export enum ExpenseCategory {
  MATERIAL = 'material',        // 자재비
  LABOR = 'labor',             // 인건비
  RENT = 'rent',               // 임대료
  UTILITY = 'utility',         // 공과금
  MARKETING = 'marketing',     // 마케팅비
  MAINTENANCE = 'maintenance', // 유지보수비
  OFFICE = 'office',          // 사무용품비
  TRAVEL = 'travel',          // 출장비
  INSURANCE = 'insurance',    // 보험료
  TAX = 'tax',               // 세금
  COMMUNICATION = 'communication', // 통신비
  EDUCATION = 'education',    // 교육비
  ENTERTAINMENT = 'entertainment', // 접대비
  FUEL = 'fuel',             // 연료비
  DELIVERY = 'delivery',     // 배송비
  OTHER = 'other'            // 기타
}
// 비용 상태
export enum ExpenseStatus {
  DRAFT = 'draft',           
  PENDING = 'pending',       // 승인대기
  APPROVED = 'approved',     // 승인완료
  REJECTED = 'rejected',     // 반려
  PAID = 'paid',            // 지급완료
  CANCELLED = 'cancelled'    // 취소
}
// 승인 단계
export enum ApprovalLevel {
  NONE = 'none',            // 승인불필요
  MANAGER = 'manager',      // 팀장승인
  DIRECTOR = 'director',    // 부서장승인
  EXECUTIVE = 'executive'   // 임원승인
}
// 지급 방법
export enum PaymentMethod {
  CASH = 'cash',           // 현금
  CARD = 'card',          // 카드
  TRANSFER = 'transfer',   // 계좌이체
  CHECK = 'check'         // 수표
}
// 비용 항목 인터페이스
export interface ExpenseItem {
  id: string;
  category: ExpenseCategory;
  subcategory?: string;
  description: string;
  amount: number;
  quantity: number;
  unitPrice: number;
  taxAmount?: number;
  memo?: string;
  receiptUrl?: string;
  supplier?: string;
  purchaseDate: Timestamp;
}
// 승인 기록 인터페이스
export interface ApprovalRecord {
  level: ApprovalLevel;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'pending' | 'approved' | 'rejected';
  comment?: string;
  processedAt?: Timestamp;
}
// 비용 신청 메인 인터페이스
export interface ExpenseRequest {
  id: string;
  requestNumber: string; // EXP-2024-001
  // 신청자 정보
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  branchId: string;
  branchName: string;
  departmentId?: string;
  departmentName?: string;
  // 비용 정보
  items: ExpenseItem[];
  totalAmount: number;
  totalTaxAmount: number;
  // 상태 및 승인
  status: ExpenseStatus;
  requiredApprovalLevel: ApprovalLevel;
  approvalRecords: ApprovalRecord[];
  currentApprovalLevel?: ApprovalLevel;
  // 지급 정보
  paymentMethod?: PaymentMethod;
  paymentDate?: Timestamp;
  paymentReference?: string;
  // 예산 정보
  budgetId?: string;
  budgetCategory?: string;
  fiscalYear: number;
  fiscalMonth: number;
  // 메타데이터
  title: string;
  purpose: string;
  urgency: 'normal' | 'urgent';
  tags?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  paidAt?: Timestamp;
}
// 예산 인터페이스
export interface Budget {
  id: string;
  name: string;
  category: ExpenseCategory;
  // 예산 기간
  fiscalYear: number;
  fiscalMonth?: number; // null이면 연간 예산
  // 예산 금액
  allocatedAmount: number;
  usedAmount: number;
  remainingAmount: number;
  // 조직 정보
  branchId?: string;
  branchName?: string;
  departmentId?: string;
  departmentName?: string;
  // 승인 한도
  approvalLimits: {
    [key in ApprovalLevel]?: number;
  };
  // 상태
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
// 비용 분석 데이터
export interface ExpenseAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  // 카테고리별 분석
  categoryBreakdown: {
    category: ExpenseCategory;
    amount: number;
    count: number;
    percentage: number;
  }[];
  // 지점별 분석
  branchBreakdown: {
    branchId: string;
    branchName: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  // 월별 트렌드
  monthlyTrend: {
    month: string;
    amount: number;
    count: number;
    budgetUsage: number;
  }[];
  // 주요 지표
  totalAmount: number;
  totalCount: number;
  averageAmount: number;
  budgetUtilization: number;
  approvalRate: number;
}
// 비용 신청 생성 데이터
export interface CreateExpenseRequestData {
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  branchId: string;
  branchName: string;
  departmentId?: string;
  departmentName?: string;
  title: string;
  purpose: string;
  urgency: 'normal' | 'urgent';
  items: Omit<ExpenseItem, 'id'>[];
  tags?: string[];
}
// 승인 처리 데이터
export interface ProcessApprovalData {
  requestId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: 'approve' | 'reject';
  comment?: string;
}
// 지급 처리 데이터
export interface ProcessPaymentData {
  requestId: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  paymentDate: Timestamp;
  processedBy: string;
}
// 라벨 매핑
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.MATERIAL]: '자재비',
  [ExpenseCategory.LABOR]: '인건비',
  [ExpenseCategory.RENT]: '임대료',
  [ExpenseCategory.UTILITY]: '공과금',
  [ExpenseCategory.MARKETING]: '마케팅비',
  [ExpenseCategory.MAINTENANCE]: '유지보수비',
  [ExpenseCategory.OFFICE]: '사무용품비',
  [ExpenseCategory.TRAVEL]: '출장비',
  [ExpenseCategory.INSURANCE]: '보험료',
  [ExpenseCategory.TAX]: '세금',
  [ExpenseCategory.COMMUNICATION]: '통신비',
  [ExpenseCategory.EDUCATION]: '교육비',
  [ExpenseCategory.ENTERTAINMENT]: '접대비',
  [ExpenseCategory.FUEL]: '연료비',
  [ExpenseCategory.DELIVERY]: '배송비',
  [ExpenseCategory.OTHER]: '기타'
};
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  [ExpenseStatus.DRAFT]: '임시저장',
  [ExpenseStatus.PENDING]: '승인대기',
  [ExpenseStatus.APPROVED]: '승인완료',
  [ExpenseStatus.REJECTED]: '반려',
  [ExpenseStatus.PAID]: '지급완료',
  [ExpenseStatus.CANCELLED]: '취소'
};
export const APPROVAL_LEVEL_LABELS: Record<ApprovalLevel, string> = {
  [ApprovalLevel.NONE]: '승인불필요',
  [ApprovalLevel.MANAGER]: '팀장승인',
  [ApprovalLevel.DIRECTOR]: '부서장승인',
  [ApprovalLevel.EXECUTIVE]: '임원승인'
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: '현금',
  [PaymentMethod.CARD]: '카드',
  [PaymentMethod.TRANSFER]: '계좌이체',
  [PaymentMethod.CHECK]: '수표'
};
// 유틸리티 함수들
export const generateExpenseNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-6);
  return `EXP-${year}${month}${day}-${time}`;
};
export const getRequiredApprovalLevel = (amount: number): ApprovalLevel => {
  if (amount < 100000) return ApprovalLevel.NONE;
  if (amount < 500000) return ApprovalLevel.MANAGER;
  if (amount < 2000000) return ApprovalLevel.DIRECTOR;
  return ApprovalLevel.EXECUTIVE;
};
export const getStatusColor = (status: ExpenseStatus): string => {
  const colors: Record<ExpenseStatus, string> = {
    [ExpenseStatus.DRAFT]: 'gray',
    [ExpenseStatus.PENDING]: 'yellow',
    [ExpenseStatus.APPROVED]: 'green',
    [ExpenseStatus.REJECTED]: 'red',
    [ExpenseStatus.PAID]: 'blue',
    [ExpenseStatus.CANCELLED]: 'gray'
  };
  return colors[status];
};
export const getCategoryColor = (category: ExpenseCategory): string => {
  const colors: Record<ExpenseCategory, string> = {
    [ExpenseCategory.MATERIAL]: 'blue',
    [ExpenseCategory.LABOR]: 'green',
    [ExpenseCategory.RENT]: 'purple',
    [ExpenseCategory.UTILITY]: 'orange',
    [ExpenseCategory.MARKETING]: 'pink',
    [ExpenseCategory.MAINTENANCE]: 'yellow',
    [ExpenseCategory.OFFICE]: 'indigo',
    [ExpenseCategory.TRAVEL]: 'teal',
    [ExpenseCategory.INSURANCE]: 'red',
    [ExpenseCategory.TAX]: 'gray',
    [ExpenseCategory.COMMUNICATION]: 'cyan',
    [ExpenseCategory.EDUCATION]: 'lime',
    [ExpenseCategory.ENTERTAINMENT]: 'rose',
    [ExpenseCategory.FUEL]: 'amber',
    [ExpenseCategory.DELIVERY]: 'emerald',
    [ExpenseCategory.OTHER]: 'slate'
  };
  return colors[category];
};
export const calculateTotalAmount = (items: ExpenseItem[]): number => {
  return items.reduce((total, item) => total + item.amount, 0);
};
export const calculateTotalTaxAmount = (items: ExpenseItem[]): number => {
  return items.reduce((total, item) => total + (item.taxAmount || 0), 0);
};
// 승인 상태 확인 함수
export const canApprove = (
  request: ExpenseRequest,
  userRole: string,
  userId: string
): boolean => {
  if (request.status !== ExpenseStatus.PENDING) return false;
  const currentLevel = request.currentApprovalLevel || ApprovalLevel.MANAGER;
  // 역할별 승인 권한 확인
  const roleApprovalMap: Record<string, ApprovalLevel> = {
    '팀장': ApprovalLevel.MANAGER,
    '부서장': ApprovalLevel.DIRECTOR,
    '임원': ApprovalLevel.EXECUTIVE,
    '본사 관리자': ApprovalLevel.EXECUTIVE
  };
  const userApprovalLevel = roleApprovalMap[userRole];
  if (!userApprovalLevel) return false;
  // 현재 승인 단계와 사용자 권한 비교
  const levelOrder = [ApprovalLevel.MANAGER, ApprovalLevel.DIRECTOR, ApprovalLevel.EXECUTIVE];
  const currentLevelIndex = levelOrder.indexOf(currentLevel);
  const userLevelIndex = levelOrder.indexOf(userApprovalLevel);
  return userLevelIndex >= currentLevelIndex;
};
// 예산 사용률 계산
export const calculateBudgetUsage = (budget: Budget): number => {
  if (budget.allocatedAmount === 0) return 0;
  return (budget.usedAmount / budget.allocatedAmount) * 100;
};
// 예산 상태 확인
export const getBudgetStatus = (budget: Budget): 'safe' | 'warning' | 'danger' => {
  const usage = calculateBudgetUsage(budget);
  if (usage < 70) return 'safe';
  if (usage < 90) return 'warning';
  return 'danger';
};
