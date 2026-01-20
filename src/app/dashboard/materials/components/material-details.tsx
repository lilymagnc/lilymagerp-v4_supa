
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
import { Barcode } from "@/components/barcode"
type Material = {
  id: string;
  name: string;
  mainCategory: string;
  midCategory: string;
  price: number;
  supplier: string;
  stock: number;
  size: string;
  color: string;
} | null;
interface MaterialDetailsProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onEdit: () => void
  material: Material
}
export function MaterialDetails({ isOpen, onOpenChange, onEdit, material }: MaterialDetailsProps) {
  if (!material) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{material.name}</DialogTitle>
          <DialogDescription>
            {material.mainCategory} &gt; {material.midCategory}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex flex-col items-center justify-center my-4">
            {isOpen && (
               <>
                <Barcode 
                  value={material.id} 
                  options={{ 
                    format: 'CODE39',
                    displayValue: false,
                    height: 80,
                  }} 
                />
                <p className="text-center text-sm mt-2 font-mono tracking-wider">{material.id} {material.name}</p>
              </>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">가격</p>
            <p className="col-span-2 text-sm">₩{material.price.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">현재 재고</p>
            <p className="col-span-2 text-sm">{material.stock}개</p>
          </div>
          <Separator />
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">공급업체</p>
            <p className="col-span-2 text-sm">{material.supplier}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">규격</p>
            <p className="col-span-2 text-sm">{material.size}</p>
          </div>
           <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">색상</p>
            <p className="col-span-2 text-sm">{material.color}</p>
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
