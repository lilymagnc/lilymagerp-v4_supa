import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Photo, UploadProgress } from '@/types/album';
import { FirebaseStorageService } from '@/lib/firebase-storage';
import { useAlbums } from './use-albums';
export const usePhotos = (albumId: string) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { updatePhotoCount, updateThumbnail } = useAlbums();
  useEffect(() => {
    if (!albumId || !user) {
      setLoading(false);
      return;
    }
    const photosRef = collection(db, 'albums', albumId, 'photos');
    const q = query(photosRef, orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const photosData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Photo[];
        setPhotos(photosData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('사진 목록 조회 실패:', error);
        setError('사진 목록을 불러오는데 실패했습니다.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [albumId, user]);
  const uploadPhotos = async (files: File[]): Promise<void> => {
    if (!user || !albumId) throw new Error('로그인이 필요합니다.');
    setUploading(true);
    setUploadProgress([]);
    try {
      // 현재 사진 개수를 기준으로 order 시작값 설정
      const currentMaxOrder = photos.length > 0 ? Math.max(...photos.map(p => p.order)) : 0;
      const uploadPromises = files.map(async (file, index) => {
        // 파일 검증
        const validation = FirebaseStorageService.validateFile(file);
        if (!validation.isValid) {
          throw new Error(validation.error);
        }
        const photoId = `photo_${Date.now()}_${index}`;
        const order = currentMaxOrder + index + 1;
        // 업로드 진행률 초기화
        setUploadProgress(prev => [...prev, {
          filename: file.name,
          progress: 0,
          status: 'uploading'
        }]);
        try {
          // Storage에 파일 업로드
          const urls = await FirebaseStorageService.uploadPhoto(
            albumId, 
            photoId, 
            file,
            (progress) => {
              setUploadProgress(prev => 
                prev.map(item => 
                  item.filename === file.name 
                    ? { ...item, progress }
                    : item
                )
              );
            }
          );
          // 이미지 메타데이터 추출 (간단한 버전)
          const img = new Image();
          const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = URL.createObjectURL(file);
          });
          // Firestore에 메타데이터 저장
          const photosRef = collection(db, 'albums', albumId, 'photos');
          await addDoc(photosRef, {
            filename: file.name,
            originalUrl: urls.originalUrl,
            thumbnailUrl: urls.thumbnailUrl,
            previewUrl: urls.previewUrl,
            order,
            size: file.size,
            width,
            height,
            uploadedAt: serverTimestamp(),
            uploadedBy: user.uid
          });
          // 업로드 완료 상태 업데이트
          setUploadProgress(prev => 
            prev.map(item => 
              item.filename === file.name 
                ? { ...item, status: 'completed', progress: 100 }
                : item
            )
          );
        } catch (error) {
          console.error(`사진 업로드 실패 (${file.name}):`, error);
          setUploadProgress(prev => 
            prev.map(item => 
              item.filename === file.name 
                ? { ...item, status: 'error', error: error instanceof Error ? error.message : '업로드 실패' }
                : item
            )
          );
        }
      });
      await Promise.allSettled(uploadPromises);
      // 앨범의 사진 개수 업데이트
      const newPhotoCount = photos.length + files.length;
      await updatePhotoCount(albumId, newPhotoCount);
      // 첫 번째 사진이 업로드된 경우 앨범 썸네일 업데이트
      if (photos.length === 0 && files.length > 0) {
        // 첫 번째 업로드된 사진의 썸네일을 앨범 썸네일로 설정
        // 실제로는 업로드 완료 후 URL을 가져와야 하지만, 여기서는 간단히 처리
        setTimeout(async () => {
          const photosSnapshot = await getDocs(
            query(collection(db, 'albums', albumId, 'photos'), orderBy('uploadedAt', 'asc'))
          );
          if (!photosSnapshot.empty) {
            const firstPhoto = photosSnapshot.docs[0].data() as Photo;
            await updateThumbnail(albumId, firstPhoto.thumbnailUrl);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('사진 업로드 실패:', error);
      throw error;
    } finally {
      setUploading(false);
      // 3초 후 업로드 진행률 초기화
      setTimeout(() => setUploadProgress([]), 3000);
    }
  };
  const deletePhoto = async (photoId: string): Promise<void> => {
    if (!user || !albumId) throw new Error('로그인이 필요합니다.');
    try {
      // Firestore에서 문서 삭제만 수행 (Storage 삭제는 무시)
      const photoRef = doc(db, 'albums', albumId, 'photos', photoId);
      await deleteDoc(photoRef);
      // 앨범의 사진 개수 업데이트
      const newPhotoCount = Math.max(0, photos.length - 1);
      await updatePhotoCount(albumId, newPhotoCount);
      // 삭제된 사진이 앨범 썸네일이었다면 새로운 썸네일 설정
      const deletedPhoto = photos.find(p => p.id === photoId);
      if (deletedPhoto && photos.length > 1) {
        const remainingPhotos = photos.filter(p => p.id !== photoId);
        if (remainingPhotos.length > 0) {
          await updateThumbnail(albumId, remainingPhotos[0].thumbnailUrl);
        }
      }
    } catch (error) {
      console.error('사진 삭제 실패:', error);
      throw new Error('사진 삭제에 실패했습니다.');
    }
  };
  const reorderPhotos = async (reorderedPhotos: Photo[]): Promise<void> => {
    if (!user || !albumId) throw new Error('로그인이 필요합니다.');
    try {
      const batch = writeBatch(db);
      reorderedPhotos.forEach((photo, index) => {
        const photoRef = doc(db, 'albums', albumId, 'photos', photo.id);
        batch.update(photoRef, { order: index + 1 });
      });
      await batch.commit();
    } catch (error) {
      console.error('사진 순서 변경 실패:', error);
      throw new Error('사진 순서 변경에 실패했습니다.');
    }
  };
  return {
    photos,
    loading,
    uploading,
    uploadProgress,
    error,
    uploadPhotos,
    deletePhoto,
    reorderPhotos
  };
};
