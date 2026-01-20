# 자재 구매 요청 시스템 설계

## 개요

실제 꽃 시장의 특성을 반영한 자재 구매 요청 시스템을 설계합니다. 지점의 간편한 요청부터 본사의 실제 구매, 자동 재고 연동, 비용 관리까지 완전한 자재 관리 생태계를 구축합니다.

## 아키텍처

### 전체 시스템 구조
```
🏪 지점 사이드
├── 자재 요청 인터페이스
├── 요청 상태 추적
├── 입고 확인
└── 재고 현황 확인

🏢 본사 사이드  
├── 요청 취합 대시보드
├── 구매 관리 인터페이스
├── 배송 관리
└── 비용 관리

🔄 자동 연동
├── 재고 자동 업데이트
├── 비용 자동 기록
├── 알림 시스템
└── 보고서 생성
```

## 컴포넌트 및 인터페이스

### 1. 지점 사이드 컴포넌트

#### MaterialRequestPage
```typescript
// 자재 요청 메인 페이지
interface MaterialRequestPageProps {
  branchName: string;
  availableMaterials: Material[];
}
```

#### MaterialRequestCart
```typescript
// 장바구니 방식 요청 컴포넌트
interface RequestItem {
  materialId: string;
  materialName: string;
  requestedQuantity: number;
  estimatedPrice: number;
  urgency: 'normal' | 'urgent';
  memo?: string;
}

interface MaterialRequestCartProps {
  items: RequestItem[];
  onAddItem: (item: RequestItem) => void;
  onUpdateQuantity: (materialId: string, quantity: number) => void;
  onRemoveItem: (materialId: string) => void;
  onSubmitRequest: () => void;
}
```

#### RequestStatusTracker
```typescript
// 요청 상태 추적 컴포넌트
interface RequestStatus {
  requestId: string;
  status: 'submitted' | 'reviewing' | 'purchasing' | 'purchased' | 'shipping' | 'delivered' | 'completed';
  createdAt: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
}
```

### 2. 본사 사이드 컴포넌트

#### PurchaseRequestDashboard
```typescript
// 요청 취합 대시보드
interface PurchaseRequestDashboardProps {
  pendingRequests: MaterialRequest[];
  consolidatedItems: ConsolidatedItem[];
  onStartPurchasing: (requestIds: string[]) => void;
}

interface ConsolidatedItem {
  materialId: string;
  materialName: string;
  totalQuantity: number;
  requestingBranches: {
    branchName: string;
    quantity: number;
    urgency: string;
  }[];
  estimatedTotalCost: number;
}
```

#### ActualPurchaseForm
```typescript
// 실제 구매 내역 입력 폼
interface ActualPurchaseItem {
  originalMaterialId: string;
  originalMaterialName: string;
  requestedQuantity: number;
  
  actualMaterialId?: string; // 대체품인 경우
  actualMaterialName: string;
  actualQuantity: number;
  actualPrice: number;
  totalAmount: number;
  
  status: 'purchased' | 'unavailable' | 'substituted' | 'partial';
  memo: string;
  purchaseDate: string;
  supplier?: string;
}
```

### 3. 데이터 모델

#### MaterialRequest (요청 정보)
```typescript
interface MaterialRequest {
  id: string;
  requestNumber: string; // REQ-2024-001
  branchId: string;
  branchName: string;
  requesterId: string;
  requesterName: string;
  
  requestedItems: RequestItem[];
  status: RequestStatus;
  
  // 실제 구매 정보
  actualPurchase?: {
    purchaseDate: string;
    purchaserId: string;
    purchaserName: string;
    items: ActualPurchaseItem[];
    totalCost: number;
    notes: string;
  };
  
  // 배송 정보
  delivery?: {
    shippingDate: string;
    deliveryDate?: string;
    deliveryMethod: string;
    trackingNumber?: string;
  };
  
  createdAt: string;
  updatedAt: string;
}
```

#### PurchaseBatch (구매 배치)
```typescript
interface PurchaseBatch {
  id: string;
  batchNumber: string; // BATCH-2024-001
  purchaseDate: string;
  purchaserId: string;
  
  // 포함된 요청들
  includedRequests: string[];
  
  // 실제 구매 내역
  purchasedItems: ActualPurchaseItem[];
  totalCost: number;
  
  // 지점별 배송 계획
  deliveryPlan: {
    branchId: string;
    branchName: string;
    items: ActualPurchaseItem[];
    estimatedCost: number;
  }[];
  
  status: 'planning' | 'purchasing' | 'completed';
  notes: string;
}
```

## 데이터 플로우

### 1. 요청 플로우
```
지점 요청 생성 → materialRequests 컬렉션 저장 → 본사 알림
```

### 2. 구매 플로우
```
요청 취합 → 구매 배치 생성 → 실제 구매 → 구매 내역 입력 → 배송 계획 생성
```

### 3. 배송 및 입고 플로우
```
배송 시작 → 지점 알림 → 입고 확인 → 재고 자동 업데이트 → 재고 변동 기록
```

### 4. 비용 연동 플로우
```
실제 구매 비용 → expenses 컬렉션 자동 기록 → 지점별 비용 배분
```

## 상태 관리

### 요청 상태 전이
```
submitted (제출됨)
    ↓
reviewing (검토중)
    ↓
purchasing (구매중)
    ↓
purchased (구매완료)
    ↓
shipping (배송중)
    ↓
delivered (배송완료)
    ↓
completed (완료)
```

### 예외 상태 처리
```
unavailable (구매불가)
substituted (대체품)
partial (부분구매)
cancelled (취소)
```

## 알림 시스템

### 지점 알림
- 요청 접수 확인
- 구매 완료 알림 (실제 구매 내역 포함)
- 배송 시작 알림
- 입고 요청 알림

### 본사 알림
- 새 요청 접수 알림
- 긴급 요청 알림
- 구매 마감 알림

## 보고서 및 분석

### 구매 분석 리포트
- 지점별 자재 사용량 분석
- 자재별 구매 빈도 및 비용 분석
- 구매 효율성 분석 (요청 vs 실제)
- 공급업체별 구매 현황

### 비용 분석 리포트
- 지점별 자재비 현황
- 월별 구매 비용 트렌드
- 예산 대비 실적 분석

## 오류 처리

### 요청 단계 오류
- 재고 부족으로 인한 요청 제한
- 중복 요청 방지
- 권한 없는 요청 차단

### 구매 단계 오류
- 구매 불가 품목 처리
- 예산 초과 경고
- 공급업체 연락 불가

### 시스템 오류
- 네트워크 오류 시 오프라인 모드
- 데이터 동기화 오류 복구
- 백업 및 복원 시스템

## 성능 최적화

### 데이터베이스 최적화
- 요청 상태별 인덱싱
- 지점별 요청 조회 최적화
- 구매 배치 단위 처리

### 실시간 업데이트
- WebSocket을 통한 실시간 상태 업데이트
- 푸시 알림 시스템
- 캐싱을 통한 응답 속도 개선

## 보안 고려사항

### 권한 관리
- 지점별 요청 권한 제한
- 본사 구매 권한 관리
- 비용 정보 접근 제한

### 데이터 보안
- 구매 가격 정보 암호화
- 공급업체 정보 보호
- 감사 로그 기록