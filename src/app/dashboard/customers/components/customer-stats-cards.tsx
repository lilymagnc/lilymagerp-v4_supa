"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, TrendingUp, Users } from "lucide-react";
import { Customer } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useAuth } from "@/hooks/use-auth";
import { useMemo } from "react";
import { parseDate } from "@/lib/date-utils";

interface CustomerStatsCardsProps {
  customers: Customer[];
  selectedBranch?: string;
}

export function CustomerStatsCards({ customers, selectedBranch }: CustomerStatsCardsProps) {
  const { orders } = useOrders();
  const { user } = useAuth();

  const isHeadOfficeAdmin = user?.role === '본사 관리자';
  const myBranch = user?.franchise || user?.branchName;
  const currentTargetBranch = selectedBranch && selectedBranch !== "all" ? selectedBranch : (!isHeadOfficeAdmin ? myBranch : null);

  // 지점별 포인트 사용 통계 및 등급 분포 계산
  const { branchPointStats, gradeStats } = useMemo(() => {
    const stats: Record<string, { totalPointsUsed: number; totalCustomers: number; topCustomer: Customer | null }> = {};
    const grades: Record<string, number> = { 'VVIP': 0, 'VIP': 0, '일반': 0, '신규': 0 };

    customers.forEach(customer => {
      const grade = customer.grade || '신규';
      grades[grade] = (grades[grade] || 0) + 1;

      const branches = customer.branches || {};
      const primaryBranch = customer.primaryBranch || customer.branch;

      // 고객이 등록된 모든 지점 처리 ("all" 제외)
      const customerBranches = Object.keys(branches).length > 0
        ? Object.keys(branches).filter(branch => branch !== "all" && branch !== "")
        : [primaryBranch].filter(branch => branch && branch !== "all" && branch !== "");

      customerBranches.forEach(branchName => {
        if (!stats[branchName]) {
          stats[branchName] = { totalPointsUsed: 0, totalCustomers: 0, topCustomer: null };
        }

        stats[branchName].totalCustomers++;

        // 해당 고객의 주문에서 포인트 사용량 계산
        const customerOrders = orders.filter(order =>
          (order.orderer?.name === customer.name && order.orderer?.contact === customer.contact) ||
          order.orderer?.id === customer.id
        );

        const pointsUsed = customerOrders.reduce((total, order) =>
          total + (order.summary?.pointsUsed || 0), 0
        );

        stats[branchName].totalPointsUsed += pointsUsed;

        // 해당 지점에서 가장 많은 포인트를 가진 고객 찾기
        if (!stats[branchName].topCustomer || (customer.points || 0) > (stats[branchName].topCustomer.points || 0)) {
          stats[branchName].topCustomer = customer;
        }
      });
    });

    return { branchPointStats: stats, gradeStats: grades };
  }, [customers, orders]);

  // 해당 지점 고객 필터링 (통계용)
  const branchCustomers = useMemo(() => {
    if (!currentTargetBranch) return [];
    return customers.filter(c =>
      c.branch === currentTargetBranch || (c.branches && c.branches[currentTargetBranch])
    );
  }, [customers, currentTargetBranch]);

  // TOP 10 고객 리스트 (포인트 보유량 기준)
  const top10Customers = useMemo(() => {
    const list = currentTargetBranch ? branchCustomers : customers;
    return [...list]
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 10)
      .map((customer, index) => {
        // 최근 주문에서 지점 정보 가져오기
        const customerOrders = orders.filter(order =>
          (order.orderer?.name === customer.name && order.orderer?.contact === customer.contact) ||
          order.orderer?.id === customer.id
        ).sort((a, b) => {
          const dateA = parseDate(a.orderDate) || new Date();
          const dateB = parseDate(b.orderDate) || new Date();
          return dateB.getTime() - dateA.getTime();
        });

        const lastOrderBranch = customerOrders[0]?.branchName ||
          (customer.primaryBranch && customer.primaryBranch !== "all" ? customer.primaryBranch : "") ||
          (customer.branch && customer.branch !== "all" ? customer.branch : "") ||
          '정보 없음';
        const totalOrderAmount = customerOrders.reduce((total, order) => total + (order.summary?.total || 0), 0);

        return {
          ...customer,
          rank: index + 1,
          lastOrderBranch,
          totalOrderAmount,
          orderCount: customerOrders.length
        };
      });
  }, [customers, orders]);

  // 선택된 지점에 따른 필터링
  const displayBranchStats = selectedBranch && selectedBranch !== "all"
    ? { [selectedBranch]: branchPointStats[selectedBranch] }
    : branchPointStats;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {/* 전체 고객 수 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">전체 고객</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {customers.length.toLocaleString()}명
            {currentTargetBranch && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                (지점: {branchCustomers.length}명)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {currentTargetBranch ? `${currentTargetBranch} 및 전체 고객 수` : "등록된 총 고객 수"}
          </p>
        </CardContent>
      </Card>

      {/* 총 보유 포인트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 포인트</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {customers.reduce((total, customer) => total + (customer.points || 0), 0).toLocaleString()}P
            {currentTargetBranch && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({branchCustomers.reduce((total, c) => total + (c.points || 0), 0).toLocaleString()}P)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {currentTargetBranch ? `${currentTargetBranch} 및 전체 포인트` : "모든 고객의 포인트 합계"}
          </p>
        </CardContent>
      </Card>

      {/* 등급별 현황 및 지점별 통계는 본사 관리자에게만 노출 */}
      {isHeadOfficeAdmin && !selectedBranch && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">등급별 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col items-center flex-1 min-w-[60px] p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-[10px] text-primary font-bold">VVIP</span>
                  <span className="text-lg font-bold">{gradeStats['VVIP']}</span>
                </div>
                <div className="flex flex-col items-center flex-1 min-w-[60px] p-2 bg-orange-500/5 rounded-lg border border-orange-500/20">
                  <span className="text-[10px] text-orange-600 font-bold">VIP</span>
                  <span className="text-lg font-bold">{gradeStats['VIP']}</span>
                </div>
                <div className="flex flex-col items-center flex-1 min-w-[60px] p-2 bg-blue-500/5 rounded-lg border border-blue-500/20">
                  <span className="text-[10px] text-blue-600 font-bold">일반</span>
                  <span className="text-lg font-bold">{gradeStats['일반']}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                지점별 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-1">
                {Object.entries(displayBranchStats).slice(0, 3).map(([branchName, stats]) => (
                  <div key={branchName} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                    <span className="font-medium truncate max-w-[80px]">{branchName}</span>
                    <span className="text-muted-foreground">{stats?.totalCustomers || 0}명</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* TOP 10 고객 */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            TOP 10 고객 (포인트 보유량 {currentTargetBranch ? `- ${currentTargetBranch}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {top10Customers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={customer.rank <= 3 ? "default" : "secondary"} className="text-xs">
                    {customer.rank}위
                  </Badge>
                  <div>
                    <div className="font-medium text-sm">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {customer.companyName || customer.contact}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {customer.lastOrderBranch}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-primary">
                    {(customer.points || 0).toLocaleString()}P
                  </div>
                  <div className="text-xs text-muted-foreground">
                    주문 {customer.orderCount}회
                  </div>
                  <div className="text-xs text-muted-foreground">
                    총 {(customer.totalOrderAmount || 0).toLocaleString()}원
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
