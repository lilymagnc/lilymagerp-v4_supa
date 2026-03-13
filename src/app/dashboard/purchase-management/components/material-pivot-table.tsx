
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Printer, FileDown, Edit2, ShoppingCart, Check, ChevronsUpDown, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { MaterialRequest } from '@/types/material-request';
import { useMaterials } from '@/hooks/use-materials';
import { usePartners } from '@/hooks/use-partners';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface MaterialPivotTableProps {
  requests: MaterialRequest[];
  onPurchaseComplete?: (requestIds: string[]) => void;
  onExportToGoogleSheet?: (data: any[]) => Promise<void>;
}

interface PivotData {
  [materialName: string]: {
    materialName: string;
    supplier: string;
    price: number;
    total: number;
    values: { [columnKey: string]: number };
  };
}

export function MaterialPivotTable({ requests, onPurchaseComplete, onExportToGoogleSheet }: MaterialPivotTableProps) {
  const { materials, fetchMaterials } = useMaterials();
  const { partners } = usePartners();

  useEffect(() => {
    if (materials.length === 0) {
      fetchMaterials();
    }
  }, [materials.length, fetchMaterials]);

  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [supplierOverrides, setSupplierOverrides] = useState<Record<string, string>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<'name' | 'supplier' | 'price' | 'total'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: 'name' | 'supplier' | 'price' | 'total') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'name' || column === 'supplier' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 inline-block opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1 inline-block text-primary" />
      : <ArrowDown className="h-3 w-3 ml-1 inline-block text-primary" />;
  };

  const filteredPartners = useMemo(() => {
    if (!supplierSearch) return partners;
    return partners.filter(p => p.name.toLowerCase().includes(supplierSearch.toLowerCase()));
  }, [partners, supplierSearch]);

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
      const shortBranch = req.branchName.replace('릴리맥', '');
      const shortReqNum = req.requestNumber.replace('REQ-', '');
      const columnKey = `${shortBranch}\n${shortReqNum}`;
      columnSet.add(columnKey);

      req.requestedItems.forEach(item => {
        const groupKey = item.materialName;
        if (!data[groupKey]) {
          const originalMaterial = materials.find(m => m.name === item.materialName);
          data[groupKey] = {
            materialName: item.materialName,
            supplier: originalMaterial?.supplier || '미지정',
            price: originalMaterial?.price || item.estimatedPrice || 0,
            total: 0,
            values: {},
          };
        }
        data[groupKey].values[columnKey] =
          (data[groupKey].values[columnKey] || 0) + item.requestedQuantity;
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
    const header = ['상태', '품목', '구매처', ...uniqueColumns.map(c => c.replace('\n', ' ')), '총계'];
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

  const handleExportGoogleSheet = async () => {
    if (!onExportToGoogleSheet) return;

    // 구글 시트 전송용 데이터 포맷팅
    const sheetData = Object.entries(pivotData).map(([id, data]) => {
      const row: any = {
        '상태': checkedItems[id] ? '구매완료' : '대기중',
        '품목': data.materialName,
        '구매처': supplierOverrides[id] || data.supplier,
      };
      
      uniqueColumns.forEach(col => {
        row[col.replace('\n', ' ')] = data.values[col] || 0;
      });
      
      row['총계'] = data.total;
      return row;
    });

    await onExportToGoogleSheet(sheetData);
  };

  return (
    <Card>
      <CardHeader className="no-print">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>자재별 취합 뷰</CardTitle>
            <CardDescription>
              ✏️ <strong>구매처</strong>나 <strong>단가</strong>를 클릭하면 직접 수정할 수 있습니다. 체크박스로 구매 완료를 표시하세요.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={Object.keys(pivotData).length > 0 && Object.keys(pivotData).every(id => checkedItems[id]) ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const allIds = Object.keys(pivotData);
                const allChecked = allIds.every(id => checkedItems[id]);
                if (allChecked) {
                  setCheckedItems({});
                } else {
                  const newChecked: Record<string, boolean> = {};
                  allIds.forEach(id => { newChecked[id] = true; });
                  setCheckedItems(newChecked);
                }
              }}
            >
              {Object.keys(pivotData).length > 0 && Object.keys(pivotData).every(id => checkedItems[id]) ? '전체 해제' : '전체 선택'}
            </Button>
            <Button onClick={handleExportXLSX} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
            {onExportToGoogleSheet && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportGoogleSheet}
                className="flex items-center gap-2 border-green-200 hover:bg-green-50 text-green-700"
              >
                <div className="w-4 h-4 bg-green-600 rounded-sm flex items-center justify-center text-[10px] text-white font-bold">G</div>
                구글 시트로 전송
              </Button>
            )}
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
              <TableHead
                className="sticky left-0 bg-background z-10 min-w-[200px] select-none"
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="cursor-pointer hover:text-primary transition-colors flex items-center"
                    onClick={() => handleSort('name')}
                  >
                    품목 <SortIcon column="name" />
                  </span>
                  <span className="text-muted-foreground mr-1">|</span>
                  <span 
                    className="cursor-pointer hover:text-primary transition-colors flex items-center text-xs font-normal"
                    onClick={() => handleSort('supplier')}
                  >
                    구매처 <SortIcon column="supplier" />
                  </span>
                </div>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('price')}
              >
                단가 <SortIcon column="price" />
              </TableHead>
              {uniqueColumns.map(col => {
                const [branchName, reqNum] = col.split('\n');
                return (
                  <TableHead key={col} className="text-center min-w-[100px]">
                    <div className="text-xs font-semibold">{branchName}</div>
                    <div className="text-[10px] text-muted-foreground font-normal">{reqNum}</div>
                  </TableHead>
                );
              })}
              <TableHead
                className="text-right font-bold cursor-pointer hover:bg-muted/50 select-none"
                onClick={() => handleSort('total')}
              >
                총계 <SortIcon column="total" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(pivotData)
              .sort(([idA, a], [idB, b]) => {
                let comparison = 0;
                switch (sortColumn) {
                  case 'name':
                    comparison = a.materialName.localeCompare(b.materialName, 'ko');
                    break;
                  case 'supplier':
                    comparison = (supplierOverrides[idA] || a.supplier).localeCompare(supplierOverrides[idB] || b.supplier, 'ko');
                    break;
                  case 'price':
                    comparison = (priceOverrides[idA] || a.price) - (priceOverrides[idB] || b.price);
                    break;
                  case 'total':
                    comparison = a.total - b.total;
                    break;
                }
                return sortDirection === 'asc' ? comparison : -comparison;
              })
              .map(([id, data]) => (
              <TableRow key={id} data-state={checkedItems[id] ? 'checked' : 'unchecked'} className="data-[state=checked]:bg-muted/50">
                <TableCell className="no-print">
                  <Checkbox checked={!!checkedItems[id]} onCheckedChange={() => handleToggleCheck(id)} />
                </TableCell>
                <TableCell className="sticky left-0 bg-inherit z-10 font-medium data-[state=checked]:text-muted-foreground data-[state=checked]:line-through">
                  {data.materialName}
                  {editingSupplier === id ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Popover
                        open={editingSupplier === id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setEditingSupplier(null);
                            setSupplierSearch("");
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={editingSupplier === id}
                            className="h-8 text-xs w-[160px] justify-between px-2"
                          >
                            <span className="truncate">
                              {supplierOverrides[id] || data.supplier}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                          <div className="flex flex-col w-full bg-white border rounded-md shadow-md">
                            <div className="flex items-center border-b px-2 py-2">
                              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <input
                                placeholder="구매처 검색..."
                                value={supplierSearch}
                                autoFocus
                                className="flex h-8 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                onChange={(e) => setSupplierSearch(e.target.value)}
                              />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-1">
                              <div
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSupplierUpdate(id, "미지정");
                                  setSupplierSearch("");
                                }}
                                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                미지정
                                <Check
                                  className={cn(
                                    "ml-auto h-4 w-4",
                                    (supplierOverrides[id] || data.supplier) === "미지정" ? "opacity-100" : "opacity-0"
                                  )}
                                />
                              </div>
                              {filteredPartners.map((p) => (
                                <div
                                  key={p.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    handleSupplierUpdate(id, p.name);
                                    setSupplierSearch("");
                                  }}
                                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground transition-colors"
                                >
                                  {p.name}
                                  <Check
                                    className={cn(
                                      "ml-auto h-4 w-4",
                                      (supplierOverrides[id] || data.supplier) === p.name ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                </div>
                              ))}
                              {filteredPartners.length === 0 && supplierSearch && (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  검색 결과가 없습니다.
                                </div>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-xs cursor-pointer hover:bg-blue-50 border border-dashed border-transparent hover:border-blue-300 transition-colors"
                      onClick={() => setEditingSupplier(id)}
                    >
                      <span className={`${(supplierOverrides[id] || data.supplier) === '미지정' ? 'text-orange-500' : 'text-blue-600'}`}>
                        {supplierOverrides[id] || data.supplier}
                      </span>
                      <Edit2 className="h-3 w-3 text-muted-foreground" />
                    </div>
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

      {/* 체크된 품목 액션 바 */}
      {Object.values(checkedItems).some(v => v) && (
        <div className="mx-6 mb-6 p-4 bg-primary/5 border-2 border-primary/20 rounded-lg flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">
              ✅ {Object.values(checkedItems).filter(v => v).length}개 품목 선택됨
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCheckedItems({})}
            >
              선택 해제
            </Button>
            {onPurchaseComplete && (
              <Button
                size="sm"
                onClick={() => {
                  // 체크된 품목의 materialName으로 관련 요청 ID들 추출
                  const checkedMaterialNames = Object.entries(checkedItems)
                    .filter(([_, checked]) => checked)
                    .map(([name]) => name);

                  const relatedRequestIds = new Set<string>();
                  const activeRequests = requests.filter(req => !['shipping', 'delivered', 'completed'].includes(req.status));
                  activeRequests.forEach(req => {
                    req.requestedItems.forEach(item => {
                      if (checkedMaterialNames.includes(item.materialName)) {
                        relatedRequestIds.add(req.id);
                      }
                    });
                  });

                  if (relatedRequestIds.size > 0) {
                    onPurchaseComplete(Array.from(relatedRequestIds));
                  }
                }}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4" />
                즉시 구매 완료 ({Object.values(checkedItems).filter(v => v).length}개 품목)
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
