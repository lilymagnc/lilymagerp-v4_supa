"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog"
import { Printer, Download, X } from "lucide-react"
import { ScrollArea } from "./ui/scroll-area"
import { Badge } from "./ui/badge"
interface PrintItem {
  id: string;
  name: string;
  quantity: number;
  price?: number;
  barcode?: string;
}
interface PrintPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  items: PrintItem[];
  startPosition: number;
  itemType: "product" | "material";
}
export function PrintPreviewDialog({ isOpen, onOpenChange, items, startPosition, itemType }: PrintPreviewDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      // 실제 인쇄 로직을 여기에 구현
      // 현재는 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1000));
      // 성공 메시지
      } catch (error) {
      console.error('Print error:', error);
    } finally {
      setIsPrinting(false);
    }
  };
  const handleDownload = () => {
    // PDF 다운로드 로직을 여기에 구현
    };
  const totalLabels = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>라벨 인쇄 미리보기</DialogTitle>
          <DialogDescription>
            총 {totalLabels}개의 라벨이 인쇄됩니다. (시작 위치: {startPosition})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex justify-between items-center">
            <Badge variant="outline">
              {itemType === 'product' ? '상품' : '자재'} 라벨
            </Badge>
            <div className="text-sm text-gray-600">
              시작 위치: {startPosition}
            </div>
          </div>
          <ScrollArea className="h-96 w-full border rounded-md p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item, itemIndex) => {
                const labels = Array.from({ length: item.quantity }, (_, labelIndex) => {
                  const position = startPosition + itemIndex * item.quantity + labelIndex;
                  return (
                    <div key={`${item.id}-${labelIndex}`} className="border rounded-lg p-3 bg-white shadow-sm">
                      <div className="text-center space-y-2">
                        <div className="text-xs text-gray-500">위치: {position}</div>
                        <div className="font-medium text-sm">{item.name}</div>
                        {item.price && (
                          <div className="text-sm font-bold">₩{item.price.toLocaleString()}</div>
                        )}
                        {item.barcode && (
                          <div className="text-xs font-mono bg-gray-100 p-1 rounded">
                            {item.barcode}
                          </div>
                        )}
                        <div className="text-xs text-gray-600">
                          {itemType === 'product' ? '상품' : '자재'}
                        </div>
                      </div>
                    </div>
                  );
                });
                return labels;
              })}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              <X className="mr-2 h-4 w-4" />
              취소
            </Button>
          </DialogClose>
          <Button 
            type="button" 
            variant="outline"
            onClick={handleDownload}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF 다운로드
          </Button>
          <Button 
            type="button" 
            onClick={handlePrint}
            disabled={isPrinting}
          >
            {isPrinting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                인쇄 중...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                인쇄
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 
