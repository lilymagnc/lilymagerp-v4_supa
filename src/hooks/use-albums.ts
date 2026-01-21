"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { Album, CreateAlbumData } from '@/types/album';
import { SupabaseStorageService } from '@/lib/supabase-storage';

export const useAlbums = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const mapRowToAlbum = (row: any): Album => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    photoCount: row.photo_count,
    isPublic: row.is_public,
    thumbnailUrl: row.thumbnail_url,
    branchId: row.branch_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchAlbums = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlbums((data || []).map(mapRowToAlbum));
      setError(null);
    } catch (err) {
      console.error('앨범 목록 조회 실패:', err);
      setError('앨범 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchAlbums();
    }
  }, [user, fetchAlbums]);

  const createAlbum = async (albumData: CreateAlbumData): Promise<string> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    try {
      const id = crypto.randomUUID();
      const payload = {
        id,
        title: albumData.title,
        description: albumData.description,
        category: albumData.category,
        photo_count: 0,
        is_public: albumData.isPublic ?? true,
        branch_id: albumData.branchId,
        created_by: user.id || (user as any).uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('albums').insert([payload]);
      if (error) throw error;

      await fetchAlbums();
      return id;
    } catch (error) {
      console.error('앨범 생성 실패:', error);
      throw new Error('앨범 생성에 실패했습니다.');
    }
  };

  const updateAlbum = async (albumId: string, updates: Partial<Album>): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.title) payload.title = updates.title;
      if (updates.description) payload.description = updates.description;
      if (updates.category) payload.category = updates.category;
      if (updates.photoCount !== undefined) payload.photo_count = updates.photoCount;
      if (updates.isPublic !== undefined) payload.is_public = updates.isPublic;
      if (updates.thumbnailUrl) payload.thumbnail_url = updates.thumbnailUrl;

      const { error } = await supabase.from('albums').update(payload).eq('id', albumId);
      if (error) throw error;

      await fetchAlbums();
    } catch (error) {
      console.error('앨범 수정 실패:', error);
      throw new Error('앨범 수정에 실패했습니다.');
    }
  };

  const deleteAlbum = async (albumId: string): Promise<void> => {
    if (!user) throw new Error('로그인이 필요합니다.');
    try {
      // 1. Storage에서 앨범 폴더 삭제
      await SupabaseStorageService.deleteAlbum(albumId);

      // 2. 앨범 문서 삭제 (CASCADE 설정으로 사진 테이블은 자동 삭제됨)
      const { error } = await supabase.from('albums').delete().eq('id', albumId);
      if (error) throw error;

      await fetchAlbums();
    } catch (error) {
      console.error('앨범 삭제 실패:', error);
      throw new Error('앨범 삭제에 실패했습니다.');
    }
  };

  const updatePhotoCount = async (albumId: string, count: number): Promise<void> => {
    try {
      const { error } = await supabase.from('albums').update({
        photo_count: count,
        updated_at: new Date().toISOString()
      }).eq('id', albumId);
      if (error) throw error;
    } catch (error) {
      console.error('사진 개수 업데이트 실패:', error);
    }
  };

  const updateThumbnail = async (albumId: string, thumbnailUrl: string): Promise<void> => {
    try {
      const { error } = await supabase.from('albums').update({
        thumbnail_url: thumbnailUrl,
        updated_at: new Date().toISOString()
      }).eq('id', albumId);
      if (error) throw error;
    } catch (error) {
      console.error('썸네일 업데이트 실패:', error);
    }
  };

  return {
    albums, loading, error, createAlbum, updateAlbum, deleteAlbum, updatePhotoCount, updateThumbnail
  };
};
