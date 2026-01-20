"use client";
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';
import { 
  Target, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Calendar,
  Building,
  Activity,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useBudgets } from '@/hooks/use-budgets';
import type { 
  Budget,
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS 
} from '@/types/expense';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];
export function BudgetAnalytics() {
  const [timeRange, setTimeRange] = useState<'current' | 'quarter' | 'year'>('current');
  const [viewType, setViewType] = useState<'category' | 'branch' | 'department'>('category');
  const { budgets, loading } = useBudgets();
  // 시간 범위별 데이터 필터링
  const filteredBudgets = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    return budgets.filter(budget => {
      switch (timeRange) {
        case 'current':
          return budget.fiscalYear === currentYear && budget.isActive;
        case 'quarter':
          const quarterMonths = Math.ceil(currentMonth / 3) * 3;
          return budget.fiscalYear === currentYear && 
                 (!budget.fiscalMonth || budget.fiscalMonth <= quarterMonths);
        case 'year':
          return budget.fiscalYear === currentYear;
        default:
          return budget.isActive;
      }
    });
  }, [budgets, timeRange]);
  // 기본 통계 계산
  const basicStats = useMemo(() => {
    const totalBudgets = filteredBudgets.length;
    const activeBudgets = filteredBudgets.filter(b => b.isActive).length;
    const totalAllocated = filteredBudgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
    const totalUsed = filteredBudgets.reduce((sum, b) => sum + b.usedAmount, 0);
    const totalRemaining = filteredBudgets.reduce((sum, b) => sum + b.remainingAmount, 0);
    const averageUsage = totalAllocated > 0 ? (totalUsed / totalAllocated) * 100 : 0;
    const overBudgetCount = filteredBudgets.filter(b => b.usedAmount > b.allocatedAmount).length;
    const underUtilizedCount = filteredBudgets.filter(b => {
      const usage = b.allocatedAmount > 0 ? (b.usedAmount / b.allocatedAmount) * 100 : 0;
      return usage < 50;
    }).length;
    return {
      totalBudgets,
      activeBudgets,
      totalAllocated,
      totalUsed,
      totalRemaining,
      averageUsage,
      overBudgetCount,
      underUtilizedCount
    };
  }, [filteredBudgets]);
  // 카테고리별 분석
  const categoryAnalysis = useMemo(() => {
    const categoryData = filteredBudgets.reduce((acc, budget) => {
      if (!acc[budget.category]) {
        acc[budget.category] = {
          category: budget.category,
          allocated: 0,
          used: 0,
          remaining: 0,
          count: 0
        };
      }
      acc[budget.category].allocated += budget.allocatedAmount;
      acc[budget.category].used += budget.usedAmount;
      acc[budget.category].remaining += budget.remainingAmount;
      acc[budget.category].count += 1;
      return acc;
    }, {} as Record<ExpenseCategory, any>);
    return Object.values(categoryData)
      .map((data: any) => ({
        ...data,
        name: EXPENSE_CATEGORY_LABELS[data.category as ExpenseCategory],
        usage: data.allocated > 0 ? (data.used / data.allocated) * 100 : 0,
        efficiency: data.allocated > 0 ? Math.min((data.used / data.allocated) * 100, 100) : 0
      }))
      .sort((a: any, b: any) => b.allocated - a.allocated);
  }, [filteredBudgets]);
  // 지점별 분석
  const branchAnalysis = useMemo(() => {
    const branchData = filteredBudgets.reduce((acc, budget) => {
      const branch = budget.branchName || '전사';
      if (!acc[branch]) {
        acc[branch] = {
          name: branch,
          allocated: 0,
          used: 0,
          remaining: 0,
          count: 0
        };
      }
      acc[branch].allocated += budget.allocatedAmount;
      acc[branch].used += budget.usedAmount;
      acc[branch].remaining += budget.remainingAmount;
      acc[branch].count += 1;
      return acc;
    }, {} as Record<string, any>);
    return Object.values(branchData)
      .map((data: any) => ({
        ...data,
        usage: data.allocated > 0 ? (data.used / data.allocated) * 100 : 0
      }))
      .sort((a: any, b: any) => b.allocated - a.allocated);
  }, [filteredBudgets]);
  // 월별 트렌드 (월간 예산만)
  const monthlyTrend = useMemo(() => {
    const monthlyBudgets = filteredBudgets.filter(b => b.fiscalMonth);
    const monthlyData = monthlyBudgets.reduce((acc, budget) => {
      const month = budget.fiscalMonth!;
      if (!acc[month]) {
        acc[month] = {
          month: `${month}월`,
          allocated: 0,
          used: 0,
          count: 0,
          usage: 0
        };
      }
      acc[month].allocated += budget.allocatedAmount;
      acc[month].used += budget.usedAmount;
      acc[month].count += 1;
      return acc;
    }, {} as Record<number, any>);
    return Object.values(monthlyData)
      .map((data: any) => ({
        ...data,
        usage: data.allocated > 0 ? (data.used / data.allocated) * 100 : 0
      }))
      .sort((a: any, b: any) => parseInt(a.month) - parseInt(b.month));
  }, [filteredBudgets]);
  // 예산 효율성 분석
  const efficiencyAnalysis = useMemo(() => {
    return filteredBudgets.map(budget => {
      const usage = budget.allocatedAmount > 0 ? (budget.usedAmount / budget.allocatedAmount) * 100 : 0;
      let efficiency: 'excellent' | 'good' | 'fair' | 'poor';
      if (usage >= 80 && usage <= 100) efficiency = 'excellent';
      else if (usage >= 60 && usage < 120) efficiency = 'good';
      else if (usage >= 40 && usage < 140) efficiency = 'fair';
      else efficiency = 'poor';
      return {
        ...budget,
        usage,
        efficiency,
        name: budget.name,
        category: EXPENSE_CATEGORY_LABELS[budget.category]
      };
    }).sort((a, b) => b.usage - a.usage);
  }, [filteredBudgets]);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact'
    }).format(amount);
  };
  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">분석 데이터 로딩 중...</span>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">예산 분석</h2>
          <p className="text-muted-foreground">예산 사용 패턴과 효율성을 분석합니다</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">현재</SelectItem>
              <SelectItem value="quarter">분기</SelectItem>
              <SelectItem value="year">연간</SelectItem>
            </SelectContent>
          </Select>
          <Select value={viewType} onValueChange={(value: any) => setViewType(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="category">카테고리별</SelectItem>
              <SelectItem value="branch">지점별</SelectItem>
              <SelectItem value="department">부서별</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">평균 사용률</p>
                <p className="text-2xl font-bold">{basicStats.averageUsage.toFixed(1)}%</p>
                <p className="text-xs text-blue-600">
                  {basicStats.activeBudgets}개 활성 예산
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 할당 예산</p>
                <p className="text-2xl font-bold">{formatCurrency(basicStats.totalAllocated)}</p>
                <p className="text-xs text-green-600">
                  사용: {formatCurrency(basicStats.totalUsed)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">예산 초과</p>
                <p className="text-2xl font-bold">{basicStats.overBudgetCount}</p>
                <p className="text-xs text-red-600">
                  주의 필요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">저활용</p>
                <p className="text-2xl font-bold">{basicStats.underUtilizedCount}</p>
                <p className="text-xs text-yellow-600">
                  50% 미만 사용
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 예산 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {viewType === 'category' ? '카테고리별' : viewType === 'branch' ? '지점별' : '부서별'} 예산 분포
            </CardTitle>
            <CardDescription>할당 예산과 사용 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={viewType === 'category' ? categoryAnalysis : branchAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      formatCurrency(value as number),
                      name === 'allocated' ? '할당 예산' : '사용 금액'
                    ]}
                  />
                  <Bar dataKey="allocated" fill="#8884d8" name="allocated" />
                  <Bar dataKey="used" fill="#82ca9d" name="used" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        {/* 예산 사용률 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              예산 사용률 분포
            </CardTitle>
            <CardDescription>카테고리별 사용률 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryAnalysis}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, usage }) => `${name} ${usage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="used"
                  >
                    {categoryAnalysis.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 월별 트렌드 */}
      {monthlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              월별 예산 트렌드
            </CardTitle>
            <CardDescription>월간 예산의 할당과 사용 추이</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'usage' ? `${(value as number).toFixed(1)}%` : formatCurrency(value as number),
                      name === 'allocated' ? '할당 예산' : name === 'used' ? '사용 금액' : '사용률'
                    ]}
                  />
                  <Bar yAxisId="left" dataKey="allocated" fill="#8884d8" />
                  <Bar yAxisId="left" dataKey="used" fill="#82ca9d" />
                  <Line yAxisId="right" type="monotone" dataKey="usage" stroke="#ff7300" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      {/* 예산 효율성 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            예산 효율성 분석
          </CardTitle>
          <CardDescription>각 예산의 사용 효율성 평가</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {efficiencyAnalysis.slice(0, 10).map((budget, index) => (
              <div key={budget.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="font-medium">{budget.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {budget.category} • {budget.branchName || '전사'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(budget.allocatedAmount)}</p>
                    <p className="text-sm text-muted-foreground">
                      사용: {formatCurrency(budget.usedAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${getEfficiencyColor(budget.efficiency)}`}>
                      {budget.usage.toFixed(1)}%
                    </p>
                    <Badge 
                      variant={
                        budget.efficiency === 'excellent' ? 'default' :
                        budget.efficiency === 'good' ? 'secondary' :
                        budget.efficiency === 'fair' ? 'outline' : 'destructive'
                      }
                      className="text-xs"
                    >
                      {budget.efficiency === 'excellent' ? '우수' :
                       budget.efficiency === 'good' ? '양호' :
                       budget.efficiency === 'fair' ? '보통' : '개선필요'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
