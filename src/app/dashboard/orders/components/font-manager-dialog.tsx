
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Wand2, Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    FONT_CATALOG,
    FONT_CATEGORIES,
    FontCatalogItem,
    getActiveFonts,
    setActiveFonts,
} from "@/lib/font-catalog";

interface FontManagerDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onFontsChanged?: () => void;
}

export function FontManagerDialog({ isOpen, onOpenChange, onFontsChanged }: FontManagerDialogProps) {
    const [activeFonts, setActiveFontsState] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [search, setSearch] = useState("");
    const [sourceFilter, setSourceFilter] = useState<'all' | 'google' | 'naver'>('all');

    // 초기 로드
    useEffect(() => {
        if (isOpen) {
            setActiveFontsState(getActiveFonts());
        }
    }, [isOpen]);

    // 폰트 토글
    const toggleFont = (family: string) => {
        setActiveFontsState(prev => {
            if (prev.includes(family)) {
                return prev.filter(f => f !== family);
            } else {
                return [...prev, family];
            }
        });
    };

    // 저장
    const handleSave = () => {
        setActiveFonts(activeFonts);
        onFontsChanged?.();
        onOpenChange(false);
    };

    // 필터링
    const filteredFonts = FONT_CATALOG.filter(font => {
        const matchCategory = selectedCategory === 'all' || font.category === selectedCategory;
        const matchSearch = search === '' ||
            font.name.toLowerCase().includes(search.toLowerCase()) ||
            font.family.toLowerCase().includes(search.toLowerCase()) ||
            font.preview.includes(search);
        const matchSource = sourceFilter === 'all' || font.source === sourceFilter;
        return matchCategory && matchSearch && matchSource;
    });

    // 카테고리별 활성 폰트 수
    const activeCounts = FONT_CATEGORIES.reduce((acc, cat) => {
        acc[cat.id] = activeFonts.filter(af =>
            FONT_CATALOG.find(f => f.family === af && f.category === cat.id)
        ).length;
        return acc;
    }, {} as Record<string, number>);

    // 모든 폰트 CSS URL 수집 (미리보기용)
    const allFontUrls = FONT_CATALOG.map(f => f.url);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5 text-primary" />
                        폰트 마법사
                    </DialogTitle>
                    <DialogDescription>
                        원하는 폰트를 선택하면 메시지 인쇄 시 사용할 수 있습니다. 구글 폰트와 네이버 폰트를 지원합니다.
                    </DialogDescription>
                </DialogHeader>

                {/* 폰트 CSS 로드 */}
                {allFontUrls.map((url, i) => (
                    <link key={i} rel="stylesheet" href={url} />
                ))}

                {/* 상단 필터 영역 */}
                <div className="space-y-3 pb-3 border-b">
                    {/* 검색 + 출처 필터 */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="폰트 이름으로 검색..."
                                className="pl-9"
                            />
                        </div>
                        <div className="flex gap-1">
                            <Button
                                type="button"
                                variant={sourceFilter === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSourceFilter('all')}
                            >전체</Button>
                            <Button
                                type="button"
                                variant={sourceFilter === 'google' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSourceFilter('google')}
                            >Google</Button>
                            <Button
                                type="button"
                                variant={sourceFilter === 'naver' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSourceFilter('naver')}
                            >Naver</Button>
                        </div>
                    </div>

                    {/* 카테고리 탭 */}
                    <div className="flex gap-1 flex-wrap">
                        <Button
                            type="button"
                            variant={selectedCategory === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedCategory('all')}
                        >
                            📋 전체 ({FONT_CATALOG.length})
                        </Button>
                        {FONT_CATEGORIES.map(cat => (
                            <Button
                                key={cat.id}
                                type="button"
                                variant={selectedCategory === cat.id ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setSelectedCategory(cat.id)}
                            >
                                {cat.icon} {cat.label}
                                {activeCounts[cat.id] > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1 text-xs">
                                        {activeCounts[cat.id]}
                                    </Badge>
                                )}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* 폰트 그리드 */}
                <div className="flex-1 overflow-y-auto min-h-0 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {filteredFonts.map((font) => {
                            const isActive = activeFonts.includes(font.family);
                            return (
                                <button
                                    key={font.family}
                                    type="button"
                                    onClick={() => toggleFont(font.family)}
                                    className={cn(
                                        "relative flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all",
                                        "hover:shadow-md hover:border-primary/50",
                                        isActive
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-muted bg-card hover:bg-accent/30"
                                    )}
                                >
                                    {/* 선택 상태 표시 */}
                                    <div className={cn(
                                        "absolute top-2 right-2 h-6 w-6 rounded-full flex items-center justify-center transition-all",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-muted-foreground"
                                    )}>
                                        {isActive ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                    </div>

                                    {/* 폰트 이름 */}
                                    <div className="flex items-center gap-1.5 mb-1 pr-8">
                                        <span className="font-medium text-sm">{font.name}</span>
                                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                                            {font.source === 'google' ? 'G' : 'N'}
                                        </Badge>
                                    </div>

                                    {/* 미리보기 */}
                                    <div
                                        style={{ fontFamily: `'${font.family}', sans-serif`, fontSize: '18px', lineHeight: 1.4 }}
                                        className="text-foreground mb-1"
                                    >
                                        가나다라 마바사
                                    </div>
                                    <div
                                        style={{ fontFamily: `'${font.family}', sans-serif`, fontSize: '12px' }}
                                        className="text-muted-foreground"
                                    >
                                        {font.preview} · ABCDE abcde 12345
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {filteredFonts.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>검색 결과가 없습니다</p>
                        </div>
                    )}
                </div>

                {/* 하단 요약 + 버튼 */}
                <DialogFooter className="pt-3 border-t">
                    <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Star className="h-4 w-4" />
                        <span>활성 폰트 <strong className="text-foreground">{activeFonts.length}</strong>개 / 전체 {FONT_CATALOG.length}개</span>
                    </div>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">취소</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSave}>
                        <Check className="mr-1.5 h-4 w-4" />
                        폰트 저장
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
