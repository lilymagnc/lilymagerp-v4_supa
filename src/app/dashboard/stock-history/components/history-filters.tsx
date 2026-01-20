
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarIcon, Search } from "lucide-react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import type { Branch } from "@/hooks/use-branches";
export interface StockHistoryFiltersState {
    dateRange: DateRange;
    branch: string;
    type: string;
    itemType: string;
    search: string;
}
interface HistoryFiltersProps {
    filters: StockHistoryFiltersState;
    onFiltersChange: React.Dispatch<React.SetStateAction<StockHistoryFiltersState>>;
    branches: Branch[];
}
export function HistoryFilters({ filters, onFiltersChange, branches }: HistoryFiltersProps) {
    const handleFilterChange = (key: keyof StockHistoryFiltersState, value: any) => {
        onFiltersChange(prev => ({ ...prev, [key]: value }));
    };
  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Date Range Picker */}
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-full justify-start text-left font-normal",
                    !filters.dateRange && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.from ? (
                    filters.dateRange.to ? (
                        <>
                        {format(filters.dateRange.from, "LLL dd, y")} -{" "}
                        {format(filters.dateRange.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(filters.dateRange.from, "LLL dd, y")
                    )
                    ) : (
                    <span>날짜 선택</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={filters.dateRange?.from}
                    selected={filters.dateRange}
                    onSelect={(range) => handleFilterChange('dateRange', range)}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
            {/* Branch Filter */}
            <Select value={filters.branch} onValueChange={(value) => handleFilterChange('branch', value)}>
                <SelectTrigger>
                    <SelectValue placeholder="지점 선택" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">모든 지점</SelectItem>
                    {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.name}>
                            {branch.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {/* Type Filter */}
            <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger>
                    <SelectValue placeholder="유형 선택" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">모든 유형</SelectItem>
                    <SelectItem value="in">입고</SelectItem>
                    <SelectItem value="out">출고</SelectItem>
                    <SelectItem value="manual_update">수동 수정</SelectItem>
                </SelectContent>
            </Select>
            {/* Item Type Filter */}
            <Select value={filters.itemType} onValueChange={(value) => handleFilterChange('itemType', value)}>
                <SelectTrigger>
                    <SelectValue placeholder="품목 선택" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">모든 품목</SelectItem>
                    <SelectItem value="product">상품</SelectItem>
                    <SelectItem value="material">자재</SelectItem>
                </SelectContent>
            </Select>
            {/* Search Input */}
             <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="상품/자재명 검색..."
                    className="pl-8"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
