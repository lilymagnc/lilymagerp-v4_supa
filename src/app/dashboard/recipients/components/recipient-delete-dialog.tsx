"use client";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Recipient } from "@/hooks/use-recipients";
import { AlertTriangle, Trash2 } from "lucide-react";

interface RecipientDeleteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: Recipient | null;
  onDelete: (recipientId: string) => Promise<void>;
}

export function RecipientDeleteDialog({ isOpen, onOpenChange, recipient, onDelete }: RecipientDeleteDialogProps) {
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!recipient) return;

    try {
      await onDelete(recipient.id);
      toast({
        title: "삭제 완료",
        description: "수령자 정보가 성공적으로 삭제되었습니다."
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting recipient:', error);
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: "수령자 정보 삭제 중 오류가 발생했습니다."
      });
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!recipient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            수령자 삭제 확인
          </DialogTitle>
          <DialogDescription>
            정말로 이 수령자 정보를 삭제하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 삭제할 수령자 정보 */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">수령자명:</span>
              <span>{recipient.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">연락처:</span>
              <span>{recipient.contact}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">주소:</span>
              <span className="text-sm">{recipient.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">수령 횟수:</span>
              <span>{recipient.orderCount}회</span>
            </div>
          </div>

          {/* 경고 메시지 */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm text-destructive">
                <p className="font-medium">주의사항:</p>
                <ul className="mt-1 space-y-1">
                  <li>• 이 작업은 되돌릴 수 없습니다.</li>
                  <li>• 관련된 주문 내역은 유지됩니다.</li>
                  <li>• 수령자 통계에서 제외됩니다.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              취소
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              onClick={handleDelete}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
