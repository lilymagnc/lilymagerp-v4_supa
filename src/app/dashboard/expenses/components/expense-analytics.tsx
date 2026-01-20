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
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Clock, 
  AlertTriangle,
  Building,
  Calendar,
  Target,
  Activity,
  Users,
  CreditCard
} from 'lucide-react';
import { useExpenses } from '@/hooks/use-expenses';
import { 
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS 
} from '@/types/expense';
import type { 
  ExpenseRequest
} from '@/types/expense';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];
export function ExpenseAnalytics() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const { expenses, loading } = useExpenses();
  // 시간 범위별 데이터 필터링
  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const startDate = new Date();
    switch (timeRange) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    return expenses.filter(expense => {
      const expenseDate = expense.createdAt.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
      return expenseDate >= startDate;
    });
  }, [expenses, timeRange]);
  // 기본 통계 계산
  const basicStats = useMemo(() => {
    const totalExpenses = filteredExpenses.length;
    const approvedExpenses = filteredExpenses.filter(e => e.status === 'approved' || e.status === 'paid').length;
    const pendingExpenses = filteredExpenses.filter(e => e.status === 'pending').length;
    const rejectedExpenses = filteredExpenses.filter(e => e.status === 'rejected').length;
    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
    const approvedAmount = filteredExpenses
      .filter(e => e.status === 'approved' || e.status === 'paid')
      .reduce((sum, expense) => sum + expense.totalAmount, 0);
    const averageAmount = totalExpenses > 0 ? totalAmount / totalExpenses : 0;
    const approvalRate = totalExpenses > 0 ? (approvedExpenses / totalExpenses) * 100 : 0;
    return {
      totalExpenses,
      approvedExpenses,
      pendingExpenses,
      rejectedExpenses,
      totalAmount,
      approvedAmount,
      averageAmount,
      approvalRate
    };
  }, [filteredExpenses]);
  // 카테고리별 분석
  const categoryAnalysis = useMemo(() => {
    const categoryData = filteredExpenses.reduce((acc, expense) => {
      expense.items.forEach(item => {
        if (!acc[item.category]) {
          acc[item.category] = {
            category: item.category,
            amount: 0,
            count: 0
          };
        }
        acc[item.category].amount += item.amount;
        acc[item.category].count += 1;
      });
      return acc;
    }, {} as Record<ExpenseCategory, any>);
    const totalAmount = Object.values(categoryData).reduce((sum: number, data: any) => sum + data.amount, 0);
    return Object.values(categoryData)
      .map((data: any) => ({
        ...data,
        name: EXPENSE_CATEGORY_LABELS[data.category as ExpenseCategory],
        percentage: totalAmount > 0 ? ((data.amount / totalAmount) * 100).toFixed(1) : '0'
      }))
      .sort((a: any, b: any) => b.amount - a.amount);
  }, [filteredExpenses]);
  // 지점별 분석
  const branchAnalysis = useMemo(() => {
    const branchData = filteredExpenses.reduce((acc, expense) => {
      const branch = expense.branchName;
      if (!acc[branch]) {
        acc[branch] = {
          name: branch,
          amount: 0,
          count: 0,
          approved: 0,
          pending: 0
        };
      }
      acc[branch].amount += expense.totalAmount;
      acc[branch].count += 1;
      if (expense.status === 'approved' || expense.status === 'paid') {
        acc[branch].approved += 1;
      } else if (expense.status === 'pending') {
        acc[branch].pending += 1;
      }
      return acc;
    }, {} as Record<string, any>);
    return Object.values(branchData).sort((a: any, b: any) => b.amount - a.amount);
  }, [filteredExpenses]);
  // 월별 트렌드
  const monthlyTrend = useMemo(() => {
    const monthlyData = filteredExpenses.reduce((acc, expense) => {
      const date = expense.createdAt.toDate ? expense.createdAt.toDate() : new Date(expense.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          amount: 0,
          count: 0,
          approved: 0,
          pending: 0,
          rejected: 0
        };
      }
      acc[monthKey].amount += expense.totalAmount;
      acc[monthKey].count += 1;
      if (expense.status === 'approved' || expense.status === 'paid') {
        acc[monthKey].approved += 1;
      } else if (expense.status === 'pending') {
        acc[monthKey].pending += 1;
      } else if (expense.status === 'rejected') {
        acc[monthKey].rejected += 1;
      }
      return acc;
    }, {} as Record<string, any>);
    return Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month));
  }, [filteredExpenses]);
  // 상위 지출 항목
  const topExpenses = useMemo(() => {
    return filteredExpenses
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
  }, [filteredExpenses]);
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact'
    }).format(amount);
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
          <h2 className="text-2xl font-bold">비용 분석</h2>
          <p className="text-muted-foreground">비용 지출 패턴과 트렌드를 분석합니다</p>
        </div>
        <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">최근 1주</SelectItem>
            <SelectItem value="month">최근 1개월</SelectItem>
            <SelectItem value="quarter">최근 3개월</SelectItem>
            <SelectItem value="year">최근 1년</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* 주요 지표 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 신청</p>
                <p className="text-2xl font-bold">{basicStats.totalExpenses}</p>
                <p className="text-xs text-blue-600">
                  승인률 {basicStats.approvalRate.toFixed(1)}%
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
                <p className="text-sm text-muted-foreground">총 지출</p>
                <p className="text-2xl font-bold">{formatCurrency(basicStats.totalAmount)}</p>
                <p className="text-xs text-green-600">
                  승인 {formatCurrency(basicStats.approvedAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">대기 중</p>
                <p className="text-2xl font-bold">{basicStats.pendingExpenses}</p>
                <p className="text-xs text-yellow-600">
                  처리 필요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">평균 금액</p>
                <p className="text-2xl font-bold">{formatCurrency(basicStats.averageAmount)}</p>
                <p className="text-xs text-purple-600">
                  건당 평균
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              카테고리별 지출 분포
            </CardTitle>
            <CardDescription>비용 카테고리별 지출 현황</CardDescription>
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
                    label={({ name, percentage }) => `${name} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
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
        {/* 지점별 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              지점별 지출 현황
            </CardTitle>
            <CardDescription>지점별 비용 신청 및 지출 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'amount' ? formatCurrency(value as number) : value,
                      name === 'amount' ? '총 지출' : name === 'count' ? '신청 건수' : name
                    ]}
                  />
                  <Bar dataKey="amount" fill="#8884d8" />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 월별 트렌드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            월별 지출 트렌드
          </CardTitle>
          <CardDescription>시간에 따른 비용 지출 변화</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'amount' ? formatCurrency(value as number) : value,
                    name === 'amount' ? '총 지출' : name === 'count' ? '신청 건수' : name
                  ]}
                />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="amount" 
                  stackId="1"
                  stroke="#8884d8" 
                  fill="#8884d8" 
                  fillOpacity={0.6}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="count" 
                  stroke="#ff7300" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {/* 상위 지출 항목 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 상세 분석</CardTitle>
            <CardDescription>각 카테고리의 지출 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryAnalysis.slice(0, 8).map((category: any, index) => (
                <div key={category.category} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {category.count}건 • {category.percentage}%
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(category.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      평균 {formatCurrency(category.amount / category.count)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* 상위 지출 항목 */}
        <Card>
          <CardHeader>
            <CardTitle>상위 지출 항목</CardTitle>
            <CardDescription>금액이 큰 비용 신청 목록</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topExpenses.slice(0, 8).map((expense, index) => (
                <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium truncate max-w-48">{expense.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.requesterName} • {expense.branchName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(expense.totalAmount)}</p>
                    <Badge 
                      variant={
                        expense.status === 'approved' || expense.status === 'paid' ? 'default' :
                        expense.status === 'pending' ? 'secondary' : 'destructive'
                      }
                      className="text-xs"
                    >
                      {expense.status === 'approved' ? '승인' :
                       expense.status === 'paid' ? '지급' :
                       expense.status === 'pending' ? '대기' : '반려'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
