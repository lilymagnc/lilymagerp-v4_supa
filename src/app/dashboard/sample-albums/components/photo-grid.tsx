'use client';
import { useState } from 'react';
import { MoreVertical, Trash2, Move, Image as ImageIcon } from 'lucide-react';
import { Photo } from '@/types/album';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { getCachedPhotoBlobUrl } from '@/lib/image-cache';
import { useEffect } from 'react';

function CachedImage({ src, alt, ...props }: any) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    let mounted = true;
    if (typeof src === 'string' && src.startsWith('http')) {
      getCachedPhotoBlobUrl(src).then(blobUrl => {
        if (mounted && blobUrl) {
          setCurrentSrc(blobUrl);
        }
      }).catch(err => console.warn('Cache load failed', err));
    }
    return () => { mounted = false; };
  }, [src]);

  return <Image src={currentSrc} alt={alt} {...props} />;
}
interface PhotoGridProps {
  photos: Photo[];
  loading: boolean;
  onPhotoClick: (index: number) => void;
  onPhotoDelete?: (photoId: string) => void;
  onReorder?: (photos: Photo[]) => void;
  isDraggable?: boolean;
}
export function PhotoGrid({
  photos,
  loading,
  onPhotoClick,
  onPhotoDelete,
  onReorder,
  isDraggable = false
}: PhotoGridProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isDraggable) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!isDraggable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (!isDraggable || draggedIndex === null || !onReorder) return;
    e.preventDefault();
    if (draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }
    const newPhotos = [...photos];
    const draggedPhoto = newPhotos[draggedIndex];
    // 배열에서 드래그된 항목 제거
    newPhotos.splice(draggedIndex, 1);
    // 새 위치에 삽입
    newPhotos.splice(dropIndex, 0, draggedPhoto);
    // order 값 재설정
    const reorderedPhotos = newPhotos.map((photo, index) => ({
      ...photo,
      order: index + 1
    }));
    onReorder(reorderedPhotos);
    setDraggedIndex(null);
  };
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="aspect-square">
            <Skeleton className="w-full h-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }
  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <ImageIcon className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">사진이 없습니다</h3>
        <p className="text-gray-500">사진을 업로드해서 앨범을 채워보세요.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {photos.map((photo, index) => (
        <div
          key={photo.id}
          className={`aspect-square relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer group ${isDraggable ? 'hover:shadow-lg transition-shadow' : ''
            } ${draggedIndex === index ? 'opacity-50' : ''}`}
          draggable={isDraggable}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
          onClick={() => onPhotoClick(index)}
        >
          <CachedImage
            src={photo.previewUrl || photo.originalUrl}
            alt={photo.filename}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
            priority={index < 4}
          />
          {/* 드래그 핸들 */}
          {isDraggable && (
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-black/70 text-white p-1 rounded">
                <Move className="w-4 h-4" />
              </div>
            </div>
          )}
          {/* 사진 정보 오버레이 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-xs truncate">{photo.filename}</p>
            <p className="text-white/80 text-xs">
              {photo.width} × {photo.height} • {formatFileSize(photo.size)}
            </p>
          </div>
          {/* 액션 메뉴 */}
          {onPhotoDelete && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 bg-black/70 hover:bg-black/80 text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onPhotoDelete(photo.id);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          {/* 순서 번호 */}
          <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {photo.order}
          </div>
        </div>
      ))}
    </div>
  );
}
