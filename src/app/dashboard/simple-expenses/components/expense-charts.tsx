"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { SimpleExpense, SIMPLE_EXPENSE_CATEGORY_LABELS, getCategoryColor, canViewSubCategory } from '@/types/simple-expense';
import { useUserRole } from '@/hooks/use-user-role';

interface ExpenseChartsProps {
  expenses: SimpleExpense[];
  currentBranchName: string;
  selectedBranchId?: string;
  selectedMonth?: string; // YYYY-MM 형식
}

// 차트 색상 팔레트
const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#ff0000',
  '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'
];

export function ExpenseCharts({ expenses, currentBranchName, selectedBranchId, selectedMonth }: ExpenseChartsProps) {
  const { isHQManager, isHeadOfficeAdmin } = useUserRole();
  const userRole = isHeadOfficeAdmin() ? 'head_office_admin' : isHQManager() ? 'hq_manager' : 'branch_user';
  
  // 선택된 지점과 월의 데이터만 필터링 (민감한 데이터 제어 포함)
  const filteredExpenses = React.useMemo(() => {
    let filtered = expenses;
    
    // 지점 필터링
    if (selectedBranchId) {
      filtered = filtered.filter(expense => expense.branchId === selectedBranchId);
    }
    
    // 월 필터링
    if (selectedMonth) {
      filtered = filtered.filter(expense => {
        if (!expense.date) return false;
        const expenseDate = expense.date.toDate();
        // 한국 시간 기준으로 월 비교
        const expenseYear = expenseDate.getFullYear();
        const expenseMonth = expenseDate.getMonth() + 1; // getMonth()는 0부터 시작하므로 +1
        const expenseMonthKey = `${expenseYear}-${expenseMonth.toString().padStart(2, '0')}`;
        return expenseMonthKey === selectedMonth;
      });
    }
    
    // 민감한 데이터 필터링 (본사 관리자가 아닌 경우)
    if (!isHeadOfficeAdmin() && !isHQManager()) {
      filtered = filtered.filter(expense => {
        if (!expense.category || !expense.subCategory) return true;
        return canViewSubCategory(expense.category, expense.subCategory, userRole);
      });
    }
    
    return filtered;
  }, [expenses, selectedBranchId, selectedMonth]);

  // 전체 선택 여부 확인
  const isAllBranches = !selectedBranchId;

  // 지점별 지출 데이터 (전체 선택 시에만 사용)
  const branchComparisonData = React.useMemo(() => {
    if (!isAllBranches) return [];

    const branchMap = new Map<string, number>();
    const branchNameMap = new Map<string, string>();

    expenses.forEach(expense => {
      if (!expense.branchId || !expense.amount) return;
      
      // 민감한 데이터 필터링 (본사 관리자가 아닌 경우)
      if (!isHeadOfficeAdmin() && !isHQManager()) {
        if (expense.subCategory && !canViewSubCategory(expense.category, expense.subCategory, userRole)) {
          return;
        }
      }
      
      const currentAmount = branchMap.get(expense.branchId) || 0;
      branchMap.set(expense.branchId, currentAmount + expense.amount);

      // 지점명 저장
      if (expense.branchName) {
        branchNameMap.set(expense.branchId, expense.branchName);
      }
    });

    return Array.from(branchMap.entries()).map(([branchId, amount], index) => ({
      branchId,
      branchName: branchNameMap.get(branchId) || `지점 ${branchId}`,
      amount,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [expenses, isAllBranches]);

  // 지점별 카테고리 비교 데이터 (전체 선택 시에만 사용)
  const branchCategoryData = React.useMemo(() => {
    if (!isAllBranches) return { data: [], categories: [] };

    const branchCategoryMap = new Map<string, Map<string, number>>();
    const branchNameMap = new Map<string, string>();

    expenses.forEach(expense => {
      if (!expense.branchId || !expense.category || !expense.amount) return;
      
      // 민감한 데이터 필터링 (본사 관리자가 아닌 경우)
      if (!isHeadOfficeAdmin() && !isHQManager()) {
        if (expense.subCategory && !canViewSubCategory(expense.category, expense.subCategory, userRole)) {
          return;
        }
      }

      if (!branchCategoryMap.has(expense.branchId)) {
        branchCategoryMap.set(expense.branchId, new Map());
      }

      const categoryMap = branchCategoryMap.get(expense.branchId)!;
      const categoryName = SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category];
      const currentAmount = categoryMap.get(categoryName) || 0;
      categoryMap.set(categoryName, currentAmount + expense.amount);

      // 지점명 저장
      if (expense.branchName) {
        branchNameMap.set(expense.branchId, expense.branchName);
      }
    });

    // 모든 카테고리 수집
    const allCategories = new Set<string>();
    for (const categoryMap of branchCategoryMap.values()) {
      for (const category of categoryMap.keys()) {
        allCategories.add(category);
      }
    }

    // 차트 데이터 형식으로 변환
    const chartData = [];
    for (const [branchId, categoryMap] of branchCategoryMap) {
      const branchName = branchNameMap.get(branchId) || `지점 ${branchId}`;
      const dataPoint: any = { branchName };

      for (const category of allCategories) {
        dataPoint[category] = categoryMap.get(category) || 0;
      }

      chartData.push(dataPoint);
    }

    return {
      data: chartData,
      categories: Array.from(allCategories)
    };
  }, [expenses, isAllBranches]);

  // 카테고리별 지출 데이터
  const categoryData = React.useMemo(() => {
    const categoryMap = new Map<string, number>();

    // 전체 선택 시에는 모든 지점 데이터 사용, 그렇지 않으면 필터링된 데이터 사용
    const dataToUse = isAllBranches ? expenses : filteredExpenses;

    dataToUse.forEach(expense => {
      if (!expense.category) return;
      const category = SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category];
      const currentAmount = categoryMap.get(category) || 0;
      categoryMap.set(category, currentAmount + expense.amount);
    });

    return Array.from(categoryMap.entries()).map(([name, value], index) => ({
      name,
      value,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [filteredExpenses]);

  // 월별 트렌드 데이터 (최근 6개월)
  const monthlyData = React.useMemo(() => {
    const monthlyMap = new Map<string, number>();
    const now = new Date();

    // 최근 6개월 초기화
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // getMonth()는 0부터 시작하므로 +1
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      monthlyMap.set(monthKey, 0);
    }

    // 지출 데이터 집계 (필터링된 데이터 사용)
    const dataToUse = filteredExpenses;
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    dataToUse.forEach(expense => {
      if (!expense.date || !expense.amount) return;
      const expenseDate = expense.date.toDate();
      
      // 최근 6개월 데이터만 포함 (월 필터가 없을 때만)
      if (!selectedMonth && expenseDate < sixMonthsAgo) return;
      
      const year = expenseDate.getFullYear();
      const month = expenseDate.getMonth() + 1; // getMonth()는 0부터 시작하므로 +1
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const currentAmount = monthlyMap.get(monthKey) || 0;
      monthlyMap.set(monthKey, currentAmount + expense.amount);
    });

    // 날짜 순서대로 정렬 (과거부터 최신순)
    return Array.from(monthlyMap.entries())
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([month, amount]) => ({
        month: month.replace('-', '/'),
        amount
      }));
  }, [filteredExpenses, selectedMonth]);

  // 구매처별 지출 데이터 (상위 10개)
  const supplierData = React.useMemo(() => {
    const supplierMap = new Map<string, number>();

    // 필터링된 데이터 사용 (지점 + 월 필터 적용)
    const dataToUse = filteredExpenses;

    dataToUse.forEach(expense => {
      // 구매처명 검증
      if (!expense.supplier || expense.supplier.trim() === '') {
        return;
      }

      // 금액 검증 - 0보다 큰 값만 허용
      const amount = Number(expense.amount);
      if (isNaN(amount) || amount <= 0) {
        return;
      }

      const supplierName = expense.supplier.trim();
      const currentAmount = supplierMap.get(supplierName) || 0;
      supplierMap.set(supplierName, currentAmount + amount);

      });

    const result = Array.from(supplierMap.entries())
      .map(([name, amount]) => ({ 
        name, 
        amount: Number(amount) // 확실히 숫자로 변환
      }))
      .filter(item => item.amount > 0) // 0보다 큰 값만 필터링
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // 데이터 구조 검증
    result.forEach((item, index) => {
      if (!item.name || typeof item.amount !== 'number') {
        console.warn(`Invalid data at index ${index}:`, item);
      }
    });

    return result;
  }, [filteredExpenses]);

  // 일별 지출 데이터 (최근 30일)
  const dailyData = React.useMemo(() => {
    const dailyMap = new Map<string, number>();
    const now = new Date();

    // 최근 30일 초기화 (오늘부터 29일 전까지)
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
      dailyMap.set(dayKey, 0);
    }

    // 지출 데이터 집계 (필터링된 데이터 사용)
    const dataToUse = filteredExpenses;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    dataToUse.forEach(expense => {
      if (!expense.date || !expense.amount) return;
      const expenseDate = expense.date.toDate();
      
      // 최근 30일 데이터만 포함 (월 필터가 없을 때만)
      if (!selectedMonth && expenseDate < thirtyDaysAgo) return;
      
      const dayKey = expenseDate.toISOString().slice(0, 10);
      const currentAmount = dailyMap.get(dayKey) || 0;
      dailyMap.set(dayKey, currentAmount + expense.amount);
    });

    // 날짜 순서대로 정렬 (과거부터 최신순)
    return Array.from(dailyMap.entries())
      .sort(([dayA], [dayB]) => dayA.localeCompare(dayB))
      .map(([day, amount]) => ({
        day: day.slice(5), // MM-DD만 표시
        amount
      }));
  }, [filteredExpenses, selectedMonth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}원
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* 전체 선택 시 지점별 비교 차트 */}
      {isAllBranches && branchComparisonData.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">지점별 총 지출 비교</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={branchComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branchName" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="amount" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {branchCategoryData.data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">지점별 카테고리별 지출 비교</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={branchCategoryData.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="branchName" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {branchCategoryData.categories.map((category, index) => (
                      <Bar 
                        key={category}
                        dataKey={category}
                        name={category}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        stackId="a"
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 카테고리별 지출 분포 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isAllBranches ? '전체 카테고리별 지출 분포' : '카테고리별 지출 분포'}
            {selectedMonth && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedMonth.replace('-', '년 ') + '월'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 월별 지출 트렌드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isAllBranches ? '전체 월별 지출 트렌드' : '월별 지출 트렌드'}
            {selectedMonth && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedMonth.replace('-', '년 ') + '월'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="지출액"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 구매처별 지출 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isAllBranches ? '전체 구매처별 지출 (상위 10개)' : '구매처별 지출 (상위 10개)'}
            {selectedMonth && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedMonth.replace('-', '년 ') + '월'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {supplierData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={supplierData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">구매처별 지출 데이터가 없습니다</p>
                <p className="text-sm">지출 데이터를 입력하면 구매처별 분석이 표시됩니다.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 일별 지출 트렌드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isAllBranches ? '전체 일별 지출 트렌드 (최근 30일)' : '일별 지출 트렌드 (최근 30일)'}
            {selectedMonth && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({selectedMonth.replace('-', '년 ') + '월'})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="amount" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
} 
