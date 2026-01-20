import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  getMetadata
} from 'firebase/storage';
import { storage } from './firebase';
export class FirebaseStorageService {
  private static getAlbumPath(albumId: string) {
    return `sample-albums/${albumId}`;
  }
  private static getPhotoPath(albumId: string, photoId: string, type: 'original' | 'thumbnail' | 'preview' = 'original') {
    const basePath = this.getAlbumPath(albumId);
    switch (type) {
      case 'thumbnail':
        return `${basePath}/thumbnails/${photoId}`;
      case 'preview':
        return `${basePath}/previews/${photoId}`;
      default:
        return `${basePath}/originals/${photoId}`;
    }
  }
  static async uploadPhoto(
    albumId: string, 
    photoId: string, 
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{
    originalUrl: string;
    thumbnailUrl: string;
    previewUrl: string;
  }> {
    try {
      // 원본 이미지 업로드
      const originalRef = ref(storage, this.getPhotoPath(albumId, photoId, 'original'));
      const originalSnapshot = await uploadBytes(originalRef, file);
      const originalUrl = await getDownloadURL(originalSnapshot.ref);
      // 썸네일과 미리보기는 원본 URL을 사용 (향후 Cloud Functions에서 자동 생성 예정)
      const thumbnailUrl = originalUrl;
      const previewUrl = originalUrl;
      return {
        originalUrl,
        thumbnailUrl,
        previewUrl
      };
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw new Error('사진 업로드에 실패했습니다.');
    }
  }
  static async deletePhoto(albumId: string, photoId: string): Promise<void> {
    try {
      // 원본 파일 삭제 시도
      const originalRef = ref(storage, this.getPhotoPath(albumId, photoId, 'original'));
      await deleteObject(originalRef);
    } catch (error: any) {
      // 파일이 존재하지 않는 경우 무시
      if (error.code !== 'storage/object-not-found') {
        throw error;
      }
    }
  }
  static async deleteAlbum(albumId: string): Promise<void> {
    try {
      const albumRef = ref(storage, this.getAlbumPath(albumId));
      const listResult = await listAll(albumRef);
      // 모든 하위 파일 삭제
      const deletePromises = listResult.items.map(item => deleteObject(item));
      await Promise.all(deletePromises);
      // 하위 폴더들도 삭제
      for (const folder of listResult.prefixes) {
        const folderList = await listAll(folder);
        const folderDeletePromises = folderList.items.map(item => deleteObject(item));
        await Promise.all(folderDeletePromises);
      }
    } catch (error: any) {
      // 폴더가 존재하지 않는 경우 무시
      if (error.code !== 'storage/object-not-found') {
        console.error('Album deletion failed:', error);
        throw new Error('앨범 삭제에 실패했습니다.');
      }
    }
  }
  static validateFile(file: File): { isValid: boolean; error?: string } {
    // 파일 타입 검증
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return {
        isValid: false,
        error: 'JPEG, PNG, WebP 파일만 업로드 가능합니다.'
      };
    }
    // 파일 크기 검증 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return {
        isValid: false,
        error: '파일 크기는 10MB 이하여야 합니다.'
      };
    }
    return { isValid: true };
  }
}

// 일반적인 파일 업로드 함수
export async function uploadFile(file: File, filePath: string): Promise<string> {
  try {
    const fileRef = ref(storage, filePath);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error('File upload failed:', error);
    throw new Error('파일 업로드에 실패했습니다.');
  }
}

// 일반적인 파일 삭제 함수
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    // Firebase Storage URL에서 파일 경로 추출
    let filePath: string;
    
    if (fileUrl.includes('firebase')) {
      // Firebase Storage URL에서 파일 경로 추출
      const url = new URL(fileUrl);
      const pathname = url.pathname;
      // /v0/b/bucket/o/path 형식에서 path 추출
      const pathMatch = pathname.match(/\/o\/(.+)$/);
      if (pathMatch) {
        filePath = decodeURIComponent(pathMatch[1]);
      } else {
        throw new Error('Invalid Firebase Storage URL');
      }
    } else {
      // 상대 경로인 경우 그대로 사용
      filePath = fileUrl;
    }
    
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
  } catch (error: any) {
    // 파일이 존재하지 않는 경우 무시
    if (error.code !== 'storage/object-not-found') {
      console.error('File deletion failed:', error);
      throw new Error('파일 삭제에 실패했습니다.');
    }
  }
}
