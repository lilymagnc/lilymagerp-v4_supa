"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Download,
  Search,
  Filter,
  Eye,
  Trash2,
  Building,
  Calendar,
  DollarSign,
  Receipt,
  X,
  CheckSquare,
  Square,
  Edit,
  ChevronDown
} from 'lucide-react';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import { useBranches } from '@/hooks/use-branches';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where, orderBy, getDocs, limit as firestoreLimit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import {
  SIMPLE_EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  getCategoryColor
} from '@/types/simple-expense';
import { exportToExcel } from '@/lib/excel-export';
import { ExpenseDetailDialog } from './expense-detail-dialog';
import { startOfDay, endOfDay } from 'date-fns';

interface ExpenseListProps {
  refreshTrigger?: number;
  selectedBranchId?: string;
  isHeadquarters?: boolean;
}

export function ExpenseList({
  refreshTrigger = 0,
  selectedBranchId,
  isHeadquarters = false
}: ExpenseListProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);
  const today = format(new Date(), 'yyyy-MM-dd');
  const startOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // 기본값을 이번 달 1일 ~ 오늘로 설정
  const [dateRange, setDateRange] = useState({ start: startOfMonth, end: today });
  const [displayLimit, setDisplayLimit] = useState(50); // 이건 이제 한 번 로딩 단위와 맞추거나 제거 가능
  const [hasMore, setHasMore] = useState(true);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null); // 페이지네이션 커서
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const { fetchExpenses, deleteExpense } = useSimpleExpenses();
  const { branches } = useBranches();
  const { user } = useAuth();
  const { toast } = useToast();

  // 본사 관리자 여부 확인
  const isHeadquartersAdmin = user?.role === '본사 관리자';

  // 데이터 로드
  useEffect(() => {
    loadExpenses();
  }, [refreshTrigger, selectedBranchId, displayLimit, dateRange.start, dateRange.end]);

  // 초기 로딩 시 전체 데이터 미리 로드 (관리자만)
  useEffect(() => {
    if (isHeadquartersAdmin && branches.length > 0 && expenses.length === 0) {
      // 본사 관리자이고 아직 데이터가 없으면 전체 데이터 미리 로드
      loadExpenses();
    }
  }, [isHeadquartersAdmin, branches.length, expenses.length]);

  // 데이터 로드
  const loadExpenses = async (isLoadMore = false) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      // 본사 관리 탭이거나 '전체' 선택 시 분기 처리
      const targetBranchId = (isHeadquarters || !selectedBranchId || selectedBranchId === 'all')
        ? undefined
        : selectedBranchId;

      const cursor = isLoadMore ? lastDoc : undefined;
      const limitCount = 50; // 한 번에 가져올 개수

      const result = await fetchExpenses({
        branchId: targetBranchId,
        dateFrom: dateRange.start ? startOfDay(new Date(dateRange.start)) : undefined,
        dateTo: dateRange.end ? endOfDay(new Date(dateRange.end)) : undefined,
        limit: limitCount,
        startAfterDoc: cursor,
        category: categoryFilter && categoryFilter !== 'all' ? (categoryFilter as any) : undefined
      });

      if (result) {
        const { expenses: newExpenses, lastDoc: newLastDoc } = result;

        // 지점 이름 보정
        const processedExpenses = newExpenses.map((expense: any) => {
          let branchName = expense.branchName;
          if (!branchName && expense.branchId) {
            branchName = branches.find(b => b.id === expense.branchId)?.name || '';
          }
          return { ...expense, branchName };
        });

        if (isLoadMore) {
          setExpenses(prev => [...prev, ...processedExpenses]);
          setFilteredExpenses(prev => [...prev, ...processedExpenses]); // 필터링된 목록에도 추가 (클라이언트 필터가 없으면 동일)
        } else {
          setExpenses(processedExpenses);
          setFilteredExpenses(processedExpenses);
        }

        setLastDoc(newLastDoc);
        setHasMore(newExpenses.length === limitCount); // 가져온 개수가 limit과 같으면 더 있을 가능성 있음
      }
    } catch (error) {
      console.error('지출 데이터 로드 오류:', error);
      toast({
        title: "오류",
        description: "지출 데이터를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 필터링된 결과 중 화면에 보여줄 갯수 조절 (무한 스크롤)
  // 서버 페이지네이션을 하므로 여기서는 전체를 보여주되, 
  // loadExpenses가 append 방식으로 동작함.
  const displayedExpenses = filteredExpenses;

  // hasMoreToShow -> hasMore (서버 상태)
  const hasMoreToShow = hasMore;

  // 지출 데이터 로드 (조건 변경 시 리셋 및 재로딩)
  useEffect(() => {
    setExpenses([]);
    setFilteredExpenses([]);
    setLastDoc(null);
    setHasMore(true);

    // 상태 업데이트 후 로딩 호출 (setTimeout으로 상태 반영 보장)
    const timer = setTimeout(() => {
      loadExpenses(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshTrigger, selectedBranchId, dateRange.start, dateRange.end, categoryFilter]);

  // 클라이언트 사이드 검색 (이미 불러온 데이터 내에서 검색)
  useEffect(() => {
    let filtered = expenses;

    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(expense =>
        expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.branchName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // 지점 필터 (본사 관리자만 - 이미 불러온 데이터 내에서 추가 필터)
    if (isHeadquarters && selectedBranches.length > 0) {
      filtered = filtered.filter(expense =>
        selectedBranches.includes(expense.branchId)
      );
    }

    setFilteredExpenses(filtered);
  }, [expenses, searchTerm, selectedBranches, isHeadquarters]);

  // 필터링이 변경될 때 선택된 항목들 초기화
  useEffect(() => {
    setSelectedExpenses([]);
  }, [searchTerm, categoryFilter, dateRange.start, dateRange.end, selectedBranches]);

  // 지출 삭제
  const handleDelete = async (expenseId: string) => {
    if (!confirm('정말로 이 지출을 삭제하시겠습니까?')) return;

    try {
      await deleteExpense(expenseId);
      toast({
        title: "성공",
        description: "지출이 삭제되었습니다.",
      });
      loadExpenses();
    } catch (error) {
      console.error('지출 삭제 오류:', error);
      toast({
        title: "오류",
        description: "지출 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedExpenses.length === filteredExpenses.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(filteredExpenses.map(expense => expense.id));
    }
  };

  // 개별 선택/해제
  const handleSelectExpense = (expenseId: string) => {
    setSelectedExpenses(prev =>
      prev.includes(expenseId)
        ? prev.filter(id => id !== expenseId)
        : [...prev, expenseId]
    );
  };

  // 상세보기/수정 다이얼로그 열기
  const handleViewExpense = (expense: any) => {
    setSelectedExpense(expense);
    setIsDetailDialogOpen(true);
  };

  // 지출 수정 완료 후 처리
  const handleExpenseUpdated = (expenseId: string, data: any) => {
    // 목록 새로고침
    loadExpenses();
  };

  // 일괄 삭제
  const handleBulkDelete = async () => {
    if (selectedExpenses.length === 0) {
      toast({
        title: "알림",
        description: "삭제할 항목을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`선택한 ${selectedExpenses.length}개의 지출을 정말로 삭제하시겠습니까?`)) return;

    try {
      setIsDeleting(true);
      let successCount = 0;
      let errorCount = 0;

      for (const expenseId of selectedExpenses) {
        try {
          await deleteExpense(expenseId);
          successCount++;
        } catch (error) {
          console.error(`지출 삭제 오류 (ID: ${expenseId}):`, error);
          errorCount++;
        }
      }

      setSelectedExpenses([]);
      loadExpenses();

      if (successCount > 0) {
        toast({
          title: "완료",
          description: `성공: ${successCount}개, 실패: ${errorCount}개`,
        });
      } else {
        toast({
          title: "오류",
          description: "모든 지출 삭제에 실패했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('일괄 삭제 오류:', error);
      toast({
        title: "오류",
        description: "일괄 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // 엑셀 내보내기
  const handleExportExcel = async () => {
    try {
      if (isHeadquarters && isHeadquartersAdmin) {
        // 본사 관리자: 통합 엑셀 내보내기
        await exportHeadquartersExcel();
      } else {
        // 일반 사용자: 지점별 엑셀 내보내기
        await exportBranchExcel();
      }

      toast({
        title: "성공",
        description: "엑셀 파일이 다운로드되었습니다.",
      });
    } catch (error) {
      console.error('엑셀 내보내기 오류:', error);
      toast({
        title: "오류",
        description: "엑셀 내보내기에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 본사용 통합 엑셀 내보내기
  const exportHeadquartersExcel = async () => {
    const sheets = [];

    // 시트1: 통합 시트
    const consolidatedData = filteredExpenses.length > 0 ? filteredExpenses.map(expense => ({
      '날짜': expense.date?.toDate().toLocaleDateString() || '-',
      '지점': expense.branchName,
      '구매처': expense.supplier,
      '분류': SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category],
      '세부분류': expense.subCategory || '-',
      '품목명': expense.description,
      '수량': expense.quantity || 1,
      '단가': expense.unitPrice || 0,
      '금액': expense.amount,
      '등록일': expense.createdAt?.toDate().toLocaleDateString() || '-'
    })) : [{
      '날짜': '',
      '지점': '데이터 없음',
      '구매처': '',
      '분류': '',
      '세부분류': '',
      '품목명': '',
      '수량': '',
      '단가': '',
      '금액': '',
      '등록일': ''
    }];

    sheets.push({
      name: '통합시트',
      data: consolidatedData
    });

    // 시트2: 본사
    const headquartersExpenses = filteredExpenses.filter(expense => expense.branchId === '본사');
    const headquartersData = headquartersExpenses.length > 0 ? headquartersExpenses.map(expense => ({
      '날짜': expense.date?.toDate().toLocaleDateString() || '-',
      '구매처': expense.supplier,
      '분류': SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category],
      '세부분류': expense.subCategory || '-',
      '품목명': expense.description,
      '수량': expense.quantity || 1,
      '단가': expense.unitPrice || 0,
      '금액': expense.amount,
      '등록일': expense.createdAt?.toDate().toLocaleDateString() || '-'
    })) : [{
      '날짜': '데이터 없음',
      '구매처': '',
      '분류': '',
      '세부분류': '',
      '품목명': '',
      '수량': '',
      '단가': '',
      '금액': '',
      '등록일': ''
    }];

    sheets.push({
      name: '본사',
      data: headquartersData
    });

    // 지점별 시트
    const branchExpenses = {};
    filteredExpenses.forEach(expense => {
      if (!branchExpenses[expense.branchId]) {
        branchExpenses[expense.branchId] = [];
      }
      branchExpenses[expense.branchId].push({
        '날짜': expense.date?.toDate().toLocaleDateString() || '-',
        '지점': expense.branchName || '미지정',
        '구매처': expense.supplier,
        '분류': SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category],
        '세부분류': expense.subCategory || '-',
        '품목명': expense.description,
        '수량': expense.quantity || 1,
        '단가': expense.unitPrice || 0,
        '금액': expense.amount,
        '등록일': expense.createdAt?.toDate().toLocaleDateString() || '-'
      });
    });

    Object.entries(branchExpenses).forEach(([branchId, data]) => {
      const branch = branches.find(b => b.id === branchId);
      if (branch && Array.isArray(data) && data.length > 0) {
        sheets.push({
          name: branch.name,
          data: data as any[]
        });
      }
    });

    // 모든 지점에 대해 빈 시트도 추가 (데이터가 없는 경우)
    branches.filter(b => b.type !== '본사').forEach(branch => {
      const hasSheet = sheets.some(sheet => sheet.name === branch.name);
      if (!hasSheet) {
        sheets.push({
          name: branch.name,
          data: [{
            '날짜': '데이터 없음',
            '지점': branch.name,
            '구매처': '',
            '분류': '',
            '세부분류': '',
            '품목명': '',
            '수량': '',
            '단가': '',
            '금액': '',
            '등록일': ''
          }]
        });
      }
    });

    await exportToExcel(sheets, '간편지출_통합보고서');
  };

  // 지점별 엑셀 내보내기
  const exportBranchExcel = async () => {
    const data = filteredExpenses.length > 0 ? filteredExpenses.map(expense => ({
      '날짜': expense.date.toDate().toLocaleDateString(),
      '지점': expense.branchName || '미지정',
      '구매처': expense.supplier,
      '분류': SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category],
      '세부분류': expense.subCategory || '-',
      '품목명': expense.description,
      '수량': expense.quantity || 1,
      '단가': expense.unitPrice || 0,
      '금액': expense.amount,
      '등록일': expense.createdAt?.toDate().toLocaleDateString() || '-'
    })) : [{
      '날짜': '',
      '지점': '데이터 없음',
      '구매처': '',
      '분류': '',
      '세부분류': '',
      '품목명': '',
      '수량': '',
      '단가': '',
      '금액': '',
      '등록일': ''
    }];

    const branchName = branches.find(b => b.id === selectedBranchId)?.name || '지점';
    await exportToExcel([{ name: branchName, data }], `${branchName}_간편지출보고서`);
  };

  // 총 금액 계산
  const totalAmount = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {isHeadquarters ? '통합 지출 내역' : '지출 내역'}
            </CardTitle>
            <Button onClick={handleExportExcel} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 필터 */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>검색</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="품목명, 구매처, 지점 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSearchTerm('')}
                  disabled={!searchTerm}
                  title="검색 초기화"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>분류</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="전체 분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 분류</SelectItem>
                  {Object.entries(SIMPLE_EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          {/* 본사 관리자용 지점 필터 */}
          {isHeadquarters && isHeadquartersAdmin && (
            <div className="space-y-2">
              <Label>지점 선택</Label>
              <div className="flex flex-wrap gap-2">
                {branches.filter(b => b.type !== '본사').map(branch => (
                  <Button
                    key={branch.id}
                    variant={selectedBranches.includes(branch.id) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedBranches(prev =>
                        prev.includes(branch.id)
                          ? prev.filter(id => id !== branch.id)
                          : [...prev, branch.id]
                      );
                    }}
                  >
                    <Building className="h-4 w-4 mr-2" />
                    {branch.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 통계 및 일괄삭제 */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">
                  총 {filteredExpenses.length}건
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">
                  총 {formatCurrency(totalAmount)}
                </span>
              </div>
              {selectedExpenses.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedExpenses.length}개 선택됨
                  </Badge>
                </div>
              )}
            </div>
            {selectedExpenses.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    삭제 중...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    선택 삭제 ({selectedExpenses.length}개)
                  </div>
                )}
              </Button>
            )}
          </div>

          {/* 테이블 */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-6 w-6 p-0"
                    >
                      {selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </Button>
                  </TableHead>
                  {isHeadquarters && <TableHead>지점</TableHead>}
                  <TableHead>날짜</TableHead>
                  <TableHead>구매처</TableHead>
                  <TableHead>분류</TableHead>
                  <TableHead>품목명</TableHead>
                  <TableHead className="text-center">수량</TableHead>
                  <TableHead className="text-center">단가</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isHeadquarters ? 10 : 9} className="text-center py-8">
                      {isLoading ? '로딩 중...' : '지출 내역이 없습니다.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectExpense(expense.id)}
                          className="h-6 w-6 p-0"
                        >
                          {selectedExpenses.includes(expense.id) ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      {isHeadquarters && (
                        <TableCell>
                          <Badge variant="outline">
                            {expense.branchName}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>
                        {expense.date?.toDate().toLocaleDateString() || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={expense.supplier}>
                          {expense.supplier}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-${getCategoryColor(expense.category)}-500`}
                        >
                          {SIMPLE_EXPENSE_CATEGORY_LABELS[expense.category]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={expense.description}>
                          {expense.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {expense.quantity || 1}
                      </TableCell>
                      <TableCell className="text-center">
                        {expense.unitPrice ? formatCurrency(expense.unitPrice) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(expense.amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewExpense(expense)}
                            title="상세보기/수정"
                          >
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(expense.id)}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 더 보기 버튼 */}
          {hasMoreToShow && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => loadExpenses(true)}
                disabled={isLoading}
                className="w-full max-w-xs"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    로딩 중...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <ChevronDown className="h-4 w-4" />
                    더 보기
                  </div>
                )}
              </Button>
            </div>
          )}
        </CardContent >
      </Card >

      {/* 상세보기/수정 다이얼로그 */}
      < ExpenseDetailDialog
        isOpen={isDetailDialogOpen}
        onOpenChange={setIsDetailDialogOpen}
        expense={selectedExpense}
        onSave={handleExpenseUpdated}
      />
    </>
  );
}
