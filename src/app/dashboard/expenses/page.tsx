"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  DollarSign, 
  FileText, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  CreditCard,
  TrendingUp,
  BarChart3,
  Receipt
} from 'lucide-react';
import { ExpenseRequestForm } from './components/expense-request-form';
import { ExpenseRequestList } from './components/expense-request-list';
import { ExpenseAnalytics } from './components/expense-analytics';
import { ExpenseApproval } from './components/expense-approval';
import { useExpenses } from '@/hooks/use-expenses';
export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { expenses, loading, stats } = useExpenses();
  const handleCreateExpense = () => {
    setShowCreateForm(true);
    setActiveTab('create');
  };
  const handleExpenseCreated = () => {
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
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">비용 관리</h1>
          <p className="text-muted-foreground mt-1">
            회사의 모든 비용을 체계적으로 관리합니다
          </p>
        </div>
        <Button onClick={handleCreateExpense} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          새 비용 신청
        </Button>
      </div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">전체 신청</p>
                <p className="text-2xl font-bold">{stats.totalRequests}</p>
                <p className="text-xs text-blue-600">
                  이번 달 {stats.totalRequests}건
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
                <p className="text-sm text-muted-foreground">승인 대기</p>
                <p className="text-2xl font-bold">{stats.pendingRequests}</p>
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
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">승인 완료</p>
                <p className="text-2xl font-bold">{stats.approvedRequests}</p>
                <p className="text-xs text-green-600">
                  지급 대기 포함
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">이번 달 총액</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.monthlyAmount)}</p>
                <p className="text-xs text-purple-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  전체 {formatCurrency(stats.totalAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* 메인 콘텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            신청 목록
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            새 신청
          </TabsTrigger>
          <TabsTrigger value="approval" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            승인 관리
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            분석
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            영수증
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                비용 신청 목록
              </CardTitle>
              <CardDescription>
                생성된 비용 신청을 확인하고 관리합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseRequestList 
                expenses={expenses} 
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
                새 비용 신청
              </CardTitle>
              <CardDescription>
                비용 항목을 입력하고 신청서를 작성합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseRequestForm 
                onSuccess={handleExpenseCreated}
                onCancel={() => setActiveTab('list')}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="approval" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                승인 관리
              </CardTitle>
              <CardDescription>
                승인 대기 중인 비용 신청을 검토하고 처리합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpenseApproval />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="analytics" className="mt-6">
          <ExpenseAnalytics />
        </TabsContent>
        <TabsContent value="receipts" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                영수증 관리
              </CardTitle>
              <CardDescription>
                업로드된 영수증을 관리하고 확인합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">영수증 관리 기능은 준비 중입니다.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
