"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { TransferStatusUpdate } from "@/types/order-transfer";

interface TransferStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: any;
  onStatusUpdate: (transferId: string, statusUpdate: TransferStatusUpdate) => Promise<void>;
}

export function TransferStatusDialog({
  isOpen,
  onClose,
  transfer,
  onStatusUpdate,
}: TransferStatusDialogProps) {
  const [status, setStatus] = useState<'accepted' | 'rejected' | 'completed'>('accepted');
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transfer) return;

    try {
      setIsSubmitting(true);
      await onStatusUpdate(transfer.id, {
        status,
        notes: notes.trim() || undefined
      });
      
      toast({
        title: "상태 업데이트 완료",
        description: "이관 상태가 성공적으로 변경되었습니다.",
      });
      
      onClose();
    } catch (error) {
      console.error("상태 업데이트 오류:", error);
      toast({
        variant: "destructive",
        title: "상태 업데이트 실패",
        description: "상태 업데이트 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setStatus('accepted');
      setNotes("");
      onClose();
    }
  };

  if (!transfer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>이관 상태 변경</DialogTitle>
          <DialogDescription>
            이관 요청의 상태를 변경합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 이관 정보 표시 */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">이관 정보</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">이관 ID:</span> {transfer.id.slice(0, 8)}...
              </div>
              <div>
                <span className="text-muted-foreground">원본 주문:</span> {transfer.originalOrderId.slice(0, 8)}...
              </div>
              <div>
                <span className="text-muted-foreground">발주지점:</span> {transfer.orderBranchName}
              </div>
              <div>
                <span className="text-muted-foreground">수주지점:</span> {transfer.processBranchName}
              </div>
              <div>
                <span className="text-muted-foreground">이관 금액:</span> ₩{transfer.originalOrderAmount.toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">현재 상태:</span> {transfer.status}
              </div>
            </div>
          </div>

          {/* 상태 선택 */}
          <div className="space-y-2">
            <Label htmlFor="status">새로운 상태 *</Label>
            <Select value={status} onValueChange={(value: 'accepted' | 'rejected' | 'completed') => setStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="상태를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted">수락</SelectItem>
                <SelectItem value="rejected">거절</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 메모 */}
          <div className="space-y-2">
            <Label htmlFor="notes">메모</Label>
            <Textarea
              id="notes"
              placeholder="상태 변경 사유나 추가 메모를 입력하세요 (선택사항)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "처리 중..." : "상태 변경"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
