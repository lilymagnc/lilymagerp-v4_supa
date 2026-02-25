"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building,
  Calendar,
  Users,
  BookOpen,
  FileText
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

// 간편 지출에서 가져온 컴포넌트들
import { ExpenseList } from '../simple-expenses/components/expense-list';
import { FixedCostTemplate } from '../simple-expenses/components/fixed-cost-template';

import { ExpenseRequestList } from './components/expense-request-list';
import { ExpenseApproval } from './components/expense-approval';
import { useExpenses } from '@/hooks/use-expenses';
import { LaborCostManager } from './components/labor-cost-manager';
import { BranchLedger } from './components/branch-ledger';

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState('headquarters');
  const { user } = useAuth();
  const { expenses, loading } = useExpenses();

  // 인건비 관리 접근 권한: 직위가 '대표'인 사용자만 접근 가능
  const hasLaborCostAccess = user?.position === '대표' || user?.email?.toLowerCase() === 'lilymag0301@gmail.com';

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">비용 관리 (본사)</h1>
          <p className="text-muted-foreground mt-1">
            본사 지출, 고정비, 인건비 및 전체 회계장부를 관리합니다.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="headquarters" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            본사 관리
          </TabsTrigger>
          <TabsTrigger value="fixed" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            고정비 관리
          </TabsTrigger>

          {hasLaborCostAccess && (
            <TabsTrigger value="labor" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              인건비 관리
            </TabsTrigger>
          )}

          <TabsTrigger value="ledger" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            회계 장부
          </TabsTrigger>

          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            결재함 (기존)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="headquarters" className="mt-6">
          <ExpenseList
            refreshTrigger={0}
            isHeadquarters={true}
          />
        </TabsContent>

        <TabsContent value="fixed" className="mt-6">
          <FixedCostTemplate
            onSuccess={() => { }}
          />
        </TabsContent>

        {hasLaborCostAccess && (
          <TabsContent value="labor" className="mt-6">
            <Card>
              <CardContent className="pt-6 border-t bg-white">
                <LaborCostManager />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="ledger" className="mt-6">
          <Card>
            <CardContent className="pt-6 border-t bg-white">
              <BranchLedger />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-6 space-y-4">
          {/* 기존 비용 신청 뷰들을 간략화하여 배치 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">비용 신청 승인 대기</CardTitle>
            </CardHeader>
            <CardContent>
              <ExpenseApproval />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">전체 비용 신청 내역</CardTitle>
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
      </Tabs>
    </div>
  );
}
