'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Upload, Edit, Trash2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { PhotoGrid } from '../components/photo-grid';
import { PhotoUpload } from '../components/photo-upload';
import { PhotoViewer } from '../components/photo-viewer';
import { useAlbums } from '@/hooks/use-albums';
import { usePhotos } from '@/hooks/use-photos';
import { cacheAlbumPhotos } from '@/lib/image-cache';
import { useToast } from '@/hooks/use-toast';
export default function AlbumDetailPage() {
  const params = useParams();
  const router = useRouter();
  const albumId = params.albumId as string;
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const { albums, deleteAlbum } = useAlbums();
  const { photos, loading, uploadPhotos, deletePhoto, reorderPhotos } = usePhotos(albumId);
  const { toast } = useToast();
  const album = albums.find(a => a.id === albumId);
  const handleDeleteAlbum = async () => {
    if (confirm('앨범을 삭제하시겠습니까? 모든 사진이 함께 삭제됩니다.')) {
      try {
        await deleteAlbum(albumId);
        router.push('/dashboard/sample-albums');
      } catch (error) {
        console.error('앨범 삭제 실패:', error);
      }
    }
  };
  const handleDeletePhoto = async (photoId: string) => {
    if (confirm('사진을 삭제하시겠습니까?')) {
      try {
        await deletePhoto(photoId);
      } catch (error) {
        console.error('사진 삭제 실패:', error);
      }
    }
  };
  const handlePhotoUpload = async (files: File[]) => {
    try {
      await uploadPhotos(files);
      setIsUploadOpen(false);
    } catch (error) {
      console.error('사진 업로드 실패:', error);
    }
  };

  const handleDownloadAll = async () => {
    if (!photos.length) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      const urls = photos.flatMap(p => [p.originalUrl, p.previewUrl]).filter(Boolean) as string[];
      await cacheAlbumPhotos(urls, (current, total) => {
        setDownloadProgress(Math.round((current / total) * 100));
      });

      toast({
        title: "다운로드 완료",
        description: "모든 사진이 기기에 저장되었습니다.",
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "다운로드 실패",
        description: "사진 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };
  if (!album) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">앨범을 찾을 수 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{album.title}</h1>
            <p className="text-gray-600">{album.description}</p>
            <p className="text-sm text-gray-500">
              {album.photoCount}장의 사진 • {album.category}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setIsUploadOpen(true)}
          >
            <Upload className="h-4 w-4 mr-2" />
            사진 업로드
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadAll}
            disabled={isDownloading || photos.length === 0}
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {downloadProgress}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                전체 저장
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteAlbum}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* 사진 업로드 영역 */}
      {isUploadOpen && (
        <PhotoUpload
          albumId={albumId}
          onUploadComplete={handlePhotoUpload}
          onCancel={() => setIsUploadOpen(false)}
        />
      )}
      {/* 사진 그리드 */}
      <PhotoGrid
        photos={photos}
        loading={loading}
        onPhotoClick={setSelectedPhotoIndex}
        onPhotoDelete={handleDeletePhoto}
        onReorder={reorderPhotos}
        isDraggable={true}
      />
      {/* 사진 뷰어 (라이트박스) */}
      {selectedPhotoIndex !== null && (
        <PhotoViewer
          photos={photos}
          currentIndex={selectedPhotoIndex}
          isOpen={selectedPhotoIndex !== null}
          onClose={() => setSelectedPhotoIndex(null)}
          onNext={() => setSelectedPhotoIndex((prev) =>
            prev !== null ? (prev + 1) % photos.length : 0
          )}
          onPrevious={() => setSelectedPhotoIndex((prev) =>
            prev !== null ? (prev - 1 + photos.length) % photos.length : 0
          )}
        />
      )}
    </div>
  );
}
