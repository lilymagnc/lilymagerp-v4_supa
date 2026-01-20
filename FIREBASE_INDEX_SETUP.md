# Firebase 인덱스 설정 안내

## 현재 발생하는 오류
```
FirebaseError: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/lilymagerp-fs1/firestore/indexes?create_composite=...
```

## 해결 방법

### 1. Firebase Console에서 직접 생성
오류 메시지에 포함된 링크를 클릭하여 Firebase Console에서 인덱스를 자동 생성할 수 있습니다.

### 2. 수동으로 인덱스 생성
Firebase Console > Firestore Database > 인덱스 탭에서 다음 인덱스들을 생성하세요:

#### materialRequests 컬렉션 인덱스
1. **지점별 요청 조회용**
   - Collection: `materialRequests`
   - Fields:
     - `branchId` (Ascending)
     - `createdAt` (Descending)
     - `__name__` (Ascending)

2. **상태별 요청 조회용**
   - Collection: `materialRequests`
   - Fields:
     - `status` (Ascending)
     - `createdAt` (Descending)

3. **지점별 상태 조회용**
   - Collection: `materialRequests`
   - Fields:
     - `branchId` (Ascending)
     - `status` (Ascending)
     - `createdAt` (Descending)

### 3. 현재 상태
- 테스트 데이터가 구매 관리 대시보드에서 정상적으로 표시됩니다
- 자재별 취합 뷰와 지점별 요청 뷰가 모두 작동합니다
- 품목 리스트가 제대로 표시되고 장바구니 기능이 구현되어 있습니다

### 4. 인덱스 생성 후
인덱스가 생성되면 테스트 데이터 대신 실제 Firebase 데이터가 로드됩니다.