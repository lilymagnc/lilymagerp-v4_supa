"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Line
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp,
  Download,
  RefreshCw,
  Activity,
  CheckCircle,
  Building,
  Calendar
} from 'lucide-react';
import { useReports } from '@/hooks/use-reports';
import type { ReportFilter, ExpenseReport } from '@/hooks/use-reports';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];
interface ExpenseReportViewProps {
  filters: ReportFilter;
}
export function ExpenseReportView({ filters }: ExpenseReportViewProps) {
  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { generateExpenseReport, exportToCSV } = useReports();
  // 리포트 생성
  const generateReport = async () => {
    try {
      setLoading(true);
      const reportData = await generateExpenseReport(filters);
      setReport(reportData);
    } catch (error) {
      console.error('Error generating expense report:', error);
    } finally {
      setLoading(false);
    }
  };
  // 필터 변경 시 자동 리포트 생성
  useEffect(() => {
    generateReport();
  }, [filters]);
  // 통화 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  // CSV 내보내기
  const handleExport = () => {
    if (!report) return;
    const exportData = report.categoryBreakdown.map(item => ({
      카테고리: item.categoryName,
      금액: item.amount,
      건수: item.count,
      비율: `${item.percentage.toFixed(1)}%`
    }));
    exportToCSV(exportData, 'expense-report');
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">비용 리포트 생성 중...</span>
      </div>
    );
  }
  if (!report) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">비용 리포트를 생성하려면 필터를 설정하고 적용하세요.</p>
            <Button onClick={generateReport} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              리포트 생성
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">비용 분석 리포트</h2>
          <p className="text-muted-foreground">
            총 {report.summary.totalCount}건의 비용 신청 분석
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={generateReport} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
        </div>
      </div>
      {/* 요약 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 비용</p>
                <p className="text-2xl font-bold">{formatCurrency(report.summary.totalAmount)}</p>
                <p className="text-xs text-blue-600">
                  {report.summary.totalCount}건
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">평균 금액</p>
                <p className="text-2xl font-bold">{formatCurrency(report.summary.averageAmount)}</p>
                <p className="text-xs text-green-600">
                  건당 평균
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">승인률</p>
                <p className="text-2xl font-bold">{report.summary.approvalRate.toFixed(1)}%</p>
                <p className="text-xs text-purple-600">
                  전체 대비
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Building className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">최다 지점</p>
                <p className="text-lg font-bold">{report.summary.topBranch}</p>
                <p className="text-xs text-orange-600">
                  최다 카테고리: {report.summary.topCategory}
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
              <DollarSign className="h-5 w-5" />
              카테고리별 비용 분포
            </CardTitle>
            <CardDescription>비용 카테고리별 지출 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={report.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ categoryName, percentage }) => `${categoryName} ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="amount"
                  >
                    {report.categoryBreakdown.map((entry, index) => (
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
              지점별 비용 현황
            </CardTitle>
            <CardDescription>지점별 비용 지출 및 건수</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.branchBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branchName" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'amount' ? formatCurrency(value as number) : value,
                      name === 'amount' ? '총 비용' : '신청 건수'
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
            월별 비용 트렌드
          </CardTitle>
          <CardDescription>시간에 따른 비용 지출 변화와 승인 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'amount' ? formatCurrency(value as number) : value,
                    name === 'amount' ? '총 비용' : 
                    name === 'count' ? '신청 건수' :
                    name === 'approved' ? '승인 건수' : '반려 건수'
                  ]}
                />
                <Bar yAxisId="left" dataKey="amount" fill="#8884d8" />
                <Bar yAxisId="right" dataKey="approved" fill="#82ca9d" />
                <Bar yAxisId="right" dataKey="rejected" fill="#ff7c7c" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {/* 상세 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 상세 */}
        <Card>
          <CardHeader>
            <CardTitle>카테고리별 상세 분석</CardTitle>
            <CardDescription>각 카테고리의 지출 현황과 비율</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.categoryBreakdown.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div>
                      <p className="font-medium">{category.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {category.count}건 • {category.percentage.toFixed(1)}%
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
              {report.topExpenses.slice(0, 8).map((expense, index) => (
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
      {/* 지점별 상세 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>지점별 상세 분석</CardTitle>
          <CardDescription>각 지점의 비용 지출 패턴과 효율성</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.branchBreakdown.map((branch, index) => (
              <div key={branch.branchId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-green-600">{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{branch.branchName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {branch.count}건 신청 • 평균 {formatCurrency(branch.amount / branch.count)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(branch.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      전체의 {branch.percentage.toFixed(1)}%
                    </p>
                  </div>
                  <Badge variant="outline">
                    {branch.count}건
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
