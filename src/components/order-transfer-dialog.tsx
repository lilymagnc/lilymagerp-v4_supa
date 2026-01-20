"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBranches } from "@/hooks/use-branches";
import { useOrderTransfers } from "@/hooks/use-order-transfers";
import { useToast } from "@/hooks/use-toast";
import { Order } from "@/hooks/use-orders";
import { OrderTransferForm } from "@/types/order-transfer";

interface OrderTransferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function OrderTransferDialog({
  isOpen,
  onClose,
  order,
}: OrderTransferDialogProps) {
  const [formData, setFormData] = useState<OrderTransferForm>({
    processBranchId: "",
    transferReason: "",
    amountSplit: {
      orderBranch: 100, // 발주지점 100%
      processBranch: 0, // 수주지점 0%
    },
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { branches } = useBranches();
  const { createTransfer, calculateAmountSplit } = useOrderTransfers();
  const { toast } = useToast();

  // 이관할 수 있는 지점 목록 (현재 주문의 지점 제외)
  const availableBranches = branches.filter(
    (branch) => branch.id !== order?.branchId
  );

  // 주문 유형에 따른 기본 금액 분배 계산
  useEffect(() => {
    if (order) {
      const amountSplit = calculateAmountSplit(
        order.summary.total,
        order.orderType
      );
      setFormData(prev => ({
        ...prev,
        amountSplit
      }));
    }
  }, [order, calculateAmountSplit]);

  // 다이얼로그가 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen && order) {
      setFormData({
        processBranchId: "",
        transferReason: "",
        amountSplit: {
          orderBranch: 100,
          processBranch: 0,
        },
        notes: "",
      });
    }
  }, [isOpen, order]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!order || !formData.processBranchId || !formData.transferReason) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "필수 항목을 모두 입력해주세요.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await createTransfer(order.id, formData);
      
      toast({
        title: "이관 요청 완료",
        description: "지점 이관 요청이 성공적으로 전송되었습니다.",
      });
      
      onClose();
    } catch (error) {
      console.error("이관 요청 오류:", error);
      toast({
        variant: "destructive",
        title: "이관 요청 실패",
        description: "이관 요청 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>주문 이관 요청</DialogTitle>
          <DialogDescription>
            주문을 다른 지점으로 이관합니다. 이관 사유와 금액 분배를 설정해주세요.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 주문 정보 표시 */}
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">주문 정보</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">주문자:</span> {order.orderer.name}
              </div>
              <div>
                <span className="text-muted-foreground">주문 금액:</span> ₩{order.summary.total.toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">현재 지점:</span> {order.branchName}
              </div>
              <div>
                <span className="text-muted-foreground">주문 유형:</span> {order.orderType}
              </div>
            </div>
          </div>

          {/* 이관할 지점 선택 */}
          <div className="space-y-2">
            <Label htmlFor="processBranch">이관할 지점 *</Label>
            <Select
              value={formData.processBranchId}
              onValueChange={(value) =>
                setFormData(prev => ({ ...prev, processBranchId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="이관할 지점을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 이관 사유 */}
          <div className="space-y-2">
            <Label htmlFor="transferReason">이관 사유 *</Label>
            <Textarea
              id="transferReason"
              placeholder="이관 사유를 입력하세요 (예: 재고 부족, 배송 거리 등)"
              value={formData.transferReason}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, transferReason: e.target.value }))
              }
              rows={3}
            />
          </div>

          {/* 금액 분배 설정 */}
          <div className="space-y-2">
            <Label>금액 분배 설정</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orderBranchPercent" className="text-sm">
                  발주지점 ({order.branchName})
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="orderBranchPercent"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.amountSplit.orderBranch}
                    onChange={(e) => {
                      const orderBranch = parseInt(e.target.value) || 0;
                      const processBranch = 100 - orderBranch;
                      setFormData(prev => ({
                        ...prev,
                        amountSplit: {
                          orderBranch,
                          processBranch: Math.max(0, processBranch)
                        }
                      }));
                    }}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <span className="text-sm text-muted-foreground">
                    (₩{Math.round(order.summary.total * (formData.amountSplit.orderBranch / 100)).toLocaleString()})
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="processBranchPercent" className="text-sm">
                  수주지점
                </Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="processBranchPercent"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.amountSplit.processBranch}
                    onChange={(e) => {
                      const processBranch = parseInt(e.target.value) || 0;
                      const orderBranch = 100 - processBranch;
                      setFormData(prev => ({
                        ...prev,
                        amountSplit: {
                          orderBranch: Math.max(0, orderBranch),
                          processBranch
                        }
                      }));
                    }}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                  <span className="text-sm text-muted-foreground">
                    (₩{Math.round(order.summary.total * (formData.amountSplit.processBranch / 100)).toLocaleString()})
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              총 100%가 되어야 합니다. 현재: {formData.amountSplit.orderBranch + formData.amountSplit.processBranch}%
            </p>
          </div>

          {/* 추가 메모 */}
          <div className="space-y-2">
            <Label htmlFor="notes">추가 메모</Label>
            <Textarea
              id="notes"
              placeholder="추가 메모를 입력하세요 (선택사항)"
              value={formData.notes}
              onChange={(e) =>
                setFormData(prev => ({ ...prev, notes: e.target.value }))
              }
              rows={2}
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
              disabled={
                isSubmitting ||
                !formData.processBranchId ||
                !formData.transferReason ||
                formData.amountSplit.orderBranch + formData.amountSplit.processBranch !== 100
              }
            >
              {isSubmitting ? "처리 중..." : "이관 요청"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
