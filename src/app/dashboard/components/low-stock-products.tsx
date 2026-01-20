
"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
const lowStockProducts = [
  { id: "PROD-005", name: "베이직 블랙 슬랙스", stock: 5, status: "low_stock" },
  { id: "PROD-003", name: "오렌지 포인트 스커트", stock: 0, status: "out_of_stock" },
];
export function LowStockProducts() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>상품명</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">재고</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lowStockProducts.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell>
              <Badge variant={product.status === 'out_of_stock' ? 'destructive' : 'secondary'}>
                {product.status === 'out_of_stock' ? '품절' : '재고 부족'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{product.stock}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
