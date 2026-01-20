"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  TrendingUp,
  DollarSign,
  Calendar,
  Building,
  Target,
  Bell,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  Settings
} from 'lucide-react';
import { useBudgets } from '@/hooks/use-budgets';
import type { 
  Budget,
  EXPENSE_CATEGORY_LABELS,
  calculateBudgetUsage,
  getBudgetStatus 
} from '@/types/expense';
interface BudgetAlert {
  id: string;
  budget: Budget;
  type: 'over_budget' | 'near_limit' | 'monthly_limit';
  severity: 'high' | 'medium' | 'low';
  message: string;
  usage: number;
  recommendedAction: string;
}
export function BudgetAlerts() {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const { budgets, checkBudgetAlerts } = useBudgets();
  // 알림 생성
  const generateAlerts = () => {
    const budgetAlerts: BudgetAlert[] = [];
    budgets
      .filter(budget => budget.isActive)
      .forEach(budget => {
        const usage = budget.allocatedAmount > 0 ? (budget.usedAmount / budget.allocatedAmount) * 100 : 0;
        // 예산 초과 알림
        if (usage >= 100) {
          budgetAlerts.push({
            id: `${budget.id}_over_budget`,
            budget,
            type: 'over_budget',
            severity: 'high',
            message: `${budget.name}이 예산을 ${(usage - 100).toFixed(1)}% 초과했습니다.`,
            usage,
            recommendedAction: '즉시 지출을 중단하고 추가 예산 승인을 요청하세요.'
          });
        }
        // 예산 근접 알림 (80% 이상)
        else if (usage >= 80) {
          budgetAlerts.push({
            id: `${budget.id}_near_limit`,
            budget,
            type: 'near_limit',
            severity: usage >= 90 ? 'high' : 'medium',
            message: `${budget.name}의 예산 사용률이 ${usage.toFixed(1)}%에 도달했습니다.`,
            usage,
            recommendedAction: '지출 계획을 검토하고 필요시 예산 조정을 고려하세요.'
          });
        }
        // 월간 예산의 경우 월말 근접 시 추가 알림
        if (budget.fiscalMonth) {
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
          if (budget.fiscalMonth === currentMonth && daysLeft <= 7 && usage < 80) {
            budgetAlerts.push({
              id: `${budget.id}_monthly_limit`,
              budget,
              type: 'monthly_limit',
              severity: 'low',
              message: `${budget.name}의 월말까지 ${daysLeft}일 남았습니다. (사용률: ${usage.toFixed(1)}%)`,
              usage,
              recommendedAction: '남은 예산을 효율적으로 활용할 계획을 수립하세요.'
            });
          }
        }
      });
    // 심각도별 정렬
    budgetAlerts.sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
    setAlerts(budgetAlerts);
    setLoading(false);
  };
  useEffect(() => {
    generateAlerts();
  }, [budgets]);
  // 알림 타입별 아이콘
  const getAlertIcon = (type: BudgetAlert['type']) => {
    switch (type) {
      case 'over_budget':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'near_limit':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'monthly_limit':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };
  // 심각도별 색상
  const getSeverityColor = (severity: BudgetAlert['severity']) => {
    switch (severity) {
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };
  // 통화 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">알림 확인 중...</span>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">예산 알림</h3>
          <p className="text-sm text-muted-foreground">
            {alerts.length}개의 알림이 있습니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generateAlerts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            알림 설정
          </Button>
        </div>
      </div>
      {/* 알림 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">긴급</p>
                <p className="text-2xl font-bold text-red-600">
                  {alerts.filter(a => a.severity === 'high').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">주의</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {alerts.filter(a => a.severity === 'medium').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">정보</p>
                <p className="text-2xl font-bold text-blue-600">
                  {alerts.filter(a => a.severity === 'low').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 알림 목록 */}
      {alerts.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">모든 예산이 정상 범위입니다</h3>
              <p className="text-muted-foreground">
                현재 주의가 필요한 예산 알림이 없습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className={`border-l-4 ${getSeverityColor(alert.severity)}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getAlertIcon(alert.type)}
                    <div>
                      <CardTitle className="text-lg">{alert.budget.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="outline">
                          {EXPENSE_CATEGORY_LABELS[alert.budget.category]}
                        </Badge>
                        <span>•</span>
                        <span>{alert.budget.fiscalYear}년</span>
                        {alert.budget.fiscalMonth && (
                          <>
                            <span>{alert.budget.fiscalMonth}월</span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant={
                      alert.severity === 'high' ? 'destructive' :
                      alert.severity === 'medium' ? 'default' : 'secondary'
                    }
                  >
                    {alert.severity === 'high' ? '긴급' :
                     alert.severity === 'medium' ? '주의' : '정보'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* 알림 메시지 */}
                  <Alert className={getSeverityColor(alert.severity)}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{alert.message}</strong>
                    </AlertDescription>
                  </Alert>
                  {/* 예산 사용 현황 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        예산 현황
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">할당 예산:</span>
                          <span className="font-medium">
                            {formatCurrency(alert.budget.allocatedAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">사용 금액:</span>
                          <span className="font-medium">
                            {formatCurrency(alert.budget.usedAmount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">잔여 예산:</span>
                          <span className={`font-medium ${
                            alert.budget.remainingAmount < 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {formatCurrency(alert.budget.remainingAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        사용률
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">진행률</span>
                          <span className={`text-sm font-medium ${
                            alert.usage >= 100 ? 'text-red-600' :
                            alert.usage >= 80 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {alert.usage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={Math.min(alert.usage, 100)} 
                          className="h-3"
                        />
                        {alert.usage >= 100 && (
                          <p className="text-xs text-red-600">
                            예산을 {(alert.usage - 100).toFixed(1)}% 초과했습니다
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* 조직 정보 */}
                  {(alert.budget.branchName || alert.budget.departmentName) && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        조직 정보
                      </h4>
                      <div className="flex items-center gap-4 text-sm">
                        {alert.budget.branchName && (
                          <span>지점: {alert.budget.branchName}</span>
                        )}
                        {alert.budget.departmentName && (
                          <span>부서: {alert.budget.departmentName}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {/* 권장 조치 */}
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2 text-blue-800">권장 조치</h4>
                    <p className="text-sm text-blue-700">{alert.recommendedAction}</p>
                  </div>
                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      상세 보기
                    </Button>
                    <Button variant="outline" size="sm">
                      <Target className="h-4 w-4 mr-2" />
                      예산 수정
                    </Button>
                    {alert.severity === 'high' && (
                      <Button size="sm" className="bg-red-600 hover:bg-red-700">
                        <AlertTriangle className="h-4 w-4 mr-2" />
                        긴급 조치
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
