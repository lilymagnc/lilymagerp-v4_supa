# Design Document

## Overview

샘플앨범 시스템은 Firebase Storage와 Firestore를 활용하여 이미지 중심의 갤러리 기능을 제공합니다. 관리자는 카테고리별로 앨범을 생성하고 사진을 업로드할 수 있으며, 고객은 태블릿 최적화된 인터페이스로 샘플들을 둘러볼 수 있습니다.

## Architecture

### System Architecture
```
Frontend (Next.js)
├── Album List Page (/dashboard/sample-albums)
├── Album Detail Page (/dashboard/sample-albums/[albumId])
├── Photo Viewer Component (Lightbox)
└── Upload Manager Component

Backend (Firebase)
├── Firestore Collections
│   ├── albums (앨범 메타데이터)
│   └── photos (사진 메타데이터)
└── Storage Buckets
    └── sample-albums/ (이미지 파일)
```

### Data Flow
1. **업로드**: 관리자 → Next.js → Firebase Storage → Firestore 메타데이터 저장
2. **조회**: 사용자 → Next.js → Firestore 쿼리 → Storage URL 생성 → 이미지 표시
3. **최적화**: Storage → CDN → 브라우저 캐시

## Components and Interfaces

### 1. Page Components

#### `/dashboard/sample-albums/page.tsx`
- 앨범 목록 그리드 표시
- 카테고리 필터링
- 새 앨범 생성 버튼
- 앨범 검색 기능

#### `/dashboard/sample-albums/[albumId]/page.tsx`
- 개별 앨범의 사진 그리드
- 사진 업로드 드래그 앤 드롭 영역
- 사진 순서 변경 (드래그 앤 드롭)
- 앨범 정보 편집

### 2. Shared Components

#### `AlbumGrid.tsx`
```typescript
interface AlbumGridProps {
  albums: Album[];
  onAlbumClick: (albumId: string) => void;
  onAlbumDelete: (albumId: string) => void;
}
```

#### `PhotoViewer.tsx` (Lightbox)
```typescript
interface PhotoViewerProps {
  photos: Photo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}
```

#### `PhotoUpload.tsx`
```typescript
interface PhotoUploadProps {
  albumId: string;
  onUploadComplete: (photos: Photo[]) => void;
  onUploadProgress: (progress: number) => void;
}
```

#### `PhotoGrid.tsx`
```typescript
interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (index: number) => void;
  onPhotoDelete?: (photoId: string) => void;
  isDraggable?: boolean;
  onReorder?: (photos: Photo[]) => void;
}
```

### 3. Custom Hooks

#### `useAlbums.ts`
```typescript
export const useAlbums = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  
  const createAlbum = async (albumData: CreateAlbumData) => { ... };
  const updateAlbum = async (albumId: string, updates: Partial<Album>) => { ... };
  const deleteAlbum = async (albumId: string) => { ... };
  
  return { albums, loading, createAlbum, updateAlbum, deleteAlbum };
};
```

#### `usePhotos.ts`
```typescript
export const usePhotos = (albumId: string) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const uploadPhotos = async (files: File[]) => { ... };
  const deletePhoto = async (photoId: string) => { ... };
  const reorderPhotos = async (photos: Photo[]) => { ... };
  
  return { photos, uploading, uploadPhotos, deletePhoto, reorderPhotos };
};
```

## Data Models

### Firestore Collections

#### `albums` Collection
```typescript
interface Album {
  id: string;
  title: string;
  description: string;
  category: 'wedding' | 'birthday' | 'memorial' | 'anniversary' | 'other';
  thumbnailUrl?: string;
  photoCount: number;
  isPublic: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // 사용자 ID
}
```

#### `photos` Subcollection (albums/{albumId}/photos)
```typescript
interface Photo {
  id: string;
  filename: string;
  originalUrl: string;    // 원본 이미지 URL
  thumbnailUrl: string;   // 썸네일 URL (200x200)
  previewUrl: string;     // 미리보기 URL (800x600)
  order: number;          // 정렬 순서
  size: number;           // 파일 크기 (bytes)
  width: number;          // 이미지 너비
  height: number;         // 이미지 높이
  uploadedAt: Timestamp;
  uploadedBy: string;     // 업로드한 사용자 ID
}
```

