
"use client";

import { useState, useMemo } from 'react';
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

interface MaterialStat {
  materialId: string;
  materialName: string;
  purchaseFrequency: number;
  totalQuantity: number;
  totalCost: number;
  averagePrice: number;
}

export default function MaterialUsageReport() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MaterialStat[]>([]);

  const handleGenerateReport = async () => {
    if (!date?.from || !date?.to) return;

    setLoading(true);
    const startDate = Timestamp.fromDate(date.from);
    const endDate = Timestamp.fromDate(date.to);

    const q = query(
      collection(db, 'purchaseBatches'),
      where('status', '==', 'completed'),
      where('purchaseDate', '>=', startDate),
      where('purchaseDate', '<=', endDate)
    );

    const querySnapshot = await getDocs(q);
    const materialData: { [key: string]: MaterialStat } = {};

    querySnapshot.docs.forEach(doc => {
      const batch = doc.data();
      batch.purchasedItems.forEach((item: any) => {
        const id = item.actualMaterialId || item.originalMaterialId;
        if (!materialData[id]) {
          materialData[id] = {
            materialId: id,
            materialName: item.actualMaterialName || item.originalMaterialName,
            purchaseFrequency: 0,
            totalQuantity: 0,
            totalCost: 0,
            averagePrice: 0,
          };
        }
        materialData[id].purchaseFrequency += 1;
        materialData[id].totalQuantity += item.actualQuantity;
        materialData[id].totalCost += item.totalAmount;
      });
    });

    const calculatedStats = Object.values(materialData).map(stat => ({
      ...stat,
      averagePrice: stat.totalCost / stat.totalQuantity,
    }));

    setStats(calculatedStats.sort((a, b) => b.totalCost - a.totalCost));
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>분석 옵션</CardTitle>
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
                id="date"
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
                <TableHead>자재명</TableHead>
                <TableHead className="text-right">구매 빈도</TableHead>
                <TableHead className="text-right">총 구매 수량</TableHead>
                <TableHead className="text-right">총 비용</TableHead>
                <TableHead className="text-right">평균 단가</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center">데이터를 불러오는 중입니다...</TableCell></TableRow>
              ) : stats.length > 0 ? (
                stats.map(stat => (
                  <TableRow key={stat.materialId}>
                    <TableCell>{stat.materialName}</TableCell>
                    <TableCell className="text-right">{stat.purchaseFrequency} 회</TableCell>
                    <TableCell className="text-right">{stat.totalQuantity.toLocaleString()}</TableCell>
                    <TableCell className="text-right">₩{stat.totalCost.toLocaleString()}</TableCell>
                    <TableCell className="text-right">₩{stat.averagePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={5} className="text-center">분석할 데이터가 없습니다.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
