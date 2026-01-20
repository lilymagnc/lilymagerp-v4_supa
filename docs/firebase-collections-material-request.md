# 자재 구매 요청 시스템 Firebase 컬렉션 구조

## 컬렉션 개요

자재 구매 요청 시스템을 위한 Firebase Firestore 컬렉션 구조를 정의합니다.

## 컬렉션 목록

### 1. materialRequests (자재 요청)
**경로**: `/materialRequests/{requestId}`

```typescript
{
  id: string;                    // 문서 ID
  requestNumber: string;         // REQ-20240101-123456
  branchId: string;             // 요청 지점 ID
  branchName: string;           // 요청 지점명
  requesterId: string;          // 요청자 UID
  requesterName: string;        // 요청자명
  
  requestedItems: [             // 요청 품목 배열
    {
      materialId: string;       // 자재 ID
      materialName: string;     // 자재명
      requestedQuantity: number; // 요청 수량
      estimatedPrice: number;   // 예상 가격
      urgency: 'normal' | 'urgent'; // 긴급도
      memo?: string;            // 메모
    }
  ];
  
  status: RequestStatus;        // 요청 상태
  
  actualPurchase?: {            // 실제 구매 정보 (구매 완료 후)
    purchaseDate: Timestamp;
    purchaserId: string;
    purchaserName: string;
    items: ActualPurchaseItem[];
    totalCost: number;
    notes: string;
  };
  
  delivery?: {                  // 배송 정보
    shippingDate: Timestamp;
    deliveryDate?: Timestamp;
    deliveryMethod: string;
    trackingNumber?: string;
    deliveryStatus: 'preparing' | 'shipped' | 'delivered';
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**인덱스**:
- `branchId` (단일)
- `status` (단일)
- `createdAt` (단일)
- `branchId, status` (복합)
- `status, createdAt` (복합)

### 2. purchaseBatches (구매 배치)
**경로**: `/purchaseBatches/{batchId}`

```typescript
{
  id: string;                   // 문서 ID
  batchNumber: string;          // BATCH-20240101-123456
  purchaseDate: Timestamp;      // 구매 날짜
  purchaserId: string;          // 구매자 UID
  purchaserName: string;        // 구매자명
  
  includedRequests: string[];   // 포함된 요청 ID 배열
  
  purchasedItems: [             // 실제 구매 품목 배열
    {
      originalMaterialId: string;
      originalMaterialName: string;
      requestedQuantity: number;
      actualMaterialId?: string;
      actualMaterialName: string;
      actualQuantity: number;
      actualPrice: number;
      totalAmount: number;
      status: PurchaseItemStatus;
      memo: string;
      purchaseDate: Timestamp;
      supplier?: string;
    }
  ];
  
  totalCost: number;            // 총 구매 비용
  
  deliveryPlan: [               // 지점별 배송 계획
    {
      branchId: string;
      branchName: string;
      items: ActualPurchaseItem[];
      estimatedCost: number;
    }
  ];
  
  status: 'planning' | 'purchasing' | 'completed';
  notes: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**인덱스**:
- `purchaseDate` (단일)
- `status` (단일)
- `purchaserId` (단일)

### 3. materials (자재 정보) - 기존 컬렉션 확장
**경로**: `/materials/{materialId}`

기존 자재 정보에 구매 관련 필드 추가:
```typescript
{
  // ... 기존 필드들
  
  // 구매 관련 추가 필드
  suppliers?: string[];         // 공급업체 목록
  averagePrice?: number;        // 평균 구매 가격
  lastPurchasePrice?: number;   // 최근 구매 가격
  lastPurchaseDate?: Timestamp; // 최근 구매 날짜
  purchaseUnit?: string;        // 구매 단위
  minimumOrderQuantity?: number; // 최소 주문 수량
}
```

### 4. stockHistory (재고 변동 기록) - 기존 컬렉션 확장
**경로**: `/stockHistory/{historyId}`

자재 구매 요청으로 인한 재고 변동 기록:
```typescript
{
  // ... 기존 필드들
  
  // 구매 요청 관련 추가 필드
  relatedRequestId?: string;    // 관련 요청 ID
  relatedBatchId?: string;      // 관련 배치 ID
  purchasePrice?: number;       // 구매 가격 (입고 시)
}
```

### 5. expenses (비용 기록) - 기존 컬렉션 확장
**경로**: `/expenses/{expenseId}`

자재 구매 비용 자동 기록:
```typescript
{
  // ... 기존 필드들
  
  // 구매 요청 관련 추가 필드
  relatedRequestId?: string;    // 관련 요청 ID
  relatedBatchId?: string;      // 관련 배치 ID
  materialItems?: [             // 구매한 자재 목록
    {
      materialId: string;
      materialName: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
    }
  ];
}
```

### 6. notifications (알림) - 새 컬렉션
**경로**: `/notifications/{notificationId}`

```typescript
{
  id: string;                   // 문서 ID
  type: 'material_request';     // 알림 타입
  subType: 'request_submitted' | 'purchase_completed' | 
           'shipping_started' | 'delivery_requested' |
           'urgent_request';    // 세부 타입
  
  title: string;                // 알림 제목
  message: string;              // 알림 내용
  
  userId?: string;              // 특정 사용자 대상
  branchId?: string;            // 특정 지점 대상
  role?: string;                // 특정 역할 대상
  
  relatedRequestId?: string;    // 관련 요청 ID
  relatedBatchId?: string;      // 관련 배치 ID
  
  isRead: boolean;              // 읽음 여부
  readAt?: Timestamp;           // 읽은 시간
  
  createdAt: Timestamp;
}
```

**인덱스**:
- `userId` (단일)
- `branchId` (단일)
- `role` (단일)
- `isRead` (단일)
- `createdAt` (단일)
- `userId, isRead` (복합)
- `branchId, isRead` (복합)

## 보안 규칙 요약

### 권한 구조
- **본사 (admin, purchaser)**: 모든 요청 조회/수정, 배치 관리
- **지점 (branch)**: 자신의 지점 요청만 생성/조회
- **공통**: 자재 정보, 지점 정보 조회

### 주요 보안 규칙
1. **materialRequests**: 지점은 자신의 요청만, 본사는 모든 요청
2. **purchaseBatches**: 본사만 접근 가능
3. **비용 정보**: 본사는 모든 정보, 지점은 자신의 정보만
4. **알림**: 본인 또는 본인 지점 알림만 조회

## 데이터 플로우

### 1. 요청 생성 플로우
```
지점 요청 → materialRequests 생성 → 본사 알림 생성
```

### 2. 구매 처리 플로우
```
요청 취합 → purchaseBatches 생성 → 실제 구매 입력 → 
materialRequests 업데이트 → 지점 알림 생성
```

### 3. 배송 및 입고 플로우
```
배송 시작 → materialRequests.delivery 업데이트 → 
입고 확인 → stockHistory 생성 → expenses 생성
```

## 성능 최적화

### 1. 인덱스 전략
- 자주 조회되는 필드 조합에 대한 복합 인덱스
- 시간 기반 정렬을 위한 createdAt 인덱스

### 2. 쿼리 최적화
- 지점별 요청 조회 시 branchId 필터 우선 적용
- 상태별 요청 조회 시 status 필터 활용
- 페이지네이션을 위한 limit 및 startAfter 활용

### 3. 데이터 구조 최적화
- 중복 데이터 최소화 (정규화)
- 자주 함께 조회되는 데이터는 비정규화 고려
- 배열 필드의 크기 제한 (Firestore 1MB 제한 고려)