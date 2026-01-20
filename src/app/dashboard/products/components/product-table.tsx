
"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal } from "lucide-react";
import { StockUpdateForm } from "./stock-update-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ProductDetails } from "./product-details";
import { Barcode } from "@/components/barcode";
import { PrintOptionsDialog } from "@/components/print-options-dialog";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";

export type Product = {
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

interface ProductTableProps {
  products: Product[];
  onSelectionChange: (selectedIds: string[]) => void;
  onEdit: (product: Product) => void;
  onDelete: (docId: string) => void;
  selectedProducts?: string[];
  isAdmin?: boolean;
  onRefresh?: () => void; // 새로 추가
}

export function ProductTable({ products, onSelectionChange, onEdit, onDelete, selectedProducts, isAdmin, onRefresh }: ProductTableProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isStockFormOpen, setIsStockFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  


  const isHeadOfficeAdmin = user?.role === '본사 관리자';

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
      products.forEach(p => newSelection[p.id] = true);
    }
    setSelectedRows(newSelection);
    onSelectionChange(Object.keys(newSelection));
  };

  const isAllSelected = useMemo(() => {
    return products.length > 0 && Object.keys(selectedRows).length === products.length;
  }, [selectedRows, products]);


  const handleEdit = (product: Product) => {
    setIsDetailOpen(false);
    onEdit(product);
  };

  const handleStockUpdate = (product: any) => {
    setSelectedProduct(product);
    setIsStockFormOpen(true);
  };

  const handleRowClick = (product: any) => {
    setSelectedProduct(product);
    setIsDetailOpen(true);
  }

  const handlePrint = (product: any) => {
    setSelectedProduct(product);
    setIsPrintDialogOpen(true);
  };

  const handlePrintSubmit = ({ quantity, startPosition }: { quantity: number; startPosition: number }) => {
    if (!selectedProduct) return;
    const params = new URLSearchParams({
      ids: selectedProduct.id,
      type: 'product',
      quantity: String(quantity),
      start: String(startPosition),
    });
    router.push(`/dashboard/print-labels?${params.toString()}`);
    setIsPrintDialogOpen(false);
  };

  const handleCloseForms = () => {
    setIsStockFormOpen(false);
    setIsDetailOpen(false);
    setSelectedProduct(null);
  };

  const getStatus = (status: string, stock: number) => {
    if (status === 'out_of_stock' || stock === 0) return { text: '품절', variant: 'destructive' as const };
    if (status === 'low_stock' || stock < 10) return { text: '재고 부족', variant: 'secondary' as const };
    return { text: '판매중', variant: 'default' as const };
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
                <TableHead>상품 ID</TableHead>
                <TableHead>상품명</TableHead>
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
              {products.length > 0 ? products.map((product, idx) => {
                const statusInfo = getStatus(product.status, product.stock);
                return (
                <TableRow key={product.docId}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      id={`product-${product.id}`}
                      checked={!!selectedRows[product.id]}
                      onCheckedChange={() => handleSelectionChange(product.id)}
                      aria-label={`${product.name} 선택`}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm cursor-pointer" onClick={() => handleRowClick(product)}>{product.id}</TableCell>
                  <TableCell className="font-medium cursor-pointer" onClick={() => handleRowClick(product)}>{product.name}</TableCell>
                   <TableCell className="cursor-pointer" onClick={() => handleRowClick(product)}>
                    {product.id && (
                        <Barcode 
                        value={product.id} 
                        options={{ 
                            format: 'CODE39',
                            displayValue: true,
                            fontSize: 14,
                            height: 30,
                            width: 1.5
                        }} 
                        />
                    )}
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => handleRowClick(product)}>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.text}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell cursor-pointer" onClick={() => handleRowClick(product)}>{product.mainCategory} &gt; {product.midCategory}</TableCell>
                  <TableCell className="hidden sm:table-cell cursor-pointer" onClick={() => handleRowClick(product)}>₩{(product.price || 0).toLocaleString()}</TableCell>
                  <TableCell className="hidden md:table-cell cursor-pointer" onClick={() => handleRowClick(product)}>{product.branch}</TableCell>
                  <TableCell className="text-right cursor-pointer" onClick={() => handleRowClick(product)}>{product.stock}</TableCell>
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
                          {isHeadOfficeAdmin && <DropdownMenuItem onSelect={() => handleEdit(product)}>수정</DropdownMenuItem>}
                          <DropdownMenuItem onSelect={() => handleStockUpdate(product)}>재고 업데이트</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handlePrint(product)}>라벨 인쇄</DropdownMenuItem>
                          {isHeadOfficeAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>삭제</DropdownMenuItem>
                              </AlertDialogTrigger>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 작업은 되돌릴 수 없습니다. '{product.name}' ({product.branch}) 상품 데이터가 서버에서 영구적으로 삭제됩니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => onDelete(product.docId)}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )}) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    조회된 상품이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <StockUpdateForm 
        isOpen={isStockFormOpen} 
        onOpenChange={handleCloseForms} 
        product={selectedProduct}
        onStockUpdated={onRefresh} // 콜백 함수 전달
      />
      {selectedProduct && (
        <PrintOptionsDialog
          isOpen={isPrintDialogOpen}
          onOpenChange={setIsPrintDialogOpen}
          onSubmit={handlePrintSubmit}
          itemName={selectedProduct.name}
        />
      )}
      <ProductDetails
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        product={selectedProduct}
        onEdit={() => selectedProduct && isHeadOfficeAdmin && handleEdit(selectedProduct)}
      />
    </>
  );
}
