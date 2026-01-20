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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, X } from "lucide-react";
import { useOrderTransfers } from "@/hooks/use-order-transfers";
import { OrderTransfer } from "@/types/order-transfer";

interface TransferCancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: OrderTransfer | null;
}

export function TransferCancelDialog({
  isOpen,
  onClose,
  transfer,
}: TransferCancelDialogProps) {
  const [cancelReason, setCancelReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { cancelTransfer } = useOrderTransfers();

  const handleCancel = async () => {
    if (!transfer) return;

    try {
      setIsLoading(true);
      await cancelTransfer(transfer.id, cancelReason);
      onClose();
      setCancelReason("");
    } catch (error) {
      console.error("이관 취소 오류:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCancelReason("");
    onClose();
  };

  if (!transfer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            이관 취소
          </DialogTitle>
          <DialogDescription>
            이 이관 요청을 취소하시겠습니까? 취소 후에는 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 이관 정보 표시 */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">발주지점:</span>
              <span>{transfer.orderBranchName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">수주지점:</span>
              <span>{transfer.processBranchName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">주문 금액:</span>
              <span>{transfer.originalOrderAmount.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium">이관 사유:</span>
              <span className="text-gray-600">{transfer.transferReason}</span>
            </div>
          </div>

          {/* 취소 사유 입력 */}
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">취소 사유 (선택사항)</Label>
            <Textarea
              id="cancel-reason"
              placeholder="취소 사유를 입력하세요..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* 경고 메시지 */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-medium">주의사항:</p>
                <ul className="mt-1 space-y-1">
                  <li>• 이관 취소 후에는 되돌릴 수 없습니다</li>
                  <li>• 원본 주문의 이관 정보가 제거됩니다</li>
                  <li>• 수주지점에 취소 알림이 전송됩니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {isLoading ? "취소 중..." : "이관 취소"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
