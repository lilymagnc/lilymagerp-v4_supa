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
  LineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Lightbulb,
  BarChart3,
  Activity,
  DollarSign,
  Target
} from 'lucide-react';
import { useReports } from '@/hooks/use-reports';
import type { ReportFilter, ConsolidatedReport } from '@/hooks/use-reports';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
interface ConsolidatedReportViewProps {
  filters: ReportFilter;
}
export function ConsolidatedReportView({ filters }: ConsolidatedReportViewProps) {
  const [report, setReport] = useState<ConsolidatedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { generateConsolidatedReport, exportToCSV } = useReports();
  // 리포트 생성
  const generateReport = async () => {
    try {
      setLoading(true);
      const reportData = await generateConsolidatedReport(filters);
      setReport(reportData);
    } catch (error) {
      console.error('Error generating consolidated report:', error);
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
      currency: 'KRW',
      notation: 'compact'
    }).format(amount);
  };
  // 권장사항 우선순위별 색상
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };
  // 권장사항 아이콘
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <TrendingUp className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <Lightbulb className="h-4 w-4" />;
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">통합 리포트 생성 중...</span>
      </div>
    );
  }
  if (!report) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">리포트를 생성하려면 필터를 설정하고 적용하세요.</p>
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
          <h2 className="text-2xl font-bold">통합 리포트</h2>
          <p className="text-muted-foreground">
            {report.period.from.toLocaleDateString('ko-KR')} ~ {report.period.to.toLocaleDateString('ko-KR')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={generateReport} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={() => exportToCSV([], 'consolidated-report')}>
            <Download className="h-4 w-4 mr-2" />
            내보내기
          </Button>
        </div>
      </div>
      {/* 전체 개요 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 비용</p>
                <p className="text-2xl font-bold">{formatCurrency(report.overview.totalExpenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Target className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 예산</p>
                <p className="text-2xl font-bold">{formatCurrency(report.overview.totalBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">예산 사용률</p>
                <p className="text-2xl font-bold">{report.overview.budgetUtilization.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">구매 요청</p>
                <p className="text-2xl font-bold">{report.overview.purchaseRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">비용 절감</p>
                <p className="text-2xl font-bold">{formatCurrency(report.overview.costSavings)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 예산 vs 실제 비용 비교 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            예산 대비 실제 비용
          </CardTitle>
          <CardDescription>
            카테고리별 예산 계획과 실제 지출 비교
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.budgetReport.categoryPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoryName" />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [
                    formatCurrency(value as number),
                    name === 'allocated' ? '할당 예산' : '사용 금액'
                  ]}
                />
                <Bar dataKey="allocated" fill="#8884d8" name="allocated" />
                <Bar dataKey="used" fill="#82ca9d" name="used" />
                <Line type="monotone" dataKey="usage" stroke="#ff7300" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {/* 비용 트렌드 분석 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              월별 비용 트렌드
            </CardTitle>
            <CardDescription>시간에 따른 비용 지출 변화</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.expenseReport.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              지점별 성과
            </CardTitle>
            <CardDescription>지점별 예산 사용 효율성</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.budgetReport.branchPerformance.slice(0, 5).map((branch, index) => (
                <div key={branch.branchId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{branch.branchName}</span>
                    <span className="text-sm text-muted-foreground">
                      {branch.usage.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={Math.min(branch.usage, 100)} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>사용: {formatCurrency(branch.used)}</span>
                    <span>예산: {formatCurrency(branch.allocated)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 권장사항 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            개선 권장사항
          </CardTitle>
          <CardDescription>
            데이터 분석을 바탕으로 한 비용 최적화 제안
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.recommendations.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">현재 특별한 개선사항이 없습니다.</p>
              <p className="text-sm text-muted-foreground">비용 관리가 효율적으로 이루어지고 있습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {report.recommendations.map((recommendation, index) => (
                <Alert key={index} className="border-l-4 border-l-blue-500">
                  <div className="flex items-start gap-3">
                    {getPriorityIcon(recommendation.priority)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{recommendation.title}</h4>
                        <Badge variant={getPriorityColor(recommendation.priority)}>
                          {recommendation.priority === 'high' ? '높음' :
                           recommendation.priority === 'medium' ? '보통' : '낮음'}
                        </Badge>
                      </div>
                      <AlertDescription className="mb-3">
                        {recommendation.description}
                      </AlertDescription>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          예상 효과: {formatCurrency(recommendation.estimatedImpact)}
                        </span>
                        <Button variant="outline" size="sm">
                          자세히 보기
                        </Button>
                      </div>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* 주요 지표 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">비용 효율성</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">승인률</span>
                <span className="font-medium">{report.expenseReport.summary.approvalRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">평균 금액</span>
                <span className="font-medium">{formatCurrency(report.expenseReport.summary.averageAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">최다 카테고리</span>
                <span className="font-medium">{report.expenseReport.summary.topCategory}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">예산 현황</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">활성 예산</span>
                <span className="font-medium">{report.budgetReport.summary.totalBudgets}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">초과 예산</span>
                <span className="font-medium text-red-600">{report.budgetReport.summary.overBudgetCount}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">잔여 예산</span>
                <span className="font-medium">{formatCurrency(report.budgetReport.summary.totalRemaining)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">구매 활동</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">총 요청</span>
                <span className="font-medium">{report.purchaseReport.summary.totalRequests}건</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">완료율</span>
                <span className="font-medium">{report.purchaseReport.summary.completionRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">긴급 요청</span>
                <span className="font-medium text-orange-600">{report.purchaseReport.summary.urgentRequests}건</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
