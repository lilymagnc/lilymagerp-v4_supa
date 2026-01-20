# Firebase Collections - 주문 이관 시스템

## 1. order_transfers 컬렉션

주문 이관 정보를 저장하는 컬렉션입니다.

### 문서 구조
```typescript
{
  id: string; // 자동 생성
  originalOrderId: string; // 원본 주문 ID
  orderBranchId: string; // 발주지점 ID
  orderBranchName: string; // 발주지점명
  processBranchId: string; // 수주지점 ID
  processBranchName: string; // 수주지점명
  transferDate: Timestamp; // 이관 요청일
  transferReason: string; // 이관 사유
  transferBy: string; // 이관한 사용자 ID
  transferByUser: string; // 이관한 사용자 이름
  status: 'pending' | 'accepted' | 'rejected' | 'completed'; // 이관 상태
  amountSplit: {
    orderBranch: number; // 발주지점 금액
    processBranch: number; // 수주지점 금액
  };
  originalOrderAmount: number; // 원본 주문 금액
  notes?: string; // 추가 메모
  acceptedAt?: Timestamp; // 수락일
  acceptedBy?: string; // 수락한 사용자 ID
  rejectedAt?: Timestamp; // 거절일
  rejectedBy?: string; // 거절한 사용자 ID
  completedAt?: Timestamp; // 완료일
  completedBy?: string; // 완료한 사용자 ID
  createdAt: Timestamp; // 생성일
  updatedAt: Timestamp; // 수정일
}
```

### 인덱스
```javascript
// processBranchId + status (수주지점별 대기 중인 이관 조회)
{
  collectionGroup: "order_transfers",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "processBranchId", order: "ASCENDING" },
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "transferDate", order: "DESCENDING" }
  ]
}

// orderBranchId + status (발주지점별 이관 내역 조회)
{
  collectionGroup: "order_transfers",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "orderBranchId", order: "ASCENDING" },
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "transferDate", order: "DESCENDING" }
  ]
}

// status + transferDate (전체 이관 내역 조회)
{
  collectionGroup: "order_transfers",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "transferDate", order: "DESCENDING" }
  ]
}
```

## 2. notifications 컬렉션

실시간 알림 정보를 저장하는 컬렉션입니다.

### 문서 구조
```typescript
{
  id: string; // 자동 생성
  type: 'order_transfer' | 'new_order' | 'delivery_complete'; // 알림 유형
  message: string; // 알림 메시지
  branchId: string; // 대상 지점 ID
  branchName: string; // 대상 지점명
  createdAt: Timestamp; // 생성일
  isRead: boolean; // 읽음 여부
  transferId?: string; // 주문 이관 관련 알림인 경우
  orderId?: string; // 주문 관련 알림인 경우
  priority: 'high' | 'medium' | 'low'; // 우선순위
  expiresAt?: Timestamp; // 만료일
}
```

### 인덱스
```javascript
// branchId + isRead + createdAt (지점별 읽지 않은 알림 조회)
{
  collectionGroup: "notifications",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "branchId", order: "ASCENDING" },
    { fieldPath: "isRead", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" }
  ]
}

// type + createdAt (알림 유형별 조회)
{
  collectionGroup: "notifications",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "type", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" }
  ]
}
```

## 3. display_board 컬렉션

전광판 표시 정보를 저장하는 컬렉션입니다.

### 문서 구조
```typescript
{
  id: string; // 자동 생성
  type: 'order_transfer' | 'new_order' | 'delivery_complete' | 'pickup_ready'; // 표시 유형
  title: string; // 제목
  content: string; // 내용
  branchId: string; // 대상 지점 ID
  branchName: string; // 대상 지점명
  priority: 'high' | 'medium' | 'low'; // 우선순위
  createdAt: Timestamp; // 생성일
  expiresAt: Timestamp; // 만료일
  isActive: boolean; // 활성화 여부
  transferId?: string; // 주문 이관 관련 전광판인 경우
  orderId?: string; // 주문 관련 전광판인 경우
  displayDuration: number; // 표시 시간 (분)
}
```

