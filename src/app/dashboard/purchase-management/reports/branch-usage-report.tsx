
"use client";

import { useState } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchStat {
  branchId: string;
  branchName: string;
  requestCount: number;
  totalItemCount: number;
  totalCost: number;
}

export default function BranchUsageReport() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<BranchStat[]>([]);

  const handleGenerateReport = async () => {
    if (!date?.from || !date?.to) return;

    setLoading(true);
    const startDate = Timestamp.fromDate(date.from);
    const endDate = Timestamp.fromDate(date.to);

    const q = query(
      collection(db, 'materialRequests'),
      where('status', '==', 'completed'),
      where('updatedAt', '>=', startDate),
      where('updatedAt', '<=', endDate)
    );

    const querySnapshot = await getDocs(q);
    const branchData: { [key: string]: BranchStat } = {};

    querySnapshot.docs.forEach(doc => {
      const request = doc.data();
      const id = request.branchId;

      if (!branchData[id]) {
        branchData[id] = {
          branchId: id,
          branchName: request.branchName,
          requestCount: 0,
          totalItemCount: 0,
          totalCost: 0,
        };
      }

      branchData[id].requestCount += 1;
      if (request.actualPurchase?.items) {
        branchData[id].totalItemCount += request.actualPurchase.items.length;
        branchData[id].totalCost += request.actualPurchase.totalCost;
      }
    });

    const calculatedStats = Object.values(branchData);
    setStats(calculatedStats.sort((a, b) => b.totalCost - a.totalCost));
    setLoading(false);
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>지점별 자재 사용량 분석</CardTitle>
          <Button onClick={handleGenerateReport} disabled={loading}>
            {loading ? '분석 중...' : '리포트 생성'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date-branch"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>기간 선택</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">분석 결과</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>지점명</TableHead>
                <TableHead className="text-right">요청 횟수</TableHead>
                <TableHead className="text-right">총 구매 품목 수</TableHead>
                <TableHead className="text-right">총 구매 비용</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center">데이터를 불러오는 중입니다...</TableCell></TableRow>
              ) : stats.length > 0 ? (
                stats.map(stat => (
                  <TableRow key={stat.branchId}>
                    <TableCell>{stat.branchName}</TableCell>
                    <TableCell className="text-right">{stat.requestCount} 건</TableCell>
                    <TableCell className="text-right">{stat.totalItemCount.toLocaleString()} 개</TableCell>
                    <TableCell className="text-right">₩{stat.totalCost.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={4} className="text-center">분석할 데이터가 없습니다.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
