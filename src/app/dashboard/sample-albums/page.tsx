'use client';
import { useState } from 'react';
import { Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/page-header';
import { AlbumGrid } from './components/album-grid';
import { CreateAlbumDialog } from './components/create-album-dialog';
import { CategoryFilter } from './components/category-filter';
import { useAlbums } from '@/hooks/use-albums';
import { AlbumCategory } from '@/types/album';
import { useAuth } from '@/hooks/use-auth';
export default function SampleAlbumsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AlbumCategory | 'all'>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { albums, loading, createAlbum, deleteAlbum } = useAlbums();
  const { user } = useAuth();
  const isHeadOfficeAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise;
  // 검색 및 필터링된 앨범
  const filteredAlbums = albums.filter(album => {
    const matchesSearch = album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         album.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || album.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  const handleCreateAlbum = async (albumData: any) => {
    try {
      await createAlbum(albumData);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('앨범 생성 실패:', error);
    }
  };
  const handleDeleteAlbum = async (albumId: string) => {
    if (confirm('앨범을 삭제하시겠습니까? 모든 사진이 함께 삭제됩니다.')) {
      try {
        await deleteAlbum(albumId);
      } catch (error) {
        console.error('앨범 삭제 실패:', error);
      }
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        title="샘플앨범"
        description="고객에게 보여줄 작품 샘플을 관리합니다"
      />
      {/* 검색 및 필터 영역 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="앨범 제목이나 설명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 앨범
        </Button>
      </div>
      {/* 앨범 그리드 */}
      <AlbumGrid
        albums={filteredAlbums}
        loading={loading}
        onAlbumDelete={handleDeleteAlbum}
      />
      {/* 앨범 생성 다이얼로그 */}
      <CreateAlbumDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateAlbum={handleCreateAlbum}
      />
    </div>
  );
}
