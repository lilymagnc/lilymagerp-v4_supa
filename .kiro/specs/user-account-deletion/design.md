# 사용자 계정 삭제 기능 설계

## 개요

사용자 관리 시스템에 안전하고 체계적인 사용자 계정 삭제 기능을 구현합니다. 데이터 무결성을 보장하면서도 보안과 사용성을 고려한 설계를 제공합니다.

## 아키텍처

### 전체 구조
```
사용자 관리 페이지
├── 사용자 테이블 (기존)
├── 삭제 버튼 (신규)
├── 삭제 확인 다이얼로그 (신규)
├── 삭제된 사용자 필터 (신규)
└── 복구 기능 (신규)

백엔드 로직
├── 소프트 삭제 처리
├── 권한 검증
├── 데이터 무결성 보장
└── 감사 로그 기록
```

## 컴포넌트 및 인터페이스

### 1. UI 컴포넌트

#### UserDeleteDialog
```typescript
interface UserDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onConfirm: (userId: string) => Promise<void>;
  currentUser: User;
}
```

#### UserTable (수정)
- 기존 테이블에 삭제 버튼 추가
- 삭제된 사용자 표시 스타일 추가
- 복구 버튼 추가 (삭제된 사용자용)

#### UserFilters (수정)
- "삭제된 사용자 포함" 체크박스 추가

### 2. 데이터 모델

#### User 인터페이스 확장
```typescript
interface User {
  // 기존 필드들...
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
}
```

### 3. 훅 함수

#### useUsers 확장
```typescript
interface UseUsersReturn {
  // 기존 함수들...
  deleteUser: (userId: string, reason?: string) => Promise<void>;
  restoreUser: (userId: string) => Promise<void>;
  fetchDeletedUsers: () => Promise<User[]>;
}
```

## 데이터 모델

### Firebase 문서 구조
```json
{
  "users": {
    "userId": {
      "email": "user@example.com",
      "name": "사용자명",
      "role": "직원",
      "franchise": "지점명",
      "isDeleted": false,
      "deletedAt": null,
      "deletedBy": null,
      "deletedReason": null,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 삭제 로그 컬렉션
```json
{
  "userDeletionLogs": {
    "logId": {
      "deletedUserId": "userId",
      "deletedUserEmail": "user@example.com",
      "deletedUserName": "사용자명",
      "deletedBy": "adminUserId",
      "deletedByName": "관리자명",
      "deletedAt": "2024-01-01T00:00:00Z",
      "reason": "퇴사",
      "action": "delete" | "restore"
    }
  }
}
```

## 오류 처리

### 삭제 제한 사항
1. **자기 계정 삭제 방지**
   - 현재 로그인한 사용자는 자신의 계정을 삭제할 수 없음
   - 오류 메시지: "자신의 계정은 삭제할 수 없습니다."

2. **마지막 관리자 보호**
   - 본사 관리자가 1명만 남은 경우 삭제 불가
   - 오류 메시지: "마지막 본사 관리자는 삭제할 수 없습니다."

3. **권한 검증**
   - 본사 관리자만 사용자 삭제 가능
   - 오류 메시지: "사용자 삭제 권한이 없습니다."

### 오류 처리 플로우
```typescript
const validateUserDeletion = (targetUser: User, currentUser: User, allUsers: User[]) => {
  // 권한 검증
  if (currentUser.role !== '본사 관리자') {
    throw new Error('사용자 삭제 권한이 없습니다.');
  }
  
  // 자기 계정 삭제 방지
  if (targetUser.id === currentUser.id) {
    throw new Error('자신의 계정은 삭제할 수 없습니다.');
  }
  
  // 마지막 관리자 보호
  const activeAdmins = allUsers.filter(u => 
    u.role === '본사 관리자' && !u.isDeleted && u.id !== targetUser.id
  );
  if (activeAdmins.length === 0) {
    throw new Error('마지막 본사 관리자는 삭제할 수 없습니다.');
  }
};
```

## 테스팅 전략

### 단위 테스트
1. **삭제 검증 로직**
   - 자기 계정 삭제 방지 테스트
   - 마지막 관리자 보호 테스트
   - 권한 검증 테스트

2. **데이터 변환**
   - 소프트 삭제 플래그 설정 테스트
   - 삭제 메타데이터 저장 테스트

### 통합 테스트
1. **전체 삭제 플로우**
   - UI에서 삭제 버튼 클릭 → 확인 → 삭제 완료
   - 삭제된 사용자 로그인 차단 확인

2. **데이터 무결성**
   - 삭제된 사용자의 기존 기록 보존 확인
   - 관련 데이터 참조 무결성 확인

## 보안 고려사항

### 1. 권한 기반 접근 제어
- 본사 관리자만 삭제 기능 접근 가능
- 프론트엔드와 백엔드 모두에서 권한 검증

### 2. 감사 로그
- 모든 삭제 작업을 별도 컬렉션에 기록
- 삭제한 관리자, 시간, 이유 등 상세 정보 저장

### 3. 소프트 삭제
- 실제 데이터 삭제 대신 플래그 설정
- 데이터 복구 가능성 보장

### 4. 세션 무효화
- 삭제된 사용자의 활성 세션 즉시 무효화
- 로그인 시 삭제 상태 확인

## 성능 최적화

### 1. 쿼리 최적화
- 삭제되지 않은 사용자만 조회하는 기본 쿼리
- 삭제된 사용자 조회는 별도 옵션으로 제공

### 2. 인덱싱
- `isDeleted` 필드에 인덱스 추가
- 복합 인덱스: `isDeleted + role` (관리자 수 확인용)

### 3. 캐싱
- 활성 사용자 목록 캐싱
- 삭제 작업 후 캐시 무효화