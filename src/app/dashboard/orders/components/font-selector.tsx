
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronsUpDown, Search, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { getActiveFontItems, FontCatalogItem } from "@/lib/font-catalog";
import { FontManagerDialog } from "./font-manager-dialog";

interface FontSelectorProps {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    label?: string;
}

export function FontSelector({ value, onValueChange, className, label }: FontSelectorProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [fontManagerOpen, setFontManagerOpen] = useState(false);
    const [fonts, setFonts] = useState<FontCatalogItem[]>([]);
    const searchRef = useRef<HTMLInputElement>(null);

    // 폰트 목록 로드
    const loadFonts = useCallback(() => {
        setFonts(getActiveFontItems());
    }, []);

    useEffect(() => {
        loadFonts();
    }, [loadFonts]);

    // 현재 선택된 폰트 이름 찾기
    const selectedLabel = fonts.find((font) => font.family === value)?.name || value;

    // 폰트 CSS URL 생성
    const fontUrls = fonts.map(f => f.url);

    // 검색 필터링
    const filteredFonts = fonts.filter((font) =>
        font.name.toLowerCase().includes(search.toLowerCase()) ||
        font.family.toLowerCase().includes(search.toLowerCase())
    );

    // 팝오버 열릴 때 검색 초기화 및 포커스
    useEffect(() => {
        if (open) {
            setSearch("");
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, [open]);

    const handleSelect = (fontFamily: string) => {
        onValueChange(fontFamily);
        setOpen(false);
    };

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {/* Load active fonts */}
            {fontUrls.map((url, i) => (
                <link key={i} rel="stylesheet" href={url} />
            ))}

            {label && <span className="text-sm font-medium leading-none">{label}</span>}

            <div className="flex gap-1">
                <Popover open={open} onOpenChange={setOpen} modal={false}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="flex-1 justify-between font-normal"
                            style={{ fontFamily: `'${value}'` }}
                        >
                            {selectedLabel}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[280px] p-0"
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        {/* 검색 입력 */}
                        <div className="flex items-center border-b px-3">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="폰트 검색..."
                                className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                            />
                        </div>
                        {/* 폰트 목록 */}
                        <div
                            className="p-1"
                            style={{ maxHeight: '300px', overflowY: 'auto', overscrollBehavior: 'contain' }}
                            onWheel={(e) => e.stopPropagation()}
                        >
                            {filteredFonts.length === 0 ? (
                                <div className="py-6 text-center text-sm text-muted-foreground">
                                    폰트를 찾을 수 없습니다.
                                </div>
                            ) : (
                                filteredFonts.map((font) => (
                                    <button
                                        key={font.family}
                                        type="button"
                                        onClick={() => handleSelect(font.family)}
                                        className={cn(
                                            "relative flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none cursor-pointer",
                                            "hover:bg-accent hover:text-accent-foreground",
                                            "transition-colors",
                                            value === font.family && "bg-accent"
                                        )}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4 shrink-0",
                                                value === font.family ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col flex-1 text-left">
                                            <span style={{ fontFamily: `'${font.family}', sans-serif` }}>
                                                {font.name}
                                            </span>
                                            <span style={{
                                                fontFamily: `'${font.family}', sans-serif`,
                                                fontSize: '13px',
                                                color: '#71717a',
                                                marginTop: '2px'
                                            }}>
                                                가나다 ABC aAgG
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        {/* 폰트 관리 버튼 */}
                        <div className="border-t p-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    setFontManagerOpen(true);
                                }}
                                className="flex w-full items-center rounded-sm px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                            >
                                <Settings2 className="mr-2 h-4 w-4" />
                                폰트 추가/삭제 관리...
                            </button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* 폰트 마법사 다이얼로그 */}
            <FontManagerDialog
                isOpen={fontManagerOpen}
                onOpenChange={setFontManagerOpen}
                onFontsChanged={loadFonts}
            />
        </div>
    );
}
