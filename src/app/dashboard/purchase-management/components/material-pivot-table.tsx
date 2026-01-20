
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Printer, FileDown, Edit2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { MaterialRequest } from '@/types/material-request';
import { useMaterials } from '@/hooks/use-materials';

interface MaterialPivotTableProps {
  requests: MaterialRequest[];
}

interface PivotData {
  [materialId: string]: {
    materialName: string;
    supplier: string;
    price: number;
    total: number;
    values: { [columnKey: string]: number };
  };
}

export function MaterialPivotTable({ requests }: MaterialPivotTableProps) {
  const { materials } = useMaterials(); // 자재 원본 데이터 접근
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [supplierOverrides, setSupplierOverrides] = useState<Record<string, string>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);

  const { pivotData, uniqueColumns } = useMemo(() => {
    const data: PivotData = {};
    const columnSet = new Set<string>();

    const formatDate = (timestamp: any): string => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    };

    // 구매 전 확인용이므로 배송 시작 이후 상태 제외 (shipping, delivered, completed 상태)
    const activeRequests = requests.filter(req => !['shipping', 'delivered', 'completed'].includes(req.status));

    activeRequests.forEach(req => {
      if (!req.createdAt) return;
      const requestDate = formatDate(req.createdAt);
      const columnKey = `${req.branchName} (${requestDate})`;
      columnSet.add(columnKey);

      req.requestedItems.forEach(item => {
        if (!data[item.materialId]) {
          const originalMaterial = materials.find(m => m.id === item.materialId.split('-')[0]);
          data[item.materialId] = {
            materialName: item.materialName,
            supplier: originalMaterial?.supplier || '미지정',
            price: originalMaterial?.price || 0,
            total: 0,
            values: {},
          };
        }
        data[item.materialId].values[columnKey] = 
          (data[item.materialId].values[columnKey] || 0) + item.requestedQuantity;
      });
    });

    Object.values(data).forEach(matData => {
      matData.total = Object.values(matData.values).reduce((sum, qty) => sum + qty, 0);
    });

    const sortedColumns = Array.from(columnSet).sort();
    return { pivotData: data, uniqueColumns: sortedColumns };
  }, [requests, materials]);

  const columnTotals = useMemo(() => {
    const totals: { [columnKey: string]: number } = {};
    uniqueColumns.forEach(col => totals[col] = 0);
    Object.values(pivotData).forEach(material => {
      uniqueColumns.forEach(col => {
        totals[col] += material.values[col] || 0;
      });
    });
    return totals;
  }, [pivotData, uniqueColumns]);

  const handleToggleCheck = (materialId: string) => {
    setCheckedItems(prev => ({ ...prev, [materialId]: !prev[materialId] }));
  };

  const handleSupplierUpdate = (materialId: string, newSupplier: string) => {
    setSupplierOverrides(prev => ({ ...prev, [materialId]: newSupplier }));
    setEditingSupplier(null);
  };

  const handlePriceUpdate = (materialId: string, newPrice: string) => {
    const price = parseFloat(newPrice);
    if (!isNaN(price)) {
      setPriceOverrides(prev => ({ ...prev, [materialId]: price }));
    }
    setEditingPrice(null);
  };

  const handlePrint = () => window.print();

  const handleExportXLSX = () => {
    const header = ['상태', '품목', '구매처', ...uniqueColumns, '총계'];
    const body = Object.entries(pivotData).map(([id, data]) => [
      checkedItems[id] ? '구매완료' : '대기중',
      data.materialName,
      supplierOverrides[id] || data.supplier,
      ...uniqueColumns.map(col => data.values[col] || 0),
      data.total
    ]);
    const footer = ['합계', '', '', ...uniqueColumns.map(col => columnTotals[col]), Object.values(columnTotals).reduce((sum, val) => sum + val, 0)];

    const worksheetData = [header, ...body, footer];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '자재 취합 뷰');
    XLSX.writeFile(workbook, `릴리맥_매장별구매요청_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <Card>
      <CardHeader className="no-print">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>자재별 취합 뷰</CardTitle>
            <CardDescription>체크박스로 구매 여부를 표시하고, 구매처를 수정할 수 있습니다.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportXLSX} variant="outline" size="sm"><FileDown className="h-4 w-4 mr-2" />XLSX</Button>
            <Button onClick={handlePrint} variant="outline" size="sm"><Printer className="h-4 w-4 mr-2" />인쇄</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="printable-area">
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-xl font-bold">릴리맥 매장별 구매요청서</h1>
          <p className="text-sm">인쇄일: {new Date().toLocaleDateString('ko-KR')}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] no-print"></TableHead>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">품목 (구매처)</TableHead>
              <TableHead className="w-[120px]">단가</TableHead>
              {uniqueColumns.map(col => <TableHead key={col} className="text-center">{col}</TableHead>)}
              <TableHead className="text-right font-bold">총계</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(pivotData).map(([id, data]) => (
              <TableRow key={id} data-state={checkedItems[id] ? 'checked' : 'unchecked'} className="data-[state=checked]:bg-muted/50">
                <TableCell className="no-print">
                  <Checkbox checked={!!checkedItems[id]} onCheckedChange={() => handleToggleCheck(id)} />
                </TableCell>
                <TableCell className="sticky left-0 bg-inherit z-10 font-medium data-[state=checked]:text-muted-foreground data-[state=checked]:line-through">
                  {data.materialName}
                  {editingSupplier === id ? (
                    <Input 
                      defaultValue={supplierOverrides[id] || data.supplier}
                      onBlur={(e) => handleSupplierUpdate(id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSupplierUpdate(id, e.currentTarget.value)}
                      autoFocus
                      className="h-7 mt-1"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground ml-2 group cursor-pointer" onClick={() => setEditingSupplier(id)}>
                      ({(supplierOverrides[id] || data.supplier).substring(0, 3)})
                      <Edit2 className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-100" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="data-[state=checked]:text-muted-foreground">
                  {editingPrice === id ? (
                    <Input 
                      type="number"
                      defaultValue={priceOverrides[id] || data.price}
                      onBlur={(e) => handlePriceUpdate(id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePriceUpdate(id, e.currentTarget.value)}
                      autoFocus
                      className="h-7 w-24 text-right"
                    />
                  ) : (
                    <div className="group cursor-pointer text-right" onClick={() => setEditingPrice(id)}>
                      <span>{(priceOverrides[id] || data.price).toLocaleString()}원</span>
                      <Edit2 className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </TableCell>
                {uniqueColumns.map(col => <TableCell key={col} className="text-center data-[state=checked]:text-muted-foreground">{data.values[col] || '-'}</TableCell>)}
                <TableCell className="text-right font-bold data-[state=checked]:text-muted-foreground">{data.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="no-print"></TableCell>
              <TableCell className="sticky left-0 bg-background z-10 font-bold">합계</TableCell>
              <TableCell>{/* 단가 합계는 의미 없으므로 비워둠 */}</TableCell>
              {uniqueColumns.map(col => <TableCell key={col} className="text-center font-bold">{columnTotals[col]}</TableCell>)}
              <TableCell className="text-right font-bold">{Object.values(columnTotals).reduce((sum, val) => sum + val, 0)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
