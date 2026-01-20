
"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Barcode as BarcodeIcon } from "lucide-react";
import { StockUpdateForm } from "@/app/dashboard/products/components/stock-update-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MaterialDetails } from "./material-details";
import { Barcode } from "@/components/barcode";
import { PrintOptionsDialog } from "@/components/print-options-dialog";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { MaterialStockUpdateForm } from "./material-stock-update-form";

export type Material = {
  docId: string;
  id: string;
  name: string;
  mainCategory: string;
  midCategory: string;
  price: number;
  supplier: string;
  stock: number;
  status: string;
  size: string;
  color: string;
  branch: string;
};
interface MaterialTableProps {
  materials: Material[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (material: Material) => void;
  onDelete: (docId: string) => void;
  selectedMaterials?: string[];
  isAdmin?: boolean;
  onRefresh?: () => void; // 새로 추가
}

export function MaterialTable({ materials, onSelectionChange, onEdit, onDelete, onRefresh }: MaterialTableProps) {
  const router = useRouter();
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  const handleSelectionChange = (id: string) => {
    const newSelection = { ...selectedRows, [id]: !selectedRows[id] };
    if (!newSelection[id]) {
      delete newSelection[id];
    }
    setSelectedRows(newSelection);
    onSelectionChange(Object.keys(newSelection));
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (checked) {
      materials.forEach(m => newSelection[m.id] = true);
    }
    setSelectedRows(newSelection);
    onSelectionChange(Object.keys(newSelection));
  };

  const isAllSelected = useMemo(() => {
    return materials.length > 0 && Object.keys(selectedRows).length === materials.length;
  }, [selectedRows, materials]);

  const handleEdit = (material: Material) => {
    setIsDetailOpen(false);
    onEdit(material);
  };

  const handleStockUpdate = (material: any) => {
    setSelectedMaterial(material);
    setIsStockFormOpen(true);
  };

  const handleRowClick = (material: any) => {
    setSelectedMaterial(material);
    setIsDetailOpen(true);
  }

  const handlePrint = (material: any) => {
    setSelectedMaterial(material);
    setIsPrintDialogOpen(true);
  }

  const handlePrintSubmit = ({ quantity, startPosition }: { quantity: number; startPosition: number }) => {
    if (!selectedMaterial) return;
    const params = new URLSearchParams({
      ids: selectedMaterial.id,
      type: 'material',
      quantity: String(quantity),
      start: String(startPosition),
    });
    router.push(`/dashboard/print-labels?${params.toString()}`);
    setIsPrintDialogOpen(false);
  };
  const handleCloseForms = () => {
    setIsStockFormOpen(false);
    setIsDetailOpen(false);
    setSelectedMaterial(null);
  };

  const getStatus = (status: string, stock: number) => {
    if (status === 'out_of_stock' || stock === 0) return { text: '품절', variant: 'destructive' as const };
    if (status === 'low_stock' || stock < 20) return { text: '재고 부족', variant: 'secondary' as const };
    return { text: '입고중', variant: 'default' as const };
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    aria-label="모두 선택"
                  />
                </TableHead>
                <TableHead>자재명</TableHead>
                <TableHead>바코드</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="hidden md:table-cell">카테고리</TableHead>
                <TableHead className="hidden sm:table-cell">가격</TableHead>
                <TableHead className="hidden md:table-cell">소속 지점</TableHead>
                <TableHead className="text-right">재고</TableHead>
                <TableHead>
                  <span className="sr-only">작업</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.length > 0 ? materials.map((material, idx) => (
                <MaterialRow
                  key={`${material.docId}-${idx}`}
                  material={material}
                  isSelected={!!selectedRows[material.id]}
                  onSelect={handleSelectionChange}
                  onClick={handleRowClick}
                  onEdit={handleEdit}
                  onStockUpdate={handleStockUpdate}
                  onPrint={handlePrint}
                  onDelete={onDelete}
                />
              )) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    조회된 자재가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* 기존 StockUpdateForm 대신 MaterialStockUpdateForm 사용 */}
      {isStockFormOpen && <MaterialStockUpdateForm
        isOpen={isStockFormOpen}
        onOpenChange={handleCloseForms}
        material={selectedMaterial}
        onStockUpdated={onRefresh} // 콜백 함수 전달
      />}
      {selectedMaterial && (
        <PrintOptionsDialog
          isOpen={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          onSubmit={handlePrintSubmit}
          itemName={selectedMaterial.name}
        />
      )}
      <MaterialDetails
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        material={selectedMaterial}
        onEdit={() => selectedMaterial && handleEdit(selectedMaterial)}
      />
    </>
  );
}

import React from "react";
import { memo } from "react";

const MaterialRow = memo(({
  material,
  isSelected,
  onSelect,
  onClick,
  onEdit,
  onStockUpdate,
  onPrint,
  onDelete
}: {
  material: Material;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: (material: Material) => void;
  onEdit: (material: Material) => void;
  onStockUpdate: (material: Material) => void;
  onPrint: (material: Material) => void;
  onDelete: (docId: string) => void;
}) => {
  const statusInfo = (status: string, stock: number) => {
    if (status === 'out_of_stock' || stock === 0) return { text: '품절', variant: 'destructive' as const };
    if (status === 'low_stock' || stock < 20) return { text: '재고 부족', variant: 'secondary' as const };
    return { text: '입고중', variant: 'default' as const };
  }

  const info = statusInfo(material.status, material.stock);

  return (
    <TableRow>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onSelect(material.id)}
          aria-label={`${material.name || '자재'} 선택`}
        />
      </TableCell>
      <TableCell className="font-medium cursor-pointer" onClick={() => onClick(material)}>
        {material.name || '이름 없음'}
      </TableCell>
      <TableCell className="cursor-pointer" onClick={() => onClick(material)}>
        <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground group">
          <BarcodeIcon className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          {material.id}
        </div>
      </TableCell>
      <TableCell className="cursor-pointer" onClick={() => onClick(material)}>
        <Badge variant={info.variant}>
          {info.text}
        </Badge>
      </TableCell>
      <TableCell className="hidden md:table-cell cursor-pointer" onClick={() => onClick(material)}>
        {material.mainCategory} &gt; {material.midCategory}
      </TableCell>
      <TableCell className="hidden sm:table-cell cursor-pointer" onClick={() => onClick(material)}>
        ₩{material.price.toLocaleString()}
      </TableCell>
      <TableCell className="hidden md:table-cell cursor-pointer" onClick={() => onClick(material)}>
        {material.branch}
      </TableCell>
      <TableCell className="text-right cursor-pointer" onClick={() => onClick(material)}>
        {material.stock}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <AlertDialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">메뉴 토글</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>작업</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onEdit(material)}>수정</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onStockUpdate(material)}>재고 업데이트</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPrint(material)}>라벨 인쇄</DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialogTrigger asChild>
                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>삭제</DropdownMenuItem>
              </AlertDialogTrigger>
            </DropdownMenuContent>
          </DropdownMenu>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                이 작업은 되돌릴 수 없습니다. '{material.name || '자재'}' ({material.branch || '지점 없음'}) 자재 데이터가 서버에서 영구적으로 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={() => onDelete(material.docId)}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
});

MaterialRow.displayName = "MaterialRow";
