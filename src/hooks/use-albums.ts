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
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Album, CreateAlbumData } from '@/types/album';
import { FirebaseStorageService } from '@/lib/firebase-storage';
export const useAlbums = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const albumsRef = collection(db, 'albums');
    const q = query(albumsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const albumsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Album[];
        setAlbums(albumsData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('앨범 목록 조회 실패:', error);
        setError('앨범 목록을 불러오는데 실패했습니다.');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);
  const createAlbum = async (albumData: CreateAlbumData): Promise<string> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    try {
      const albumsRef = collection(db, 'albums');
      const docRef = await addDoc(albumsRef, {
        ...albumData,
        photoCount: 0,
        isPublic: albumData.isPublic ?? true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid
      });
      return docRef.id;
    } catch (error) {
      console.error('앨범 생성 실패:', error);
      throw new Error('앨범 생성에 실패했습니다.');
    }
  };
  const updateAlbum = async (albumId: string, updates: Partial<Album>): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    try {
      const albumRef = doc(db, 'albums', albumId);
      await updateDoc(albumRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('앨범 수정 실패:', error);
      throw new Error('앨범 수정에 실패했습니다.');
    }
  };
  const deleteAlbum = async (albumId: string): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    try {
      // 1. 앨범의 모든 사진 삭제 (Firestore + Storage)
      const photosRef = collection(db, 'albums', albumId, 'photos');
      const photosSnapshot = await getDocs(photosRef);
      const deletePromises = photosSnapshot.docs.map(async (photoDoc) => {
        // Firestore에서 사진 문서 삭제
        await deleteDoc(photoDoc.ref);
        // Storage에서 사진 파일 삭제 (404 에러는 무시)
        try {
          await FirebaseStorageService.deletePhoto(albumId, photoDoc.id);
        } catch (storageError: any) {
          // Storage 파일이 없어도 무시
          if (storageError.code !== 'storage/object-not-found') {
            console.error('Storage 파일 삭제 실패:', storageError);
          }
        }
      });
      await Promise.all(deletePromises);
      // 2. Storage에서 앨범 폴더 삭제 (404 에러는 무시)
      try {
        await FirebaseStorageService.deleteAlbum(albumId);
      } catch (storageError: any) {
        // Storage 폴더가 없어도 무시
        if (storageError.code !== 'storage/object-not-found') {
          console.error('Storage 앨범 폴더 삭제 실패:', storageError);
        }
      }
      // 3. 앨범 문서 삭제
      const albumRef = doc(db, 'albums', albumId);
      await deleteDoc(albumRef);
    } catch (error) {
      console.error('앨범 삭제 실패:', error);
      throw new Error('앨범 삭제에 실패했습니다.');
    }
  };
  const updatePhotoCount = async (albumId: string, count: number): Promise<void> => {
    try {
      const albumRef = doc(db, 'albums', albumId);
      await updateDoc(albumRef, {
        photoCount: count,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('사진 개수 업데이트 실패:', error);
    }
  };
  const updateThumbnail = async (albumId: string, thumbnailUrl: string): Promise<void> => {
    try {
      const albumRef = doc(db, 'albums', albumId);
      await updateDoc(albumRef, {
        thumbnailUrl,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('썸네일 업데이트 실패:', error);
    }
  };
  return {
    albums,
    loading,
    error,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    updatePhotoCount,
    updateThumbnail
  };
};
