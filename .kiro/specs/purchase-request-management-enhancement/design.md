# 구매 요청 관리 시스템 개선 설계

## 개요

기존 구매 요청 시스템을 확장하여 본사 관리자의 효율적인 요청 취합 및 관리 기능을 제공하고, 역할 기반 접근 제어를 통해 보안성을 강화합니다.

## 아키텍처

### 시스템 구조
```
Frontend (React/Next.js)
├── Branch User Interface (지점 사용자)
│   ├── New Purchase Request Form
│   └── Request Status View (읽기 전용)
├── HQ Manager Interface (본사 관리자)
│   ├── Purchase Request Management
│   ├── Consolidated Request View
│   ├── Request Detail Popup
│   └── Price Management
└── Shared Components
    ├── Material Selection Table
    ├── Status Management
    └── Notification System

Backend (Firebase)
├── Firestore Collections
│   ├── materialRequests (기존)
│   ├── consolidatedRequests (신규)
│   ├── priceHistory (신규)
│   ├── userRoles (신규)
│   └── notifications (기존)
├── Cloud Functions
│   ├── consolidateRequests
│   ├── updateMaterialPrices
│   └── sendNotifications
└── Security Rules
    ├── Role-based Access Control
    └── Data Validation
```

## 컴포넌트 및 인터페이스

### 1. 자재 카테고리 개선

#### MaterialSelectionTable 컴포넌트 개선
```typescript
interface MaterialSelectionTableProps {
  materials: Material[];
  selectedBranch: string;
  onMaterialSelect: (material: Material) => void;
  showCategories: boolean;
}

interface Material {
  id: string;
  name: string;
  category: string; // 필수 필드로 변경
  price: number;
  stock: number;
  supplier?: string;
  branch: string;
}
```

#### CategoryFilter 컴포넌트
```typescript
interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}
```

### 2. 구매 요청 취합 시스템

#### ConsolidatedRequestView 컴포넌트
```typescript
interface ConsolidatedRequestViewProps {
  requests: MaterialRequest[];
  onPriceUpdate: (materialId: string, newPrice: number) => void;
  onSupplierUpdate: (materialId: string, supplier: string) => void;
}

interface ConsolidatedItem {
  materialId: string;
  materialName: string;
  category: string;
  currentPrice: number;
  supplier: string;
  branchRequests: BranchRequestSummary[];
  totalQuantity: number;
  hasUrgent: boolean;
}

interface BranchRequestSummary {
  branchId: string;
  branchName: string;
  quantity: number;
  urgency: UrgencyLevel;
  requestIds: string[];
}
```

#### ConsolidatedRequestTable 컴포넌트
```typescript
interface ConsolidatedRequestTableProps {
  consolidatedItems: ConsolidatedItem[];
  branches: Branch[];
  onItemEdit: (item: ConsolidatedItem) => void;
  onExport: () => void;
}
```

### 3. 상태 관리 시스템

#### StatusManager 컴포넌트
```typescript
interface StatusManagerProps {
  requestId: string;
  currentStatus: RequestStatus;
  onStatusChange: (newStatus: RequestStatus, note?: string) => void;
  allowedTransitions: RequestStatus[];
}

interface StatusChangeLog {
  id: string;
  requestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  changedBy: string;
  changedAt: Timestamp;
  note?: string;
}
```

### 4. 가격 관리 시스템

#### PriceManager 컴포넌트
```typescript
interface PriceManagerProps {
  materialId: string;
  currentPrice: number;
  onPriceUpdate: (newPrice: number, reason: string) => void;
  priceHistory: PriceHistoryEntry[];
}

interface PriceHistoryEntry {
  id: string;
  materialId: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  changedAt: Timestamp;
  reason: string;
  requestId?: string;
}
```

### 5. 상세 팝업 시스템

#### RequestDetailPopup 컴포넌트
```typescript
interface RequestDetailPopupProps {
  request: MaterialRequest;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<MaterialRequest>) => void;
  userRole: UserRole;
}

interface EditableRequestData {
  supplier?: string;
  estimatedPrice?: number;
  notes?: string;
  status?: RequestStatus;
}
```

### 6. 역할 기반 접근 제어

#### RoleBasedRoute 컴포넌트
```typescript
interface RoleBasedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

enum UserRole {
  BRANCH_USER = 'branch_user',
  HQ_MANAGER = 'hq_manager',
  ADMIN = 'admin'
}

interface UserRoleData {
  userId: string;
  role: UserRole;
  branchId?: string; // 지점 사용자의 경우
  permissions: Permission[];
}

enum Permission {
  CREATE_REQUEST = 'create_request',
  VIEW_ALL_REQUESTS = 'view_all_requests',
  EDIT_PRICES = 'edit_prices',
  CHANGE_STATUS = 'change_status',
  MANAGE_USERS = 'manage_users'
}
```

## 데이터 모델

