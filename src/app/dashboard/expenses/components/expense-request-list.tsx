"use client";
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2,
  RefreshCw,
  Calendar,
  User,
  Building,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { 
  ExpenseStatus, 
  ExpenseCategory,
  EXPENSE_STATUS_LABELS,
  EXPENSE_CATEGORY_LABELS 
} from '@/types/expense';
import type { 
  ExpenseRequest
} from '@/types/expense';
interface ExpenseRequestListProps {
  expenses: ExpenseRequest[];
  loading: boolean;
  onRefresh: () => void;
}
export function ExpenseRequestList({ expenses, loading, onRefresh }: ExpenseRequestListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  // 필터링된 비용 신청 목록
  const filteredExpenses = expenses.filter(expense => {
    const searchMatch = !searchTerm || 
      expense.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.branchName.toLowerCase().includes(searchTerm.toLowerCase());
    const statusMatch = statusFilter === 'all' || expense.status === statusFilter;
    const categoryMatch = categoryFilter === 'all' || 
      expense.items.some(item => item.category === categoryFilter);
    const branchMatch = branchFilter === 'all' || expense.branchName === branchFilter;
    return searchMatch && statusMatch && categoryMatch && branchMatch;
  });
  // 고유 지점 목록 추출
  const uniqueBranches = Array.from(new Set(expenses.map(e => e.branchName)));
  // 상태별 아이콘 반환
  const getStatusIcon = (status: ExpenseStatus) => {
    switch (status) {
      case 'draft': return <Edit className="h-4 w-4 text-gray-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paid': return <DollarSign className="h-4 w-4 text-blue-500" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };
  // 상태별 색상 반환
  const getStatusBadgeVariant = (status: ExpenseStatus) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'pending': return 'default';
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'paid': return 'default';
      case 'cancelled': return 'secondary';
      default: return 'secondary';
    }
  };
  // 긴급 여부 확인
  const isUrgent = (expense: ExpenseRequest) => {
    return expense.urgency === 'urgent';
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
  // 통화 포맷팅
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">로딩 중...</span>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="신청번호, 제목, 신청자, 지점으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ExpenseStatus | 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="draft">임시저장</SelectItem>
              <SelectItem value="pending">승인대기</SelectItem>
              <SelectItem value="approved">승인완료</SelectItem>
              <SelectItem value="rejected">반려</SelectItem>
              <SelectItem value="paid">지급완료</SelectItem>
              <SelectItem value="cancelled">취소</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as ExpenseCategory | 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="지점" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 지점</SelectItem>
              {uniqueBranches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* 비용 신청 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>비용 신청 목록 ({filteredExpenses.length}건)</span>
            <div className="text-sm text-muted-foreground">
              총 신청 금액: {formatCurrency(
                filteredExpenses.reduce((total, expense) => total + expense.totalAmount, 0)
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredExpenses.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">조건에 맞는 비용 신청이 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>신청번호</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead>신청자</TableHead>
                    <TableHead>지점</TableHead>
                    <TableHead>항목 수</TableHead>
                    <TableHead>신청 금액</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>신청일</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{expense.requestNumber}</span>
                          {isUrgent(expense) && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-48">
                          <p className="font-medium truncate">{expense.title}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {expense.purpose}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{expense.requesterName}</p>
                            <p className="text-xs text-muted-foreground">{expense.requesterRole}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p>{expense.branchName}</p>
                            {expense.departmentName && (
                              <p className="text-xs text-muted-foreground">{expense.departmentName}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{expense.items.length}개</span>
                          {isUrgent(expense) && (
                            <Badge variant="destructive" className="text-xs">
                              긴급
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {formatCurrency(expense.totalAmount)}
                          </p>
                          {expense.totalTaxAmount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              세액: {formatCurrency(expense.totalTaxAmount)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(expense.status)}
                          <Badge variant={getStatusBadgeVariant(expense.status)}>
                            {EXPENSE_STATUS_LABELS[expense.status]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <div>
                            <p>{formatDate(expense.createdAt)}</p>
                            {expense.submittedAt && (
                              <p className="text-xs">제출: {formatDate(expense.submittedAt)}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              상세 보기
                            </DropdownMenuItem>
                            {expense.status === 'draft' && (
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                수정
                              </DropdownMenuItem>
                            )}
                            {(expense.status === 'draft' || expense.status === 'rejected') && (
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 요약 정보 */}
      {filteredExpenses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">
                  {filteredExpenses.filter(e => e.status === 'draft').length}
                </p>
                <p className="text-sm text-muted-foreground">임시저장</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredExpenses.filter(e => e.status === 'pending').length}
                </p>
                <p className="text-sm text-muted-foreground">승인 대기</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {filteredExpenses.filter(e => e.status === 'approved').length}
                </p>
                <p className="text-sm text-muted-foreground">승인 완료</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {filteredExpenses.filter(e => isUrgent(e)).length}
                </p>
                <p className="text-sm text-muted-foreground">긴급 신청</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {filteredExpenses.filter(e => e.status === 'paid').length}
                </p>
                <p className="text-sm text-muted-foreground">지급 완료</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
