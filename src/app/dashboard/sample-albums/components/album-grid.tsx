'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { Album, ALBUM_CATEGORIES } from '@/types/album';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
interface AlbumGridProps {
  albums: Album[];
  loading: boolean;
  onAlbumDelete: (albumId: string) => void;
}
export function AlbumGrid({ albums, loading, onAlbumDelete }: AlbumGridProps) {
  const router = useRouter();
  const getCategoryLabel = (category: string) => {
    const categoryInfo = ALBUM_CATEGORIES.find(c => c.value === category);
    return categoryInfo?.label || category;
  };
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR');
  };
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="aspect-square">
              <Skeleton className="w-full h-full" />
            </div>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  if (albums.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Eye className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">앨범이 없습니다</h3>
        <p className="text-gray-500 mb-4">첫 번째 샘플 앨범을 만들어보세요.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {albums.map((album) => (
        <Card key={album.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
          <div 
            className="aspect-square relative bg-gray-100"
            onClick={() => router.push(`/dashboard/sample-albums/${album.id}`)}
          >
            {album.thumbnailUrl ? (
              <Image
                src={album.thumbnailUrl}
                alt={album.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Eye className="w-12 h-12 text-gray-400" />
              </div>
            )}
            {/* 사진 개수 배지 */}
            <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {album.photoCount}장
            </div>
            {/* 액션 메뉴 */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dashboard/sample-albums/${album.id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    보기
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    편집
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onAlbumDelete(album.id);
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    삭제
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-lg truncate flex-1 mr-2">
                {album.title}
              </h3>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full whitespace-nowrap">
                {getCategoryLabel(album.category)}
              </span>
            </div>
            {album.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {album.description}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{formatDate(album.createdAt)}</span>
              <span className={`px-2 py-1 rounded-full ${
                album.isPublic 
                  ? 'bg-green-100 text-green-600' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {album.isPublic ? '공개' : '비공개'}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
