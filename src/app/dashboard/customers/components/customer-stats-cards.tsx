"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, TrendingUp, Users } from "lucide-react";
import { Customer } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useMemo } from "react";

interface CustomerStatsCardsProps {
  customers: Customer[];
  selectedBranch?: string;
}

export function CustomerStatsCards({ customers, selectedBranch }: CustomerStatsCardsProps) {
  const { orders } = useOrders();

  // 지점별 포인트 사용 통계 계산
  const branchPointStats = useMemo(() => {
    const stats: Record<string, { totalPointsUsed: number; totalCustomers: number; topCustomer: Customer | null }> = {};
    
    customers.forEach(customer => {
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
    
    return stats;
  }, [customers, orders]);

  // TOP 10 고객 리스트 (포인트 보유량 기준)
  const top10Customers = useMemo(() => {
    return [...customers]
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 10)
      .map((customer, index) => {
        // 최근 주문에서 지점 정보 가져오기
        const customerOrders = orders.filter(order => 
          (order.orderer?.name === customer.name && order.orderer?.contact === customer.contact) ||
          order.orderer?.id === customer.id
        ).sort((a, b) => {
          const dateA = a.orderDate?.toDate ? a.orderDate.toDate() : new Date(a.orderDate);
          const dateB = b.orderDate?.toDate ? b.orderDate.toDate() : new Date(b.orderDate);
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
          <div className="text-2xl font-bold">{customers.length}명</div>
          <p className="text-xs text-muted-foreground">
            등록된 총 고객 수
          </p>
        </CardContent>
      </Card>

      {/* 총 보유 포인트 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 보유 포인트</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {customers.reduce((total, customer) => total + (customer.points || 0), 0).toLocaleString()}P
          </div>
          <p className="text-xs text-muted-foreground">
            모든 고객의 포인트 합계
          </p>
        </CardContent>
      </Card>

      {/* 지점별 통계 */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            지점별 고객 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(displayBranchStats).slice(0, 4).map(([branchName, stats]) => (
              <div key={branchName} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {branchName}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {stats?.totalCustomers || 0}명
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {(stats?.totalPointsUsed || 0).toLocaleString()}P 사용
                  </div>
                  {stats?.topCustomer && (
                    <div className="text-xs text-muted-foreground">
                      최고: {stats.topCustomer.name} ({(stats.topCustomer.points || 0).toLocaleString()}P)
                    </div>
                  )}
                </div>
              </div>
            ))}
            {Object.keys(displayBranchStats).length > 4 && (
              <p className="text-xs text-muted-foreground text-center">
                외 {Object.keys(displayBranchStats).length - 4}개 지점
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TOP 10 고객 */}
      <Card className="md:col-span-2 lg:col-span-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            TOP 10 고객 (포인트 보유량)
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