### 인덱스
```javascript
// branchId + isActive + priority + createdAt (지점별 활성 전광판 조회)
{
  collectionGroup: "display_board",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "branchId", order: "ASCENDING" },
    { fieldPath: "isActive", order: "ASCENDING" },
    { fieldPath: "priority", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" }
  ]
}

// isActive + expiresAt (만료된 전광판 정리용)
{
  collectionGroup: "display_board",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "isActive", order: "ASCENDING" },
    { fieldPath: "expiresAt", order: "ASCENDING" }
  ]
}
```

## 4. 기존 orders 컬렉션 수정

기존 주문 컬렉션에 이관 관련 필드를 추가합니다.

### 추가 필드
```typescript
// orders 컬렉션에 추가할 필드
{
  // ... 기존 필드들
  transferInfo?: {
    isTransferred: boolean; // 이관 여부
    transferId?: string; // 이관 ID
    originalBranchId?: string; // 원본 지점 ID
    originalBranchName?: string; // 원본 지점명
    transferredAt?: Timestamp; // 이관일
  };
}
```

## 5. 보안 규칙 (Firestore Rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 주문 이관 컬렉션
    match /order_transfers/{transferId} {
      allow read: if request.auth != null && (
        resource.data.orderBranchId == getUserBranch() ||
        resource.data.processBranchId == getUserBranch() ||
        getUserRole() == '본사 관리자'
      );
      allow create: if request.auth != null && (
        resource.data.orderBranchId == getUserBranch() ||
        getUserRole() == '본사 관리자'
      );
      allow update: if request.auth != null && (
        resource.data.processBranchId == getUserBranch() ||
        getUserRole() == '본사 관리자'
      );
    }
    
    // 알림 컬렉션
    match /notifications/{notificationId} {
      allow read: if request.auth != null && (
        resource.data.branchId == getUserBranch() ||
        getUserRole() == '본사 관리자'
      );
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        resource.data.branchId == getUserBranch() ||
        getUserRole() == '본사 관리자'
      );
    }
    
    // 전광판 컬렉션
    match /display_board/{boardId} {
      allow read: if request.auth != null && (
        resource.data.branchId == getUserBranch() ||
        getUserRole() == '본사 관리자'
      );
      allow create, update: if request.auth != null && getUserRole() == '본사 관리자';
    }
    
    // 헬퍼 함수
    function getUserBranch() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.franchise;
    }
    
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
  }
}
```

## 6. 데이터 마이그레이션

### 기존 주문 데이터에 이관 정보 추가
```javascript
// 기존 주문에 transferInfo 필드 추가 (기본값: null)
const migrateOrders = async () => {
  const ordersRef = collection(db, 'orders');
  const snapshot = await getDocs(ordersRef);
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => {
    if (!doc.data().transferInfo) {
      batch.update(doc.ref, {
        transferInfo: null
      });
    }
  });
  
  await batch.commit();
};
```

## 7. 성능 최적화

### 1. 인덱스 최적화
- 자주 조회되는 필드 조합에 대한 복합 인덱스 생성
- 지점별 필터링을 위한 인덱스 최적화

### 2. 쿼리 최적화
- 페이지네이션 적용 (limit, offset)
- 필요한 필드만 선택적으로 조회
- 실시간 리스너 최소화

### 3. 캐싱 전략
- 자주 조회되는 설정 정보 캐싱
- 지점별 알림 정보 캐싱
- 전광판 정보 캐싱

## 8. 모니터링 및 로깅

### 1. 성능 모니터링
- 쿼리 실행 시간 모니터링
- 인덱스 사용률 모니터링
- 읽기/쓰기 작업량 모니터링

### 2. 오류 로깅
- 이관 프로세스 오류 로깅
- 알림 발송 실패 로깅
- 권한 오류 로깅

### 3. 사용 통계
- 일별/월별 이관 건수
- 지점별 이관 통계
- 알림 발송 통계
