
"use client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
const mockOrders = [
    { id: "ORD-001", customer: "김민준", date: "2023-10-26", amount: 123000, status: "completed" },
    { id: "ORD-002", customer: "이서연", date: "2023-10-26", amount: 78000, status: "processing" },
    { id: "ORD-003", customer: "박지훈", date: "2023-10-25", amount: 210000, status: "completed" },
    { id: "ORD-004", customer: "최수아", date: "2023-10-25", amount: 45000, status: "canceled" },
    { id: "ORD-005", customer: "정다은", date: "2023-10-24", amount: 92000, status: "completed" },
];
export function RecentOrders() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>고객</TableHead>
          <TableHead>상태</TableHead>
          <TableHead className="text-right">금액</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockOrders.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <div className="font-medium">{order.customer}</div>
              <div className="text-sm text-muted-foreground">{order.id}</div>
            </TableCell>
            <TableCell>
              <Badge variant={order.status === 'completed' ? 'default' : order.status === 'processing' ? 'secondary' : 'destructive'}>
                  {order.status === 'completed' ? '완료' : order.status === 'processing' ? '처리중' : '취소'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">₩{order.amount.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
