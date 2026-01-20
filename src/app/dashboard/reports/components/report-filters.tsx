"use client";
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Calendar,
  Filter,
  X,
  Building,
  Users,
  Tag
} from 'lucide-react';
import type { 
  ReportFilter,
  ExpenseCategory
} from '@/hooks/use-reports';
import { EXPENSE_CATEGORY_LABELS } from '@/types/expense';
import { useBranches } from '@/hooks/use-branches';
interface ReportFiltersProps {
  filters: ReportFilter;
  onChange: (filters: ReportFilter) => void;
}
// 지점 목록은 useBranches 훅에서 가져옴
// 부서 목록
const departments = [
  { id: 'dept-001', name: '영업팀' },
  { id: 'dept-002', name: '마케팅팀' },
  { id: 'dept-003', name: '관리팀' },
  { id: 'dept-004', name: '운영팀' },
];
export function ReportFilters({ filters, onChange }: ReportFiltersProps) {
  const { branches } = useBranches();
  const [tempFilters, setTempFilters] = useState<ReportFilter>(filters);
  // 날짜 범위 프리셋
  const datePresets = [
    {
      label: '이번 달',
      getValue: () => ({
        dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        dateTo: new Date()
      })
    },
    {
      label: '지난 달',
      getValue: () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return {
          dateFrom: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
          dateTo: new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0)
        };
      }
    },
    {
      label: '최근 3개월',
      getValue: () => ({
        dateFrom: new Date(new Date().setMonth(new Date().getMonth() - 3)),
        dateTo: new Date()
      })
    },
    {
      label: '올해',
      getValue: () => ({
        dateFrom: new Date(new Date().getFullYear(), 0, 1),
        dateTo: new Date()
      })
    }
  ];
  // 필터 적용
  const applyFilters = () => {
    onChange(tempFilters);
  };
  // 필터 초기화
  const resetFilters = () => {
    const defaultFilters: ReportFilter = {
      dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      dateTo: new Date(),
      branchIds: [],
      departmentIds: [],
      categories: [],
      userIds: []
    };
    setTempFilters(defaultFilters);
    onChange(defaultFilters);
  };
  // 날짜 프리셋 적용
  const applyDatePreset = (preset: typeof datePresets[0]) => {
    const dates = preset.getValue();
    setTempFilters(prev => ({
      ...prev,
      ...dates
    }));
  };
  // 지점 선택 토글
  const toggleBranch = (branchId: string) => {
    setTempFilters(prev => ({
      ...prev,
      branchIds: prev.branchIds?.includes(branchId)
        ? prev.branchIds.filter(id => id !== branchId)
        : [...(prev.branchIds || []), branchId]
    }));
  };
  // 부서 선택 토글
  const toggleDepartment = (departmentId: string) => {
    setTempFilters(prev => ({
      ...prev,
      departmentIds: prev.departmentIds?.includes(departmentId)
        ? prev.departmentIds.filter(id => id !== departmentId)
        : [...(prev.departmentIds || []), departmentId]
    }));
  };
  // 카테고리 선택 토글
  const toggleCategory = (category: ExpenseCategory) => {
    setTempFilters(prev => ({
      ...prev,
      categories: prev.categories?.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...(prev.categories || []), category]
    }));
  };
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };
  const parseDate = (dateString: string) => {
    return new Date(dateString);
  };
  return (
    <div className="space-y-4">
      {/* 날짜 범위 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>시작 날짜</Label>
          <Input
            type="date"
            value={formatDate(tempFilters.dateFrom)}
            onChange={(e) => setTempFilters(prev => ({
              ...prev,
              dateFrom: parseDate(e.target.value)
            }))}
          />
        </div>
        <div className="space-y-2">
          <Label>종료 날짜</Label>
          <Input
            type="date"
            value={formatDate(tempFilters.dateTo)}
            onChange={(e) => setTempFilters(prev => ({
              ...prev,
              dateTo: parseDate(e.target.value)
            }))}
          />
        </div>
        <div className="space-y-2">
          <Label>빠른 선택</Label>
          <Select onValueChange={(value) => {
            const preset = datePresets.find(p => p.label === value);
            if (preset) applyDatePreset(preset);
          }}>
            <SelectTrigger>
              <SelectValue placeholder="기간 선택" />
            </SelectTrigger>
            <SelectContent>
              {datePresets.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* 필터 옵션 */}
      <div className="flex flex-wrap gap-2">
        {/* 지점 필터 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              지점 ({tempFilters.branchIds?.length || 0})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <h4 className="font-medium">지점 선택</h4>
              <div className="space-y-2">
                {branches.map((branch) => (
                  <div key={branch.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={branch.id}
                      checked={tempFilters.branchIds?.includes(branch.id) || false}
                      onCheckedChange={() => toggleBranch(branch.id)}
                    />
                    <Label htmlFor={branch.id} className="text-sm">
                      {branch.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {/* 부서 필터 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              부서 ({tempFilters.departmentIds?.length || 0})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <h4 className="font-medium">부서 선택</h4>
              <div className="space-y-2">
                {departments.map((department) => (
                  <div key={department.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={department.id}
                      checked={tempFilters.departmentIds?.includes(department.id) || false}
                      onCheckedChange={() => toggleDepartment(department.id)}
                    />
                    <Label htmlFor={department.id} className="text-sm">
                      {department.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {/* 카테고리 필터 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              카테고리 ({tempFilters.categories?.length || 0})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <h4 className="font-medium">카테고리 선택</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={tempFilters.categories?.includes(key as ExpenseCategory) || false}
                      onCheckedChange={() => toggleCategory(key as ExpenseCategory)}
                    />
                    <Label htmlFor={key} className="text-sm">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {/* 선택된 필터 표시 */}
      {(tempFilters.branchIds?.length || tempFilters.departmentIds?.length || tempFilters.categories?.length) ? (
        <div className="flex flex-wrap gap-2">
          {tempFilters.branchIds?.map(branchId => {
            const branch = branches.find(b => b.id === branchId);
            return branch ? (
              <div key={branchId} className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                <Building className="h-3 w-3" />
                {branch.name}
                <button onClick={() => toggleBranch(branchId)}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null;
          })}
          {tempFilters.departmentIds?.map(deptId => {
            const dept = departments.find(d => d.id === deptId);
            return dept ? (
              <div key={deptId} className="flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                <Users className="h-3 w-3" />
                {dept.name}
                <button onClick={() => toggleDepartment(deptId)}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null;
          })}
          {tempFilters.categories?.map(category => (
            <div key={category} className="flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
              <Tag className="h-3 w-3" />
              {EXPENSE_CATEGORY_LABELS[category]}
              <button onClick={() => toggleCategory(category)}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {/* 액션 버튼 */}
      <div className="flex items-center gap-2">
        <Button onClick={applyFilters} className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          필터 적용
        </Button>
        <Button variant="outline" onClick={resetFilters}>
          <X className="h-4 w-4 mr-2" />
          초기화
        </Button>
      </div>
    </div>
  );
}
