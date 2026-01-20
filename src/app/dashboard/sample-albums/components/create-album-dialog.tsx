'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlbumCategory, ALBUM_CATEGORIES, CreateAlbumData } from '@/types/album';
interface CreateAlbumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateAlbum: (albumData: CreateAlbumData) => Promise<void>;
}
export function CreateAlbumDialog({ open, onOpenChange, onCreateAlbum }: CreateAlbumDialogProps) {
  const [formData, setFormData] = useState<CreateAlbumData>({
    title: '',
    description: '',
    category: 'other',
    isPublic: true
  });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('앨범 제목을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await onCreateAlbum(formData);
      // 폼 초기화
      setFormData({
        title: '',
        description: '',
        category: 'other',
        isPublic: true
      });
    } catch (error) {
      console.error('앨범 생성 실패:', error);
      alert('앨범 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };
  const handleInputChange = (field: keyof CreateAlbumData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>새 앨범 만들기</DialogTitle>
          <DialogDescription>
            고객에게 보여줄 새로운 샘플 앨범을 만들어보세요.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">앨범 제목 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="예: 봄 웨딩 컬렉션"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">카테고리</Label>
            <Select
              value={formData.category}
              onValueChange={(value: AlbumCategory) => handleInputChange('category', value)}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="카테고리 선택" />
              </SelectTrigger>
              <SelectContent>
                {ALBUM_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="앨범에 대한 간단한 설명을 입력하세요"
              rows={3}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="isPublic"
              checked={formData.isPublic}
              onCheckedChange={(checked) => handleInputChange('isPublic', checked)}
            />
            <Label htmlFor="isPublic">공개 앨범</Label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '생성 중...' : '앨범 만들기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
