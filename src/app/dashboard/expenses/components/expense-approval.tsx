"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Clock,
  AlertTriangle,
  User,
  Building,
  DollarSign,
  Calendar,
  FileText,
  MessageSquare
} from 'lucide-react';
import { useExpenses } from '@/hooks/use-expenses';
import { useToast } from '@/hooks/use-toast';
import { 
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS 
} from '@/types/expense';
import type { 
  ExpenseRequest
} from '@/types/expense';
export function ExpenseApproval() {
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRequest | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const { expenses, loading, processApproval } = useExpenses();
  const { toast } = useToast();
  // 승인 대기 중인 비용 신청만 필터링
  const pendingExpenses = expenses.filter(expense => expense.status === 'pending');
  // 승인 처리
  const handleApproval = async (expense: ExpenseRequest, action: 'approve' | 'reject') => {
    setIsProcessing(true);
    try {
      await processApproval({
        requestId: expense.id,
        approverId: 'current-user-id', // 실제로는 현재 사용자 ID
        approverName: '현재 사용자', // 실제로는 현재 사용자 이름
        approverRole: '팀장', // 실제로는 현재 사용자 역할
        action,
        comment: approvalComment
      });
      setApprovalComment('');
      setSelectedExpense(null);
      toast({
        title: `${action === 'approve' ? '승인' : '반려'} 완료`,
        description: `비용 신청이 ${action === 'approve' ? '승인' : '반려'}되었습니다.`
      });
    } catch (error) {
      console.error('Approval processing error:', error);
      toast({
        variant: 'destructive',
        title: '처리 실패',
        description: '승인 처리 중 오류가 발생했습니다.'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  // 상세 정보 보기
  const showExpenseDetail = (expense: ExpenseRequest) => {
    setSelectedExpense(expense);
    setShowDetailDialog(true);
  };
  // 통화 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  // 날짜 포맷팅
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">로딩 중...</span>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">승인 대기 목록</h3>
          <p className="text-sm text-muted-foreground">
            {pendingExpenses.length}건의 비용 신청이 승인을 기다리고 있습니다
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          총 대기 금액: {formatCurrency(
            pendingExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0)
          )}
        </Badge>
      </div>
      {/* 승인 대기 목록 */}
      {pendingExpenses.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">승인 대기 건이 없습니다</h3>
              <p className="text-muted-foreground">
                모든 비용 신청이 처리되었습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingExpenses.map((expense) => (
            <Card key={expense.id} className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{expense.title}</CardTitle>
                      {expense.urgency === 'urgent' && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          긴급
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{expense.purpose}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(expense.totalAmount)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {expense.requestNumber}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{expense.requesterName}</p>
                      <p className="text-sm text-muted-foreground">{expense.requesterRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{expense.branchName}</p>
                      {expense.departmentName && (
                        <p className="text-sm text-muted-foreground">{expense.departmentName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">신청일</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(expense.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                {/* 비용 항목 요약 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    비용 항목 ({expense.items.length}개)
                  </h4>
                  <div className="space-y-2">
                    {expense.items.slice(0, 3).map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {EXPENSE_CATEGORY_LABELS[item.category]}
                          </Badge>
                          <span>{item.description}</span>
                        </div>
                        <span className="font-medium">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                    {expense.items.length > 3 && (
                      <p className="text-sm text-muted-foreground">
                        외 {expense.items.length - 3}개 항목...
                      </p>
                    )}
                  </div>
                </div>
                {/* 승인 필요 금액 알림 */}
                {expense.totalAmount >= 500000 && (
                  <Alert className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      50만원 이상의 고액 비용 신청입니다. 신중한 검토가 필요합니다.
                    </AlertDescription>
                  </Alert>
                )}
                {/* 액션 버튼 */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => showExpenseDetail(expense)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    상세 보기
                  </Button>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          반려
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>비용 신청 반려</DialogTitle>
                          <DialogDescription>
                            {expense.title} 신청을 반려하시겠습니까?
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">반려 사유</label>
                            <Textarea
                              placeholder="반려 사유를 입력해주세요..."
                              value={approvalComment}
                              onChange={(e) => setApprovalComment(e.target.value)}
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setApprovalComment('');
                              setSelectedExpense(null);
                            }}
                          >
                            취소
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleApproval(expense, 'reject')}
                            disabled={isProcessing}
                          >
                            {isProcessing ? '처리 중...' : '반려'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => setSelectedExpense(expense)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          승인
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>비용 신청 승인</DialogTitle>
                          <DialogDescription>
                            {expense.title} 신청을 승인하시겠습니까?
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span>승인 금액:</span>
                              <span className="text-xl font-bold text-blue-600">
                                {formatCurrency(expense.totalAmount)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm font-medium">승인 의견 (선택사항)</label>
                            <Textarea
                              placeholder="승인 의견을 입력해주세요..."
                              value={approvalComment}
                              onChange={(e) => setApprovalComment(e.target.value)}
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setApprovalComment('');
                              setSelectedExpense(null);
                            }}
                          >
                            취소
                          </Button>
                          <Button
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApproval(expense, 'approve')}
                            disabled={isProcessing}
                          >
                            {isProcessing ? '처리 중...' : '승인'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* 상세 정보 다이얼로그 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>비용 신청 상세 정보</DialogTitle>
            <DialogDescription>
              {selectedExpense?.requestNumber} - {selectedExpense?.title}
            </DialogDescription>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">신청자 정보</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">이름:</span> {selectedExpense.requesterName}</p>
                    <p><span className="text-muted-foreground">역할:</span> {selectedExpense.requesterRole}</p>
                    <p><span className="text-muted-foreground">지점:</span> {selectedExpense.branchName}</p>
                    {selectedExpense.departmentName && (
                      <p><span className="text-muted-foreground">부서:</span> {selectedExpense.departmentName}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">신청 정보</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">신청일:</span> {formatDate(selectedExpense.createdAt)}</p>
                    <p><span className="text-muted-foreground">긴급도:</span> 
                      <Badge variant={selectedExpense.urgency === 'urgent' ? 'destructive' : 'secondary'} className="ml-2">
                        {selectedExpense.urgency === 'urgent' ? '긴급' : '일반'}
                      </Badge>
                    </p>
                    <p><span className="text-muted-foreground">상태:</span> 
                      <Badge className="ml-2">
                        {EXPENSE_STATUS_LABELS[selectedExpense.status]}
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>
              {/* 사용 목적 */}
              <div>
                <h4 className="font-medium mb-2">사용 목적</h4>
                <p className="text-sm bg-gray-50 p-3 rounded-lg">
                  {selectedExpense.purpose}
                </p>
              </div>
              {/* 비용 항목 상세 */}
              <div>
                <h4 className="font-medium mb-2">비용 항목 상세</h4>
                <div className="space-y-3">
                  {selectedExpense.items.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Badge variant="outline" className="mb-2">
                            {EXPENSE_CATEGORY_LABELS[item.category]}
                          </Badge>
                          <h5 className="font-medium">{item.description}</h5>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-600">
                            {formatCurrency(item.amount)}
                          </p>
                          {item.taxAmount && item.taxAmount > 0 && (
                            <p className="text-sm text-muted-foreground">
                              세액: {formatCurrency(item.taxAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">수량:</span> {item.quantity}
                        </div>
                        <div>
                          <span className="text-muted-foreground">단가:</span> {formatCurrency(item.unitPrice)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">구매일:</span> {formatDate(item.purchaseDate)}
                        </div>
                      </div>
                      {item.supplier && (
                        <p className="text-sm mt-2">
                          <span className="text-muted-foreground">공급업체:</span> {item.supplier}
                        </p>
                      )}
                      {item.memo && (
                        <p className="text-sm mt-2 bg-gray-50 p-2 rounded">
                          <span className="text-muted-foreground">메모:</span> {item.memo}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* 총액 요약 */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">총 {selectedExpense.items.length}개 항목</p>
                    <p className="text-sm text-muted-foreground">
                      세액: {formatCurrency(selectedExpense.totalTaxAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">최종 금액</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(selectedExpense.totalAmount + selectedExpense.totalTaxAmount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
