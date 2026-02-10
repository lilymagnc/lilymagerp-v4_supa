"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface TransferDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  transfer: any;
}

const toLocalDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  if (typeof dateVal === 'string') return new Date(dateVal);
  if (dateVal && typeof dateVal === 'object' && dateVal.seconds) return new Date(dateVal.seconds * 1000);
  return new Date(dateVal);
};

export function TransferDetailDialog({
  isOpen,
  onClose,
  transfer,
}: TransferDetailDialogProps) {
  if (!transfer) return null;

  // 상태 배지 렌더링
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />대기중</Badge>;
      case 'accepted':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />수락됨</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />거절됨</Badge>;
      case 'completed':
        return <Badge variant="outline" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" />완료됨</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>이관 상세 정보</DialogTitle>
          <DialogDescription>
            주문 이관 요청의 상세 정보를 확인합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">이관 ID</label>
                <p className="text-sm">{transfer.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">원본 주문 ID</label>
                <p className="text-sm">{transfer.originalOrderId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">발주지점</label>
                <p className="text-sm">{transfer.orderBranchName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">수주지점</label>
                <p className="text-sm">{transfer.processBranchName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">이관 요청일</label>
                <p className="text-sm">
                  {format(toLocalDate(transfer.transferDate), 'yyyy-MM-dd HH:mm:ss')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">현재 상태</label>
                <div className="mt-1">
                  {getStatusBadge(transfer.status)}
                </div>
              </div>
            </div>
          </div>

          {/* 금액 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">금액 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">원본 주문 금액</label>
                <p className="text-lg font-bold">₩{transfer.originalOrderAmount.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">금액 분배</label>
                <div className="space-y-1">
                  <p className="text-sm">발주지점: {transfer.amountSplit.orderBranch}% (₩{Math.round(transfer.originalOrderAmount * (transfer.amountSplit.orderBranch / 100)).toLocaleString()})</p>
                  <p className="text-sm">수주지점: {transfer.amountSplit.processBranch}% (₩{Math.round(transfer.originalOrderAmount * (transfer.amountSplit.processBranch / 100)).toLocaleString()})</p>
                </div>
              </div>
            </div>
          </div>

          {/* 이관 사유 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">이관 사유</h3>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{transfer.transferReason}</p>
            </div>
          </div>

          {/* 추가 메모 */}
          {transfer.notes && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">추가 메모</h3>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{transfer.notes}</p>
              </div>
            </div>
          )}

          {/* 처리 정보 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">처리 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">이관 요청자</label>
                <p className="text-sm">{transfer.transferByUser}</p>
              </div>
              {transfer.acceptedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">수락일</label>
                  <p className="text-sm">
                    {transfer.acceptedAt ? format(toLocalDate(transfer.acceptedAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                  </p>
                </div>
              )}
              {transfer.rejectedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">거절일</label>
                  <p className="text-sm">
                    {transfer.rejectedAt ? format(toLocalDate(transfer.rejectedAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                  </p>
                </div>
              )}
              {transfer.completedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">완료일</label>
                  <p className="text-sm">
                    {transfer.completedAt ? format(toLocalDate(transfer.completedAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 타임스탬프 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">시스템 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">생성일</label>
                <p className="text-sm">
                  {transfer.createdAt ? format(toLocalDate(transfer.createdAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">수정일</label>
                <p className="text-sm">
                  {transfer.updatedAt ? format(toLocalDate(transfer.updatedAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
