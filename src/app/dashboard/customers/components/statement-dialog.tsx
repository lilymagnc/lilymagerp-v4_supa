"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Customer } from "@/hooks/use-customers";
import { useOrders } from "@/hooks/use-orders";
import { useBranches } from "@/hooks/use-branches";
import { Order } from "@/hooks/use-orders";
import { Branch } from "@/hooks/use-branches";
import { useRouter } from "next/navigation";

interface StatementDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

interface StatementData {
  customer: Customer;
  branch: Branch | null;
  period: {
    startDate: Date;
    endDate: Date;
  };
  orders: Order[];
  summary: {
    totalOrders: number;
    totalAmount: number;
    totalDeliveryFee: number;
    grandTotal: number;
  };
}

export function StatementDialog({ isOpen, onOpenChange, customer }: StatementDialogProps) {
  const router = useRouter();
  const { orders } = useOrders();
  const { branches } = useBranches();
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [statementData, setStatementData] = useState<StatementData | null>(null);

  useEffect(() => {
    if (!customer || !startDate || !endDate) {
      setStatementData(null);
      return;
    }

    // 고객의 담당지점 정보 찾기
    const branch = branches.find(b => b.name === customer.branch);

    // 고객의 주문 내역 필터링 - 연락처로 매칭
    const customerOrders = orders.filter(order => {
      let orderDate: Date;
      const orderDateValue = order.orderDate as any;
      
      // Firebase Timestamp 객체인 경우
      if (orderDateValue && typeof orderDateValue.toDate === 'function') {
        orderDate = orderDateValue.toDate();
      } 
      // Timestamp 객체의 seconds/nanoseconds 구조인 경우
      else if (orderDateValue && typeof orderDateValue.seconds === 'number') {
        orderDate = new Date(orderDateValue.seconds * 1000);
      }
      // 일반 Date 객체나 문자열인 경우
      else {
        orderDate = new Date(orderDateValue);
      }
      
      return order.orderer.contact === customer.contact && 
             orderDate >= startDate && 
             orderDate <= new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59);
    });

    const summary = {
      totalOrders: customerOrders.length,
      totalAmount: customerOrders.reduce((sum, order) => sum + (order.summary.total || 0), 0),
      totalDeliveryFee: customerOrders.reduce((sum, order) => sum + (order.summary.deliveryFee || 0), 0),
      grandTotal: customerOrders.reduce((sum, order) => sum + (order.summary.total || 0), 0)
    };

    setStatementData({
      customer,
      branch,
      period: { startDate, endDate },
      orders: customerOrders,
      summary
    });
  }, [customer, startDate, endDate, orders, branches]);

  const generateStatement = () => {
    if (!statementData || !customer) {
      return;
    }
    
    // 인쇄 페이지로 이동
    const params = new URLSearchParams({
      customerId: customer.id,
      startDate: startDate!.toISOString(),
      endDate: endDate!.toISOString()
    });
    
    router.push(`/dashboard/customers/statement/print?${params.toString()}`);
    onOpenChange(false); // 다이얼로그 닫기
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>거래명세서 생성</DialogTitle>
          <DialogDescription>
            고객의 거래 내역을 조회하여 거래명세서를 생성합니다.
          </DialogDescription>
        </DialogHeader>

        {/* 고객 정보 */}
        {customer && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">고객 정보</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">고객명:</span> {customer.name}
              </div>
              <div>
                <span className="font-medium">연락처:</span> {customer.contact}
              </div>
              <div>
                <span className="font-medium">유형:</span> {customer.type === 'personal' ? '개인' : '기업'}
              </div>
              <div>
                <span className="font-medium">담당지점:</span> {customer.branch}
              </div>
            </div>
          </div>
        )}

        {/* 기간 선택 */}
        <div className="mb-6">
          <h3 className="font-semibold mb-4">거래 기간 선택</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">시작일</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: ko }) : "날짜 선택"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">종료일</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: ko }) : "날짜 선택"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* 거래 내역 요약 */}
        {statementData && (
          <div className="space-y-4">
            <h3 className="font-semibold">거래 내역 요약</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{statementData.summary.totalOrders}</div>
                <div className="text-sm text-muted-foreground">총 주문 수</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{statementData.summary.totalAmount.toLocaleString()}원</div>
                <div className="text-sm text-muted-foreground">총 상품 금액</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{statementData.summary.totalDeliveryFee.toLocaleString()}원</div>
                <div className="text-sm text-muted-foreground">총 배송비</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{statementData.summary.grandTotal.toLocaleString()}원</div>
                <div className="text-sm text-muted-foreground">총 합계</div>
              </div>
            </div>

            {/* 주문 미리보기 */}
            <div className="space-y-2">
              <h4 className="font-medium">주문 내역 미리보기</h4>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {statementData.orders.map((order, index) => (
                  <div key={order.id} className="text-xs p-2 bg-white rounded border">
                    <div className="flex justify-between mb-1">
                      <span>{(() => {
                        const orderDateValue = order.orderDate as any;
                        let orderDate: Date;
                        
                        if (orderDateValue && typeof orderDateValue.toDate === 'function') {
                          orderDate = orderDateValue.toDate();
                        } else if (orderDateValue && typeof orderDateValue.seconds === 'number') {
                          orderDate = new Date(orderDateValue.seconds * 1000);
                        } else {
                          orderDate = new Date(orderDateValue);
                        }
                        
                        return format(orderDate, "MM/dd", { locale: ko });
                      })()}</span>
                      <span>{order.summary.total?.toLocaleString()}원</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {order.items.map(item => item.name).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button 
            onClick={generateStatement} 
            disabled={!statementData || statementData.orders.length === 0}
          >
            인쇄하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
