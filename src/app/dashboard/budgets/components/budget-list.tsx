"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  RefreshCw,
  Calendar,
  Building,
  Target,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Pause,
  Play
} from 'lucide-react';
import { useBudgets } from '@/hooks/use-budgets';
import { 
  Budget, 
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
  calculateBudgetUsage,
  getBudgetStatus 
} from '@/types/expense';
interface BudgetListProps {
  budgets: Budget[];
  loading: boolean;
  onRefresh: () => void;
}
export function BudgetList({ budgets, loading, onRefresh }: BudgetListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const { toggleBudgetStatus } = useBudgets();
  // 필터링된 예산 목록
  const filteredBudgets = budgets.filter(budget => {
    const searchMatch = !searchTerm || 
      String(budget.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(budget.branchName ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(budget.departmentName ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = categoryFilter === 'all' || budget.category === categoryFilter;
    const yearMatch = yearFilter === 'all' || budget.fiscalYear.toString() === yearFilter;
    const statusMatch = statusFilter === 'all' || 
      (statusFilter === 'active' && budget.isActive) ||
      (statusFilter === 'inactive' && !budget.isActive);
    return searchMatch && categoryMatch && yearMatch && statusMatch;
  });
  // 고유 연도 목록 추출
  const uniqueYears = Array.from(new Set(budgets.map(b => b.fiscalYear.toString())));
  // 예산 사용률 계산
  const getBudgetUsage = (budget: Budget) => {
    return budget.allocatedAmount > 0 ? (budget.usedAmount / budget.allocatedAmount) * 100 : 0;
  };
  // 상태별 색상 반환
  const getStatusColor = (budget: Budget) => {
    if (!budget.isActive) return 'text-gray-500';
    const usage = getBudgetUsage(budget);
    if (usage >= 100) return 'text-red-600';
    if (usage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };
  // 상태별 아이콘 반환
  const getStatusIcon = (budget: Budget) => {
    if (!budget.isActive) return <Pause className="h-4 w-4 text-gray-500" />;
    const usage = getBudgetUsage(budget);
    if (usage >= 100) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    if (usage >= 80) return <TrendingUp className="h-4 w-4 text-yellow-500" />;
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };
  // 날짜 포맷팅
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  // 통화 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  // 예산 활성화/비활성화 토글
  const handleToggleStatus = async (budgetId: string, currentStatus: boolean) => {
    await toggleBudgetStatus(budgetId, !currentStatus);
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">로딩 중...</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="예산명, 지점, 부서로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as ExpenseCategory | 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="연도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 연도</SelectItem>
              {uniqueYears.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}년
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="active">활성</SelectItem>
              <SelectItem value="inactive">비활성</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* 예산 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>예산 목록 ({filteredBudgets.length}개)</span>
            <div className="text-sm text-muted-foreground">
              총 할당 예산: {formatCurrency(
                filteredBudgets.reduce((total, budget) => total + budget.allocatedAmount, 0)
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredBudgets.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">조건에 맞는 예산이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>예산명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead>조직</TableHead>
                    <TableHead>할당 금액</TableHead>
                    <TableHead>사용률</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>생성일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBudgets.map((budget) => {
                    const usage = getBudgetUsage(budget);
                    return (
                      <TableRow key={budget.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(budget)}
                            <div>
                              <p className="font-medium">{budget.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {budget.fiscalMonth ? `${budget.fiscalMonth}월 예산` : '연간 예산'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {EXPENSE_CATEGORY_LABELS[budget.category]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>{budget.fiscalYear}년</span>
                            {budget.fiscalMonth && (
                              <span className="text-sm text-muted-foreground">
                                {budget.fiscalMonth}월
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm">
                                {budget.branchName || '전사'}
                              </p>
                              {budget.departmentName && (
                                <p className="text-xs text-muted-foreground">
                                  {budget.departmentName}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {formatCurrency(budget.allocatedAmount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              사용: {formatCurrency(budget.usedAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${getStatusColor(budget)}`}>
                                {usage.toFixed(1)}%
                              </span>
                              {usage >= 100 && (
                                <Badge variant="destructive" className="text-xs">
                                  초과
                                </Badge>
                              )}
                            </div>
                            <Progress 
                              value={Math.min(usage, 100)} 
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground">
                              잔여: {formatCurrency(budget.remainingAmount)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {budget.isActive ? (
                              <Badge variant="default" className="text-xs">
                                <Play className="h-3 w-3 mr-1" />
                                활성
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <Pause className="h-3 w-3 mr-1" />
                                비활성
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(budget.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                상세 보기
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                수정
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(budget.id, budget.isActive)}
                              >
                                {budget.isActive ? (
                                  <>
                                    <Pause className="h-4 w-4 mr-2" />
                                    비활성화
                                  </>
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-2" />
                                    활성화
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 요약 정보 */}
      {filteredBudgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {filteredBudgets.filter(b => {
                    const usage = getBudgetUsage(b);
                    return usage < 80;
                  }).length}
                </p>
                <p className="text-sm text-muted-foreground">정상 범위</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredBudgets.filter(b => {
                    const usage = getBudgetUsage(b);
                    return usage >= 80 && usage < 100;
                  }).length}
                </p>
                <p className="text-sm text-muted-foreground">주의 필요</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {filteredBudgets.filter(b => getBudgetUsage(b) >= 100).length}
                </p>
                <p className="text-sm text-muted-foreground">예산 초과</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">
                  {filteredBudgets.filter(b => !b.isActive).length}
                </p>
                <p className="text-sm text-muted-foreground">비활성</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
