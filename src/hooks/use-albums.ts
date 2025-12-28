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
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
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

    const fetchAlbums = async () => {
      try {
        const { data: supabaseAlbums, error: supabaseError } = await supabase
          .from('albums')
          .select('*')
          .order('created_at', { ascending: false });

        if (!supabaseError && supabaseAlbums) {
          const mappedAlbums = supabaseAlbums.map(a => ({
            id: a.id,
            title: a.title,
            description: a.description,
            category: a.category as any,
            thumbnailUrl: a.thumbnail_url,
            photoCount: a.photo_count,
            isPublic: a.is_public,
            branchId: a.branch_id,
            createdBy: a.created_by,
            createdAt: Timestamp.fromDate(new Date(a.created_at)),
            updatedAt: Timestamp.fromDate(new Date(a.updated_at))
          })) as Album[];
          setAlbums(mappedAlbums);
          setLoading(false);
          return;
        }

        const albumsRef = collection(db, 'albums');
        const q = query(albumsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const albumsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Album[];
        setAlbums(albumsData);
      } catch (err) {
        console.error('앨범 목록 조회 실패:', err);
        setError('앨범 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
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

      // [이중 저장: Supabase]
      await supabase.from('albums').insert([{
        id: docRef.id,
        title: albumData.title,
        description: albumData.description,
        category: albumData.category,
        is_public: albumData.isPublic ?? true,
        branch_id: (albumData as any).branchId,
        created_by: user.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

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

      // [이중 저장: Supabase]
      const supabaseUpdates: any = {};
      if (updates.title) supabaseUpdates.title = updates.title;
      if (updates.description !== undefined) supabaseUpdates.description = updates.description;
      if (updates.category) supabaseUpdates.category = updates.category;
      if (updates.isPublic !== undefined) supabaseUpdates.is_public = updates.isPublic;
      if (updates.thumbnailUrl) supabaseUpdates.thumbnail_url = updates.thumbnailUrl;
      if (updates.photoCount !== undefined) supabaseUpdates.photo_count = updates.photoCount;
      supabaseUpdates.updated_at = new Date().toISOString();

      await supabase.from('albums').update(supabaseUpdates).eq('id', albumId);
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

      // [이중 저장: Supabase]
      await supabase.from('albums').delete().eq('id', albumId);
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
