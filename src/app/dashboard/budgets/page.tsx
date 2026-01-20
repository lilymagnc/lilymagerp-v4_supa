"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Target, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Calendar,
  BarChart3,
  Settings,
  PieChart
} from 'lucide-react';
import { BudgetForm } from './components/budget-form';
import { BudgetList } from './components/budget-list';
import { BudgetAnalytics } from './components/budget-analytics';
import { BudgetAlerts } from './components/budget-alerts';
import { useBudgets } from '@/hooks/use-budgets';
export default function BudgetsPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { budgets, loading, stats } = useBudgets();
  const handleCreateBudget = () => {
    setShowCreateForm(true);
    setActiveTab('create');
  };
  const handleBudgetCreated = () => {
    setShowCreateForm(false);
    setActiveTab('list');
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      notation: 'compact'
    }).format(amount);
  };
  const getUsageColor = (usage: number) => {
    if (usage >= 100) return 'text-red-600';
    if (usage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">예산 관리</h1>
          <p className="text-muted-foreground mt-1">
            연간/월간 예산을 설정하고 사용 현황을 모니터링합니다
          </p>
        </div>
        <Button onClick={handleCreateBudget} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          새 예산 생성
        </Button>
      </div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 예산</p>
                <p className="text-2xl font-bold">{stats.totalBudgets}</p>
                <p className="text-xs text-blue-600">
                  활성 예산
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
                <p className="text-sm text-muted-foreground">할당 금액</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalAllocated)}</p>
                <p className="text-xs text-green-600">
                  총 예산 규모
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
                <p className="text-sm text-muted-foreground">사용 금액</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalUsed)}</p>
                <p className={`text-xs ${getUsageColor(stats.averageUsage)}`}>
                  사용률 {stats.averageUsage.toFixed(1)}%
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
                <p className="text-2xl font-bold">{stats.overBudgetCount}</p>
                <p className="text-xs text-red-600">
                  주의 필요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 예산 사용률 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            예산 사용률 현황
          </CardTitle>
          <CardDescription>
            전체 예산 대비 사용 현황과 잔여 예산
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="transparent"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={getUsageColor(stats.averageUsage).replace('text-', 'text-')}
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${stats.averageUsage}, 100`}
                    strokeLinecap="round"
                    fill="transparent"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{stats.averageUsage.toFixed(1)}%</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">평균 사용률</p>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">할당 예산</span>
                  <span className="text-sm">{formatCurrency(stats.totalAllocated)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">사용 금액</span>
                  <span className="text-sm">{formatCurrency(stats.totalUsed)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      stats.averageUsage >= 100 ? 'bg-red-600' :
                      stats.averageUsage >= 80 ? 'bg-yellow-600' : 'bg-green-600'
                    }`}
                    style={{ width: `${Math.min(stats.averageUsage, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">잔여 예산</span>
                  <span className="text-sm">{formatCurrency(stats.totalRemaining)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gray-400 h-2 rounded-full" 
                    style={{ width: `${Math.max(0, 100 - stats.averageUsage)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                  <span className="text-sm">정상 범위</span>
                </div>
                <span className="text-sm font-medium">
                  {budgets.filter(b => {
                    const usage = b.allocatedAmount > 0 ? (b.usedAmount / b.allocatedAmount) * 100 : 0;
                    return usage < 80;
                  }).length}개
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                  <span className="text-sm">주의 필요</span>
                </div>
                <span className="text-sm font-medium">
                  {budgets.filter(b => {
                    const usage = b.allocatedAmount > 0 ? (b.usedAmount / b.allocatedAmount) * 100 : 0;
                    return usage >= 80 && usage < 100;
                  }).length}개
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                  <span className="text-sm">예산 초과</span>
                </div>
                <span className="text-sm font-medium">{stats.overBudgetCount}개</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* 메인 콘텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            예산 목록
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            새 예산
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            알림
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            분석
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            설정
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                예산 목록
              </CardTitle>
              <CardDescription>
                생성된 예산을 확인하고 관리합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetList 
                budgets={budgets} 
                loading={loading}
                onRefresh={() => window.location.reload()}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="create" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                새 예산 생성
              </CardTitle>
              <CardDescription>
                연간 또는 월간 예산을 설정합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BudgetForm 
                onSuccess={handleBudgetCreated}
                onCancel={() => setActiveTab('list')}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="alerts" className="mt-6">
          <BudgetAlerts />
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <BudgetAnalytics />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                예산 설정
              </CardTitle>
              <CardDescription>
                예산 관리 관련 설정을 구성합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">예산 설정 기능은 준비 중입니다.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
