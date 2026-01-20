
"use client"
import { useEffect, useState } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog"
import { Printer, Loader2 } from "lucide-react"
import { ScrollArea } from "./ui/scroll-area"
import { getItemData } from "@/lib/data-fetch"
import { Label } from "./ui/label"
import { Skeleton } from "./ui/skeleton"
import { cn } from "@/lib/utils"
interface ItemWithQuantity {
  id: string;
  name: string;
  quantity: number;
}
interface MultiPrintOptionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (items: { id: string; quantity: number; }[], startPosition: number) => void;
  itemIds: string[];
  itemType: "product" | "material";
}
export function MultiPrintOptionsDialog({ isOpen, onOpenChange, onSubmit, itemIds, itemType }: MultiPrintOptionsDialogProps) {
  const [items, setItems] = useState<ItemWithQuantity[]>([]);
  const [startPosition, setStartPosition] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (isOpen) {
      const fetchItems = async () => {
        setLoading(true);
        const fetched = await Promise.all(
          itemIds.map(async (id) => {
            const itemData = await getItemData(id, itemType);
            return { id, name: itemData?.name || 'Unknown', quantity: 1 };
          })
        );
        setItems(fetched);
        setLoading(false);
      };
      fetchItems();
    }
  }, [isOpen, itemIds, itemType]);
  const handleQuantityChange = (id: string, quantity: number) => {
    const newQuantity = Math.max(1, quantity);
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
  };
  const handleFormSubmit = () => {
    const itemsToSubmit = items.map(({id, quantity}) => ({id, quantity}));
    onSubmit(itemsToSubmit, startPosition);
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>다중 라벨 인쇄 옵션</DialogTitle>
          <DialogDescription>선택한 항목들의 인쇄 수량과 시작 위치를 지정하세요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <Label>인쇄할 항목 및 수량</Label>
            <ScrollArea className="h-40 w-full rounded-md border p-2">
                {loading ? (
                     <div className="space-y-4 p-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <Skeleton className="h-5 w-48" />
                                <Skeleton className="h-8 w-20" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between py-2">
                              <span className="text-sm">{item.name}</span>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                                className="w-20"
                              />
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
             <div>
                <Label htmlFor="start-position">시작 위치 (1-24)</Label>
                 <Input 
                    id="start-position"
                    type="number" 
                    className="w-24 mt-1"
                    value={startPosition}
                    onChange={(e) => setStartPosition(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                    min="1"
                    max="24"
                />
                 <div className="grid grid-cols-3 gap-1 mt-2 border p-2 rounded-md">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const position = i + 1;
                      return (
                        <Button
                          key={position}
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn("h-8", startPosition === position && "bg-primary text-primary-foreground")}
                          onClick={() => setStartPosition(position)}
                        >
                          {position}
                        </Button>
                      )
                    })}
                  </div>
            </div>
        </div>
        <DialogFooter className="pt-4">
            <DialogClose asChild>
                <Button type="button" variant="secondary">취소</Button>
            </DialogClose>
            <Button type="button" onClick={handleFormSubmit}>
              <Printer className="mr-2 h-4 w-4" /> 미리보기
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