### Firebase Storage Structure
```
/sample-albums/
├── {albumId}/
│   ├── originals/
│   │   ├── {photoId}.jpg
│   │   └── {photoId}.webp
│   ├── thumbnails/
│   │   ├── {photoId}_thumb.jpg
│   │   └── {photoId}_thumb.webp
│   └── previews/
│       ├── {photoId}_preview.jpg
│       └── {photoId}_preview.webp
```

## Error Handling

### Upload Errors
- **파일 크기 초과**: 10MB 제한, 사용자에게 압축 안내
- **지원하지 않는 형식**: JPEG, PNG, WebP만 허용
- **네트워크 오류**: 재시도 버튼 제공
- **Storage 할당량 초과**: 관리자에게 알림

### Display Errors
- **이미지 로딩 실패**: 대체 이미지 표시
- **권한 오류**: 로그인 유도
- **앨범 없음**: 빈 상태 메시지 표시

### Error Boundaries
```typescript
// 각 주요 컴포넌트에 Error Boundary 적용
<ErrorBoundary fallback={<AlbumErrorFallback />}>
  <AlbumGrid albums={albums} />
</ErrorBoundary>
```

## Testing Strategy

### Unit Tests
- **Hooks 테스트**: `useAlbums`, `usePhotos` 훅의 CRUD 기능
- **Component 테스트**: 각 컴포넌트의 렌더링 및 이벤트 처리
- **Utility 테스트**: 이미지 리사이징, URL 생성 함수

### Integration Tests
- **Firebase 연동**: Storage 업로드/다운로드, Firestore CRUD
- **이미지 처리**: 썸네일 생성, 포맷 변환
- **사용자 플로우**: 앨범 생성 → 사진 업로드 → 조회

### E2E Tests
- **관리자 워크플로우**: 앨범 생성부터 사진 업로드까지
- **고객 워크플로우**: 앨범 탐색부터 라이트박스 조회까지
- **반응형 테스트**: 다양한 화면 크기에서의 동작

## Performance Optimization

### Image Optimization
- **자동 리사이징**: Cloud Functions로 업로드 시 자동 처리
- **포맷 최적화**: WebP 우선, JPEG fallback
- **Progressive Loading**: 저화질 → 고화질 순차 로딩

### Loading Optimization
- **Lazy Loading**: Intersection Observer API 활용
- **Skeleton Loading**: 로딩 중 스켈레톤 UI 표시
- **Prefetching**: 다음 페이지 이미지 미리 로딩

### Caching Strategy
- **Browser Cache**: Cache-Control 헤더 설정
- **CDN Cache**: Firebase Storage CDN 활용
- **Memory Cache**: React Query로 메모리 캐싱

## Security Considerations

### Firebase Security Rules
```javascript
// Storage Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /sample-albums/{albumId}/{allPaths=**} {
      allow read: if true; // 공개 읽기
      allow write: if request.auth != null && 
                   request.auth.token.role in ['admin', 'manager'];
    }
  }
}

// Firestore Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /albums/{albumId} {
      allow read: if resource.data.isPublic == true || 
                     request.auth.token.role in ['admin', 'manager'];
      allow write: if request.auth != null && 
                      request.auth.token.role in ['admin', 'manager'];
    }
  }
}
```

### Input Validation
- **파일 타입 검증**: MIME 타입 및 확장자 검사
- **파일 크기 제한**: 클라이언트 및 서버 양쪽에서 검증
- **이미지 내용 검증**: 실제 이미지 파일인지 확인

## UI/UX Design Principles

### Mobile-First Design
- **터치 친화적**: 최소 44px 터치 타겟
- **제스처 지원**: 스와이프, 핀치 줌, 드래그
- **반응형 그리드**: CSS Grid와 Flexbox 활용

### Accessibility
- **키보드 네비게이션**: Tab, Enter, Escape 키 지원
- **스크린 리더**: ARIA 라벨 및 역할 정의
- **고대비 모드**: 색상 대비 4.5:1 이상 유지

### Loading States
- **Progressive Enhancement**: 기본 기능부터 점진적 향상
- **Optimistic Updates**: 사용자 액션 즉시 반영
- **Error Recovery**: 실패 시 재시도 옵션 제공