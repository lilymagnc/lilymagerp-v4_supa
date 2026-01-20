
"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Employee } from "@/hooks/use-employees";
import { format } from "date-fns";
interface EmployeeDetailsProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onEdit: () => void;
  employee: Employee | null;
}
export function EmployeeDetails({ isOpen, onOpenChange, onEdit, employee }: EmployeeDetailsProps) {
  if (!employee) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee.name}</DialogTitle>
          <DialogDescription>
            {employee.position} | {employee.department}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">이메일</p>
            <p className="col-span-2 text-sm">{employee.email}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">연락처</p>
            <p className="col-span-2 text-sm">{employee.contact}</p>
          </div>
          <Separator />
           <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">생년월일</p>
            <p className="col-span-2 text-sm">{employee.birthDate ? format(new Date(employee.birthDate), "yyyy년 MM월 dd일") : '-'}</p>
          </div>
           <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">입사일</p>
            <p className="col-span-2 text-sm">{employee.hireDate ? format(new Date(employee.hireDate), "yyyy년 MM월 dd일") : '-'}</p>
          </div>
           <Separator />
           <div className="grid grid-cols-3 items-start gap-4">
            <p className="text-sm text-muted-foreground pt-1">주소</p>
            <p className="col-span-2 text-sm whitespace-pre-wrap">{employee.address || "-"}</p>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
                <Button type="button" variant="secondary">닫기</Button>
            </DialogClose>
            <Button onClick={onEdit}>정보 수정</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
