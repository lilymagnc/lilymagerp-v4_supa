import { supabase } from './supabase';

export class SupabaseStorageService {
    private static BUCKET_NAME = 'sample-albums';

    private static getPhotoPath(albumId: string, photoId: string, type: 'originals' | 'thumbnails' | 'previews' = 'originals') {
        const path = `${albumId}/${type}/${photoId}`;
        return this.sanitizePath(path);
    }

    private static sanitizePath(path: string): string {
        return path.split('/').map(part =>
            part.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        ).join('/');
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
            const path = this.getPhotoPath(albumId, photoId, 'originals');

            const { data, error } = await supabase.storage
                .from(this.BUCKET_NAME)
                .upload(path, file, {
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl: originalUrl } } = supabase.storage
                .from(this.BUCKET_NAME)
                .getPublicUrl(path);

            // Supabase transformation (if available) or just same URL
            // For now, mirroring Firebase logic where they are same
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
            const path = this.getPhotoPath(albumId, photoId, 'originals');
            const { error } = await supabase.storage
                .from(this.BUCKET_NAME)
                .remove([path]);

            if (error) throw error;
        } catch (error) {
            console.error('Photo deletion failed:', error);
        }
    }

    static async deleteAlbum(albumId: string): Promise<void> {
        try {
            // Supabase Storage doesn't have a direct "delete folder" command for all files.
            // We need to list and delete.
            const { data: files, error: listError } = await supabase.storage
                .from(this.BUCKET_NAME)
                .list(albumId);

            if (listError) throw listError;
            if (!files || files.length === 0) return;

            const pathsToDelete = files.map(file => `${albumId}/${file.name}`);
            const { error: deleteError } = await supabase.storage
                .from(this.BUCKET_NAME)
                .remove(pathsToDelete);

            if (deleteError) throw deleteError;
        } catch (error) {
            console.error('Album deletion failed:', error);
        }
    }

    static validateFile(file: File): { isValid: boolean; error?: string } {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            return {
                isValid: false,
                error: 'JPEG, PNG, WebP 파일만 업로드 가능합니다.'
            };
        }
        if (file.size > 10 * 1024 * 1024) {
            return {
                isValid: false,
                error: '파일 크기는 10MB 이하여야 합니다.'
            };
        }
        return { isValid: true };
    }
}

export async function uploadFile(file: File, bucket: string, path: string): Promise<string> {
    try {
        const sanitizedPath = path.split('/').map(part =>
            part.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        ).join('/');

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(sanitizedPath, file, {
                upsert: true
            });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(sanitizedPath);

        return publicUrl;
    } catch (error) {
        console.error('File upload failed:', error);
        throw new Error('파일 업로드에 실패했습니다.');
    }
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) throw error;
    } catch (error) {
        console.error('File deletion failed:', error);
    }
}
