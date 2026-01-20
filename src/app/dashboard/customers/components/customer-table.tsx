
"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, FileText, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Customer } from "@/hooks/use-customers";
interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onDelete: (id: string) => void;
  onRowClick: (customer: Customer) => void;
  onStatementPrint: (customer: Customer) => void;
}
export function CustomerTable({ customers, onEdit, onDelete, onRowClick, onStatementPrint }: CustomerTableProps) {
    const getGradeBadge = (grade?: string) => {
        switch (grade) {
            case 'VIP':
            case 'VVIP':
                return <Badge variant="default" className="bg-yellow-500 text-white">{grade}</Badge>;
            case '일반':
                return <Badge variant="secondary">{grade}</Badge>;
            case '신규':
            default:
                return <Badge variant="outline">{grade || '신규'}</Badge>;
        }
    }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">고객명/회사명</TableHead>
              <TableHead className="w-[80px]">유형</TableHead>
              <TableHead className="w-[200px]">연락처</TableHead>
              <TableHead className="hidden md:table-cell">등급</TableHead>
              <TableHead className="hidden md:table-cell">태그</TableHead>
              <TableHead className="hidden lg:table-cell">담당지점</TableHead>
              <TableHead className="hidden xl:table-cell">월결제일</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length > 0 ? (
              customers.map((customer) => (
                <TableRow key={customer.id} onClick={() => onRowClick(customer)} className="cursor-pointer">
                  <TableCell>
                    <div className="font-medium flex items-center gap-2">
                      {customer.name}
                                             {customer.type === 'company' && customer.specialNotes && customer.specialNotes.trim() && (
                         <div title="특이사항 있음">
                           <AlertTriangle className="h-4 w-4 text-orange-500" />
                         </div>
                       )}
                    </div>
                    {customer.type === 'company' && <div className="text-xs text-muted-foreground">{customer.companyName}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.type === 'company' ? 'secondary' : 'outline'}>
                      {customer.type === 'company' ? '기업' : '개인'}
                    </Badge>
                  </TableCell>
                  <TableCell>{customer.contact}</TableCell>
                  <TableCell className="hidden md:table-cell">{getGradeBadge(customer.grade)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {customer.tags?.split(',').map(tag => tag.trim() && <Badge key={tag} variant="outline" className="font-normal">{tag.trim()}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">
                        {(customer.primaryBranch && customer.primaryBranch !== "all" ? customer.primaryBranch : "") || 
                         (customer.branch && customer.branch !== "all" ? customer.branch : "") || 
                         '-'}
                      </span>
                      {customer.branches && Object.keys(customer.branches).filter(branch => branch !== "all" && branch !== "").length > 1 && (
                        <span className="text-xs text-muted-foreground">
                          {Object.keys(customer.branches).filter(branch => branch !== "all" && branch !== "").length}개 지점
                        </span>
                      )}
                    </div>
                  </TableCell>
                                     <TableCell className="hidden xl:table-cell">
                     <span className="text-sm">
                       {customer.type === 'company' && customer.monthlyPaymentDay ? `${customer.monthlyPaymentDay}일` : '-'}
                     </span>
                   </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => onEdit(customer)}>수정</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onStatementPrint(customer)}>
                            <FileText className="mr-2 h-4 w-4" />
                            거래명세서 출력
                          </DropdownMenuItem>
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
                           이 작업은 되돌릴 수 없습니다. '{customer.name}' 고객 데이터가 서버에서 영구적으로 삭제됩니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => onDelete(customer.id)}
                          >
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  조회된 고객이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
