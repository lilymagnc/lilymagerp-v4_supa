
"use client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Branch } from "@/hooks/use-branches"
interface BranchDetailsProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onEdit: () => void
  branch: Branch | null
}
export function BranchDetails({ isOpen, onOpenChange, onEdit, branch }: BranchDetailsProps) {
  if (!branch) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{branch.name}</DialogTitle>
          <DialogDescription>
            {branch.type} | {branch.address}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">점장(책임자)</p>
            <p className="col-span-2 text-sm">{branch.manager || "-"}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">직원 수</p>
            <p className="col-span-2 text-sm">{(branch.employeeCount ?? 0) > 0 ? `${branch.employeeCount}명` : "-"}</p>
          </div>
          <Separator />
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">연락처</p>
            <p className="col-span-2 text-sm">{branch.phone}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">사업자 등록번호</p>
            <p className="col-span-2 text-sm">{branch.businessNumber || "-"}</p>
          </div>
           <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">계좌 정보</p>
            <p className="col-span-2 text-sm">{branch.account || "-"}</p>
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
  )
}
