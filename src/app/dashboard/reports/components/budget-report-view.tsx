"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  ComposedChart,
  Line
} from 'recharts';
import { 
  Target, 
  TrendingUp,
  Download,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle,
  Building,
  DollarSign
} from 'lucide-react';
import { useReports } from '@/hooks/use-reports';
import type { ReportFilter, BudgetReport } from '@/hooks/use-reports';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];
interface BudgetReportViewProps {
  filters: ReportFilter;
}
export function BudgetReportView({ filters }: BudgetReportViewProps) {
  const [report, setReport] = useState<BudgetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { generateBudgetReport, exportToCSV } = useReports();
  // 리포트 생성
  const generateReport = async () => {
    try {
      setLoading(true);
      const reportData = await generateBudgetReport(filters);
      setReport(reportData);
    } catch (error) {
      console.error('Error generating budget report:', error);
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
  // 효율성 색상
  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };
  // 효율성 배지 색상
  const getEfficiencyBadge = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'fair': return 'outline';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };
  // CSV 내보내기
  const handleExport = () => {
    if (!report) return;
    const exportData = report.categoryPerformance.map(item => ({
      카테고리: item.categoryName,
      할당예산: item.allocated,
      사용금액: item.used,
      잔여예산: item.remaining,
      사용률: `${item.usage.toFixed(1)}%`,
      효율성: item.efficiency === 'excellent' ? '우수' :
              item.efficiency === 'good' ? '양호' :
              item.efficiency === 'fair' ? '보통' : '개선필요'
    }));
    exportToCSV(exportData, 'budget-report');
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">예산 리포트 생성 중...</span>
      </div>
    );
  }
  if (!report) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">예산 리포트를 생성하려면 필터를 설정하고 적용하세요.</p>
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
          <h2 className="text-2xl font-bold">예산 분석 리포트</h2>
          <p className="text-muted-foreground">
            총 {report.summary.totalBudgets}개 예산 분석
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
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 할당 예산</p>
                <p className="text-2xl font-bold">{formatCurrency(report.summary.totalAllocated)}</p>
                <p className="text-xs text-blue-600">
                  {report.summary.totalBudgets}개 예산
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
                <p className="text-sm text-muted-foreground">사용 금액</p>
                <p className="text-2xl font-bold">{formatCurrency(report.summary.totalUsed)}</p>
                <p className="text-xs text-green-600">
                  사용률 {report.summary.averageUsage.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">잔여 예산</p>
                <p className="text-2xl font-bold">{formatCurrency(report.summary.totalRemaining)}</p>
                <p className="text-xs text-purple-600">
                  활용 가능
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
                <p className="text-2xl font-bold">{report.summary.overBudgetCount}</p>
                <p className="text-xs text-red-600">
                  주의 필요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 예산 알림 */}
      {report.budgetAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              예산 알림 ({report.budgetAlerts.length}건)
            </CardTitle>
            <CardDescription>주의가 필요한 예산 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {report.budgetAlerts.map((alert) => (
                <Alert key={alert.budgetId} className={`border-l-4 ${
                  alert.severity === 'high' ? 'border-l-red-500 bg-red-50' :
                  alert.severity === 'medium' ? 'border-l-yellow-500 bg-yellow-50' :
                  'border-l-blue-500 bg-blue-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{alert.budgetName}</h4>
                      <AlertDescription>{alert.message}</AlertDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        alert.severity === 'high' ? 'destructive' :
                        alert.severity === 'medium' ? 'default' : 'secondary'
                      }>
                        {alert.usage.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* 차트 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 카테고리별 예산 성과 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              카테고리별 예산 성과
            </CardTitle>
            <CardDescription>할당 예산 대비 사용 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={report.categoryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="categoryName" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'usage' ? `${(value as number).toFixed(1)}%` : formatCurrency(value as number),
                      name === 'allocated' ? '할당 예산' : 
                      name === 'used' ? '사용 금액' : '사용률'
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
        {/* 지점별 예산 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              지점별 예산 현황
            </CardTitle>
            <CardDescription>지점별 예산 할당과 사용 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.branchPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branchName" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => [
                      formatCurrency(value as number),
                      name === 'allocated' ? '할당 예산' : '사용 금액'
                    ]}
                  />
                  <Bar dataKey="allocated" fill="#8884d8" />
                  <Bar dataKey="used" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 예산 효율성 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            예산 효율성 분석
          </CardTitle>
          <CardDescription>각 카테고리의 예산 사용 효율성 평가</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.categoryPerformance.map((category, index) => (
              <div key={category.category} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <h4 className="font-medium">{category.categoryName}</h4>
                    <p className="text-sm text-muted-foreground">
                      할당: {formatCurrency(category.allocated)} • 
                      사용: {formatCurrency(category.used)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-24">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">사용률</span>
                      <span className={`text-sm font-medium ${getEfficiencyColor(category.efficiency)}`}>
                        {category.usage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={Math.min(category.usage, 100)} className="h-2" />
                  </div>
                  <Badge variant={getEfficiencyBadge(category.efficiency)}>
                    {category.efficiency === 'excellent' ? '우수' :
                     category.efficiency === 'good' ? '양호' :
                     category.efficiency === 'fair' ? '보통' : '개선필요'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* 지점별 상세 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>지점별 상세 분석</CardTitle>
          <CardDescription>각 지점의 예산 관리 현황과 효율성</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.branchPerformance.map((branch, index) => (
              <div key={branch.branchId} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{branch.branchName}</h4>
                    <p className="text-sm text-muted-foreground">
                      할당: {formatCurrency(branch.allocated)} • 
                      잔여: {formatCurrency(branch.remaining)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right min-w-32">
                    <p className="font-medium">{formatCurrency(branch.used)}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">사용률</span>
                      <span className={`text-sm font-medium ${
                        branch.usage >= 100 ? 'text-red-600' :
                        branch.usage >= 80 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {branch.usage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={Math.min(branch.usage, 100)} className="h-2 mt-1" />
                  </div>
                  {branch.usage >= 100 && (
                    <Badge variant="destructive">
                      초과
                    </Badge>
                  )}
                  {branch.usage >= 80 && branch.usage < 100 && (
                    <Badge variant="default">
                      주의
                    </Badge>
                  )}
                  {branch.usage < 50 && (
                    <Badge variant="secondary">
                      저활용
                    </Badge>
                  )}
                </div>
              </div>
            ))}
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
          <CardDescription>카테고리별 예산 사용률 현황</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={report.categoryPerformance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ categoryName, usage }) => `${categoryName} ${usage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="used"
                >
                  {report.categoryPerformance.map((entry, index) => (
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
  );
}