### 1. 확장된 MaterialRequest
```typescript
interface MaterialRequest {
  // 기존 필드들...
  id: string;
  requestNumber: string;
  branchId: string;
  branchName: string;
  requesterId: string;
  requesterName: string;
  requestedItems: RequestItem[];
  status: RequestStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // 신규 필드들
  consolidatedBatchId?: string; // 취합 배치 ID
  statusHistory: StatusChangeLog[];
  priceUpdates: PriceUpdateLog[];
  assignedManager?: string; // 담당 관리자
  priority: Priority; // 우선순위
}

enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}
```

### 2. ConsolidatedBatch (신규)
```typescript
interface ConsolidatedBatch {
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

enum ConsolidationStatus {
  DRAFT = 'draft',
  REVIEWING = 'reviewing',
  APPROVED = 'approved',
  PURCHASING = 'purchasing',
  COMPLETED = 'completed'
}
```

### 3. PriceHistory (신규)
```typescript
interface PriceHistory {
  id: string;
  materialId: string;
  oldPrice: number;
  newPrice: number;
  changeReason: string;
  changedBy: string;
  changedAt: Timestamp;
  relatedRequestId?: string;
  relatedBatchId?: string;
  approvedBy?: string;
}
```

### 4. UserRole (신규)
```typescript
interface UserRole {
  id: string;
  userId: string;
  role: UserRoleType;
  branchId?: string;
  permissions: Permission[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}
```

## 에러 처리

### 에러 타입 정의
```typescript
enum ErrorCode {
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  INVALID_STATUS_TRANSITION = 'invalid_status_transition',
  PRICE_UPDATE_FAILED = 'price_update_failed',
  CONSOLIDATION_ERROR = 'consolidation_error',
  NOTIFICATION_FAILED = 'notification_failed'
}

interface SystemError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
}
```

### 에러 처리 전략
1. **클라이언트 사이드**: Toast 알림으로 사용자 친화적 메시지 표시
2. **서버 사이드**: 상세 로그 기록 및 관리자 알림
3. **네트워크 오류**: 자동 재시도 메커니즘
4. **권한 오류**: 적절한 접근 제한 안내

## 테스트 전략

### 1. 단위 테스트
- 각 컴포넌트의 렌더링 및 상호작용
- 비즈니스 로직 함수들
- 데이터 변환 및 검증 로직

### 2. 통합 테스트
- Firebase와의 데이터 연동
- 역할 기반 접근 제어
- 실시간 알림 시스템

### 3. E2E 테스트
- 전체 구매 요청 프로세스
- 취합 및 관리 워크플로우
- 다중 사용자 시나리오

### 4. 성능 테스트
- 대량 데이터 처리 성능
- 실시간 업데이트 성능
- 모바일 환경 성능

## 보안 설계

### 1. 인증 및 권한 부여
```typescript
// Firestore Security Rules 예시
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 구매 요청 접근 제어
    match /materialRequests/{requestId} {
      allow read: if isAuthenticated() && 
        (hasRole('hq_manager') || 
         (hasRole('branch_user') && resource.data.branchId == getUserBranch()));
      allow write: if isAuthenticated() && 
        (hasRole('hq_manager') || 
         (hasRole('branch_user') && resource.data.branchId == getUserBranch() && 
          resource.data.status == 'submitted'));
    }
    
    // 가격 이력 접근 제어
    match /priceHistory/{historyId} {
      allow read: if hasRole('hq_manager');
      allow write: if hasRole('hq_manager');
    }
  }
}
```

### 2. 데이터 검증
- 클라이언트와 서버 양쪽에서 데이터 검증
- Zod 스키마를 통한 타입 안전성 보장
- SQL Injection 및 XSS 방지

### 3. 감사 로그
- 모든 중요한 작업에 대한 로그 기록
- 사용자 행동 추적
- 데이터 변경 이력 보관

## 성능 최적화

### 1. 데이터 로딩 최적화
- 페이지네이션을 통한 점진적 로딩
- 필요한 필드만 선택적 로딩
- 캐싱을 통한 중복 요청 방지

### 2. UI 성능 최적화
- React.memo를 통한 불필요한 리렌더링 방지
- 가상화를 통한 대량 데이터 렌더링
- 지연 로딩을 통한 초기 로딩 시간 단축

### 3. 실시간 업데이트 최적화
- WebSocket 연결 풀링
- 변경된 데이터만 전송
- 클라이언트 사이드 캐싱

## 배포 및 모니터링

### 1. 배포 전략
- 단계적 배포 (Canary Deployment)
- 기능 플래그를 통한 점진적 활성화
- 롤백 계획 수립

### 2. 모니터링
- 사용자 행동 분석
- 성능 메트릭 수집
- 오류 추적 및 알림

### 3. 유지보수
- 정기적인 데이터 정리
- 성능 튜닝
- 보안 업데이트