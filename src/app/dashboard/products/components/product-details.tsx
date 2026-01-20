
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
import { useAuth } from "@/hooks/use-auth"

type Product = {
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
interface ProductDetailsProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onEdit: () => void
  product: Product
}
export function ProductDetails({ isOpen, onOpenChange, onEdit, product }: ProductDetailsProps) {
  const { user } = useAuth();
  const isHeadOfficeAdmin = user?.role === '본사 관리자';
  if (!product) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            {product.mainCategory} &gt; {product.midCategory}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex flex-col items-center justify-center my-4">
            {isOpen && (
              <>
                <Barcode 
                  value={product.id} 
                  options={{ 
                    format: 'CODE39',
                    displayValue: false,
                    height: 80,
                  }} 
                />
                <p className="text-center text-sm mt-2 font-mono tracking-wider">{product.id} {product.name}</p>
              </>
            )}
          </div>
          <Separator />
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">가격</p>
            <p className="col-span-2 text-sm">₩{product.price.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">현재 재고</p>
            <p className="col-span-2 text-sm">{product.stock}개</p>
          </div>
          <Separator />
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">공급업체</p>
            <p className="col-span-2 text-sm">{product.supplier}</p>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">규격</p>
            <p className="col-span-2 text-sm">{product.size}</p>
          </div>
           <div className="grid grid-cols-3 items-center gap-4">
            <p className="text-sm text-muted-foreground">색상</p>
            <p className="col-span-2 text-sm">{product.color}</p>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
                <Button type="button" variant="secondary">닫기</Button>
            </DialogClose>
            {isHeadOfficeAdmin && <Button onClick={onEdit}>정보 수정</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
