
"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Employee } from "@/hooks/use-employees";
import { EmployeeDetails } from "./employee-details";
import { format } from "date-fns";
import { POSITIONS } from "@/lib/constants";
interface EmployeeTableProps {
  employees: Employee[];
  onEdit: (employee: Employee) => void;
  onDelete: (id: string) => void;
}
export function EmployeeTable({ employees, onEdit, onDelete }: EmployeeTableProps) {
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const handleRowClick = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailOpen(true);
  };
  const handleEditClick = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    onEdit(employee);
  }
  const getPositionBadge = (position: string) => {
    let variant: "default" | "secondary" | "outline" | "destructive" = "outline";
    switch (position) {
      case POSITIONS.CEO:
        variant = "default";
        break;
      case POSITIONS.DIRECTOR:
        variant = "secondary";
        break;
      case POSITIONS.MANAGER:
        variant = "outline";
        break;
      case POSITIONS.SUPERVISOR:
        variant = "outline";
        break;
      case POSITIONS.STAFF:
        variant = "outline";
        break;
      default:
        variant = "outline";
    }
    return <Badge variant={variant}>{position}</Badge>;
  };
  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>직위</TableHead>
                <TableHead className="hidden md:table-cell">소속</TableHead>
                <TableHead className="hidden md:table-cell">이메일</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead className="hidden lg:table-cell">입사일</TableHead>
                <TableHead>
                  <span className="sr-only">작업</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id} onClick={() => handleRowClick(employee)} className="cursor-pointer">
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>
                    {getPositionBadge(employee.position)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{employee.department}</TableCell>
                  <TableCell className="hidden md:table-cell">{employee.email}</TableCell>
                  <TableCell>{employee.contact}</TableCell>
                  <TableCell className="hidden lg:table-cell">{employee.hireDate ? format(new Date(employee.hireDate), "yyyy-MM-dd") : '-'}</TableCell>
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
                          <DropdownMenuItem onClick={(e) => handleEditClick(e, employee)}>수정</DropdownMenuItem>
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>삭제</DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                       <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
                          <AlertDialogDescription>
                            이 작업은 되돌릴 수 없습니다. '{employee.name}' 직원 정보가 영구적으로 삭제됩니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>취소</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => onDelete(employee.id)}>
                            삭제
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <EmployeeDetails 
        isOpen={isDetailOpen} 
        onOpenChange={setIsDetailOpen} 
        employee={selectedEmployee} 
        onEdit={() => {
          if (selectedEmployee) {
            setIsDetailOpen(false);
            onEdit(selectedEmployee);
          }
        }}
      />
    </>
  );
}
