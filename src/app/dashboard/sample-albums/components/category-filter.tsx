'use client';
import { AlbumCategory, ALBUM_CATEGORIES } from '@/types/album';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
interface CategoryFilterProps {
  selectedCategory: AlbumCategory | 'all';
  onCategoryChange: (category: AlbumCategory | 'all') => void;
}
export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  return (
    <Select value={selectedCategory} onValueChange={onCategoryChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="카테고리 선택" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">전체 카테고리</SelectItem>
        {ALBUM_CATEGORIES.map((category) => (
          <SelectItem key={category.value} value={category.value}>
            {category.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
