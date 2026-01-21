"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Photo, UploadProgress } from '@/types/album';
import { SupabaseStorageService } from '@/lib/supabase-storage';
import { useAlbums } from './use-albums';

export const usePhotos = (albumId: string) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { updatePhotoCount, updateThumbnail } = useAlbums();

  const mapRowToPhoto = useCallback((row: any): Photo => ({
    id: row.id,
    albumId: row.album_id,
    filename: row.filename,
    originalUrl: row.url,
    thumbnailUrl: row.thumbnail_url,
    previewUrl: row.preview_url,
    order: row.order,
    size: row.size,
    width: row.width,
    height: row.height,
    uploadedAt: row.created_at,
    uploadedBy: row.created_by
  }), []);

  const fetchPhotos = useCallback(async () => {
    if (!albumId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('album_id', albumId)
        .order('order', { ascending: true });

      if (error) throw error;
      setPhotos((data || []).map(mapRowToPhoto));
      setError(null);
    } catch (err) {
      console.error('사진 목록 조회 실패:', err);
      setError('사진 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [albumId, mapRowToPhoto]);

  useEffect(() => {
    if (!albumId || !user) {
      setLoading(false);
      return;
    }
    fetchPhotos();

    const channel = supabase.channel(`photos_${albumId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'photos',
        filter: `album_id=eq.${albumId}`
      }, () => {
        fetchPhotos();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [albumId, user, fetchPhotos]);

  const uploadPhotos = async (files: File[]): Promise<void> => {
    if (!user || !albumId) throw new Error('로그인이 필요합니다.');
    setUploading(true);
    setUploadProgress([]);
    try {
      const currentMaxOrder = photos.length > 0 ? Math.max(...photos.map(p => p.order)) : 0;

      const uploadPromises = files.map(async (file, index) => {
        const validation = SupabaseStorageService.validateFile(file);
        if (!validation.isValid) throw new Error(validation.error);

        const photoId = `photo_${Date.now()}_${index}`;
        const order = currentMaxOrder + index + 1;

        setUploadProgress(prev => [...prev, {
          filename: file.name,
          progress: 10, // Initial progress
          status: 'uploading'
        }]);

        try {
          const urls = await SupabaseStorageService.uploadPhoto(albumId, photoId, file);

          // Get image dimensions
          const img = new Image();
          const { width, height } = await new Promise<{ width: number; height: number }>((resolve) => {
            img.onload = () => resolve({ width: img.width, height: img.height });
            img.src = URL.createObjectURL(file);
          });

          const id = crypto.randomUUID();
          const payload = {
            id,
            album_id: albumId,
            filename: file.name,
            url: urls.originalUrl,
            thumbnail_url: urls.thumbnailUrl,
            preview_url: urls.previewUrl,
            order,
            size: file.size,
            width,
            height,
            created_by: user.id || (user as any).uid,
            created_at: new Date().toISOString()
          };

          const { error: dbError } = await supabase.from('photos').insert([payload]);
          if (dbError) throw dbError;

          setUploadProgress(prev =>
            prev.map(item =>
              item.filename === file.name
                ? { ...item, status: 'completed', progress: 100 }
                : item
            )
          );
        } catch (err) {
          console.error(`사진 업로드 실패 (${file.name}):`, err);
          setUploadProgress(prev =>
            prev.map(item =>
              item.filename === file.name
                ? { ...item, status: 'error', error: err instanceof Error ? err.message : '업로드 실패' }
                : item
            )
          );
        }
      });

      await Promise.allSettled(uploadPromises);

      const { data: countData } = await supabase.from('photos').select('id', { count: 'exact' }).eq('album_id', albumId);
      await updatePhotoCount(albumId, countData?.length || 0);

      // Set thumbnail if first photo
      if (photos.length === 0 && files.length > 0) {
        const { data: firstPhoto } = await supabase
          .from('photos')
          .select('thumbnail_url')
          .eq('album_id', albumId)
          .order('order', { ascending: true })
          .limit(1)
          .single();
        if (firstPhoto) {
          await updateThumbnail(albumId, firstPhoto.thumbnail_url);
        }
      }
    } catch (error) {
      console.error('사진 업로드 실패:', error);
      throw error;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress([]), 3000);
    }
  };

  const deletePhoto = async (photoId: string): Promise<void> => {
    if (!user || !albumId) throw new Error('로그인이 필요합니다.');
    try {
      // 1. Storage에서 삭제 (id가 photoId인 파일을 유추하기 어려울 수 있으나 
      //    여기서는 DB에 저장된 URL이나 filename 혹은 photoId를 기반으로 추측해야 함.
      //    supabase-storage.ts의 deletePhoto는 albumId와 photoId를 받음.)
      await SupabaseStorageService.deletePhoto(albumId, photoId);

      // 2. DB에서 삭제
      const { error } = await supabase.from('photos').delete().eq('id', photoId);
      if (error) throw error;

      // 3. 앨범 정보 업데이트
      const { data: countData } = await supabase.from('photos').select('id', { count: 'exact' }).eq('album_id', albumId);
      await updatePhotoCount(albumId, countData?.length || 0);

      const deletedPhoto = photos.find(p => p.id === photoId);
      if (deletedPhoto && photos.length > 1) {
        const { data: nextThumbnail } = await supabase
          .from('photos')
          .select('thumbnail_url')
          .eq('album_id', albumId)
          .order('order', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (nextThumbnail) {
          await updateThumbnail(albumId, nextThumbnail.thumbnail_url);
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
      const updates = reorderedPhotos.map((photo, index) => ({
        id: photo.id,
        order: index + 1,
        album_id: albumId // partition key if needed
      }));

      const { error } = await supabase.from('photos').upsert(updates);
      if (error) throw error;
    } catch (error) {
      console.error('사진 순서 변경 실패:', error);
      throw new Error('사진 순서 변경에 실패했습니다.');
    }
  };

  return {
    photos, loading, uploading, uploadProgress, error, uploadPhotos, deletePhoto, reorderPhotos
  };
};
