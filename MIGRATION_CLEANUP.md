# Lilymagerp-v4 Migration Cleanup Roadmap

이 문서는 Firebase에서 Supabase로의 마이그레이션이 완료된 후, 시스템 안정화 기간(약 1개월)이 지난 시점에서 제거해야 할 Firebase 잔재들을 정리한 가이드입니다.

- **작성일:** 2026-02-09
- **정리 예정일:** 2026-03-09 이후 (안정화 판단 시)

---

## 1. 코드 내 Firebase 의존성 제거 대상

### 📁 직접 임포트 및 라이브러리 참조
다음 파일들에서 `firebase/firestore` 관련 임포트와 `db` 참조를 제거하고 Supabase 쿼리로 완전히 교체해야 합니다.

- [ ] `src/components/email-template-library.tsx`
- [ ] `src/app/dashboard/purchase-management/reports/branch-usage-report.tsx`
- [ ] `src/app/dashboard/purchase-management/reports/material-usage-report.tsx`
- [ ] `src/app/dashboard/reports/components/year-end-export-dialog.tsx`
- [ ] `src/app/dashboard/simple-expenses/components/expense-list.tsx`
- [ ] `src/app/dashboard/transfers/page.tsx`
- [ ] `src/app/dashboard/transfers/components/transfer-detail-dialog.tsx`

### 📁 데이터 하이브리드 처리 로직 (Wrapper)
Supabase 데이터를 Firebase Timestamp 형식인 것처럼 보이게 하거나, 레거시 상태값을 체크하는 로직들을 정리해야 합니다.

- [ ] `src/lib/date-utils.ts`: `parseDate` 함수 내 Firebase Timestamp 처리 분기 제거
- [ ] `src/lib/order-utils.ts`: `isSettled` 등에서 v3 한글 상태값(`결제완료` 등) 체크 로직 제거
- [ ] `src/app/dashboard/hr/management/page.tsx`: `{ toDate: () => ... }` 와 같은 변환 객체 제거 및 `PrintableHRForm` 등 하위 컴포넌트의 날짜 수신 로직 표준화

---

## 2. 파일 및 스토리지 정리

### 📁 Firebase Storage 참조 제거
- [ ] `src/components/delivery-photo-upload.tsx`: 전송 결과 메시지 및 업로드 제공자 판정 로직에서 Firebase 조건문 삭제
- [ ] `src/lib/firebase-storage.ts`: 해당 파일 삭제 (모든 파일 업로드가 Supabase Storage로 전환된 것을 확인 후)
- [ ] `src/app/dashboard/sample-albums/components/photo-upload.tsx`: 수파베이스 전용 업로드 로직으로 단일화

---

## 3. 타입 시스템 고도화

### 📁 Global Type 정의 파일 수정
다음 파일들은 더 이상 `firebase/firestore`에서 `Timestamp`를 가져오지 않고, 표준 `string`(ISO) 또는 `Date`를 사용하도록 수정해야 합니다.

- [ ] `src/types/user-role.ts`
- [ ] `src/types/order-transfer.ts`
- [ ] `src/types/material-request.ts`
- [ ] `src/types/hr-document.ts`
- [ ] `src/types/expense.ts`
- [ ] `src/types/daily-settlement.ts`
- [ ] `src/types/album.ts`
- [ ] `src/types/checklist.ts`

---

## 4. 인프라 및 설정 파일 정리

### 📁 API 및 동기화 브릿지 삭제
- [ ] `src/app/api/firebase-sync/route.ts`: 데이터 동기화 API 삭제
- [ ] `src/lib/firebase-sync.ts`: 동기화 로직 삭제
- [ ] `src/components/sync-bridge-provider.tsx`: 동기화 공급자 컴포넌트 삭제
- [ ] `src/app/dashboard/settings/components/rebuild-stats.tsx`: 설정 페이지 내 Firebase 동기화 버튼 UI 제거

### 📁 환경 변수 및 패키지
- [ ] `.env`: `NEXT_PUBLIC_FIREBASE_...` 관련 모든 환경 변수 제거
- [ ] `package.json`: `dependencies`에서 `firebase`, `firebase-admin` 라이브러리 제거 (`npm uninstall firebase firebase-admin`)
- [ ] `src/lib/firebase.ts`: Firebase 초기화 설정 파일 삭제

---

## 5. 최종 작업 절차 (Action Plan)

1. **최종 동기화:** `settings/rebuild-stats` 페이지에서 모든 컬렉션에 대해 마지막으로 `Firebase → Supabase` 동기화를 수행합니다.
2. **백업:** Supabase DB 전체를 SQL 덤프로 백업합니다.
3. **코드 수술:** 위 리스트를 바탕으로 하나씩 코드를 수정합니다.
4. **의존성 제거:** `npm uninstall` 실행 후 전체 빌드(`npm run build`)를 통해 깨지는 부분이 없는지 확인합니다.
5. **검증:** 운영 서버 배포 후 1~2일간 모니터링을 거쳐 마이그레이션 프로젝트를 공식 종료합니다.
