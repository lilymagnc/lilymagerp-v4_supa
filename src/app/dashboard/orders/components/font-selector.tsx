
"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { GOOGLE_FONTS } from "@/lib/fonts";

interface FontSelectorProps {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    label?: string;
}

export function FontSelector({ value, onValueChange, className, label }: FontSelectorProps) {
    const [open, setOpen] = useState(false);

    // 현재 선택된 폰트 이름 찾기
    const selectedLabel = GOOGLE_FONTS.find((font) => font.family === value)?.name || value;

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {/* Load all fonts for preview in the dropdown */}
            <style jsx global>{`
        ${GOOGLE_FONTS.map(font => `@import url('${font.url}');`).join('\n')}
      `}</style>

            {label && <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</span>}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between font-normal"
                        style={{ fontFamily: `'${value}'` }}
                    >
                        {selectedLabel}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="폰트 검색..." />
                        <CommandList>
                            <CommandEmpty>폰트를 찾을 수 없습니다.</CommandEmpty>
                            <CommandGroup>
                                {GOOGLE_FONTS.map((font) => (
                                    <CommandItem
                                        key={font.family}
                                        value={font.name}
                                        onSelect={() => {
                                            onValueChange(font.family);
                                            setOpen(false);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === font.family ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex flex-col">
                                            <span style={{ fontFamily: `'${font.family}'` }}>{font.name}</span>
                                            <span style={{ fontFamily: `'${font.family}'`, fontSize: '12px', color: '#666' }}>가나다 ABC aAgG</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
