
"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowRight, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
export type StockHistory = {
  id: string;
  date: string;
  type: "in" | "out" | "manual_update";
  itemType: "product" | "material";
  itemName: string;
  quantity: number;
  fromStock?: number;
  toStock?: number;
  resultingStock: number;
  branch: string;
  operator: string;
  supplier?: string;
  price?: number;
  totalAmount?: number;
};
interface HistoryTableProps {
  history: StockHistory[];
  onDelete?: (id: string) => void;
}
export function HistoryTable({ history, onDelete }: HistoryTableProps) {
    const { user } = useAuth();
    const isAdmin = user?.role === '본사 관리자';
    const getTypeBadge = (type: StockHistory['type']) => {
        switch (type) {
            case 'in': return <Badge variant="secondary">입고</Badge>;
            case 'out': return <Badge variant="destructive">출고</Badge>;
            case 'manual_update': return <Badge variant="outline">수동 수정</Badge>;
            default: return <Badge>{type}</Badge>;
        }
    }
    const renderQuantity = (item: StockHistory) => {
        if (item.type === 'manual_update') {
            return (
                <div className="flex items-center gap-1 font-mono">
                    <span>{item.fromStock}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{item.toStock}</span>
                </div>
            );
        }
        return (
            <span className={`font-semibold ${item.type === 'in' ? 'text-blue-600' : 'text-red-600'}`}>
                {item.type === 'in' ? '+' : '-'}{item.quantity}
            </span>
        );
    }
  return (
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>날짜</TableHead>
              <TableHead>지점</TableHead>
              <TableHead>상품/자재명</TableHead>
              <TableHead>공급업체</TableHead>
              <TableHead>유형</TableHead>
              <TableHead className="text-right">수량</TableHead>
              <TableHead className="text-right">단가</TableHead>
              <TableHead className="text-right">총액</TableHead>
              <TableHead className="text-right">재고</TableHead>
              <TableHead>처리자</TableHead>
              {isAdmin && onDelete && <TableHead className="text-center">작업</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length > 0 ? (
              history.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.date), "yyyy-MM-dd HH:mm")}</TableCell>
                  <TableCell>{item.branch}</TableCell>
                  <TableCell className="font-medium">{item.itemName}</TableCell>
                  <TableCell>{item.supplier || "-"}</TableCell>
                  <TableCell>
                    {getTypeBadge(item.type)}
                  </TableCell>
                  <TableCell className="text-right">
                    {renderQuantity(item)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.price ? `₩${item.price.toLocaleString()}` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.totalAmount ? `₩${item.totalAmount.toLocaleString()}`: "-"}
                  </TableCell>
                  <TableCell className="text-right">{item.resultingStock}</TableCell>
                  <TableCell>{item.operator}</TableCell>
                  {isAdmin && onDelete && (
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('이 재고 변동 기록을 삭제하시겠습니까?')) {
                            onDelete(item.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isAdmin && onDelete ? 11 : 10} className="h-24 text-center">
                  조회된 기록이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
