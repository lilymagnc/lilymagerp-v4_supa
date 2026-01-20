"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  CheckSquare,
  Calendar,
  CalendarDays,
  Building,
  Search,
  Filter,
  Eye,
  Download,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Trash2,
  Check
} from "lucide-react";
import { useChecklist } from "@/hooks/use-checklist";
import { useAuth } from "@/hooks/use-auth";
import { ChecklistRecord, ChecklistTemplate } from "@/types/checklist";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { exportSingleChecklist, exportMultipleChecklists, exportChecklistSummary } from "@/lib/excel-export";


export default function ChecklistHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { getChecklists, getTemplate, deleteChecklist } = useChecklist();

  const [checklists, setChecklists] = useState<ChecklistRecord[]>([]);
  const [filteredChecklists, setFilteredChecklists] = useState<ChecklistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, ChecklistTemplate>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [checklistToDelete, setChecklistToDelete] = useState<ChecklistRecord | null>(null);
  const [selectedChecklists, setSelectedChecklists] = useState<Set<string>>(new Set());
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  // 필터 상태
  const [dateFilter, setDateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workerFilter, setWorkerFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);


        // 타임아웃 설정 (10초)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Loading timeout')), 10000);
        });

        const dataPromise = getChecklists({});
        const data = await Promise.race([dataPromise, timeoutPromise]) as ChecklistRecord[];


        setChecklists(data);
        setFilteredChecklists(data);

        // 각 체크리스트의 지점별로 템플릿 로드
        const uniqueBranchIds = [...new Set(data.map(checklist => checklist.branchId))];
        const templatesData: Record<string, ChecklistTemplate> = {};

        for (const branchId of uniqueBranchIds) {
          try {

            const templateData = await getTemplate(branchId);
            if (templateData) {
              templatesData[branchId] = templateData;

            }
          } catch (error) {
            console.error('Failed to load template for branch:', branchId, error);
          }
        }


        setTemplates(templatesData);
      } catch (error) {
        console.error('Error loading data:', error);
        // 오류가 발생해도 로딩 상태를 해제
        setChecklists([]);
        setFilteredChecklists([]);
        setError(error instanceof Error ? error.message : '데이터 로딩 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    } else {
      // 사용자가 없으면 로딩 상태 해제
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    // 필터링 로직
    let filtered = checklists;

    if (dateFilter) {
      filtered = filtered.filter(checklist => checklist.date === dateFilter);
    }

    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(checklist => {
        const estimatedCategory = estimateChecklistCategory(checklist);
        return estimatedCategory === categoryFilter;
      });
    }

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(checklist => getCorrectStatus(checklist) === statusFilter);
    }

    if (workerFilter && workerFilter !== 'all') {
      filtered = filtered.filter(checklist =>
        checklist.responsiblePerson === workerFilter ||
        checklist.openWorker === workerFilter ||
        checklist.closeWorker === workerFilter
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(checklist =>
        checklist.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.openWorker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.closeWorker.toLowerCase().includes(searchTerm.toLowerCase()) ||
        checklist.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredChecklists(filtered);
  }, [checklists, templates, dateFilter, categoryFilter, statusFilter, workerFilter, searchTerm]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'pending':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'partial':
        return '진행중';
      case 'pending':
        return '대기';
      default:
        return '미정';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'daily':
        return <Calendar className="h-4 w-4" />;
      case 'weekly':
        return <CalendarDays className="h-4 w-4" />;
      case 'monthly':
        return <Building className="h-4 w-4" />;
      default:
        return <CheckSquare className="h-4 w-4" />;
    }
  };

  // 체크리스트 카테고리 추정 함수
  const estimateChecklistCategory = (checklist: ChecklistRecord): 'daily' | 'weekly' | 'monthly' => {
    // 이미 category 필드가 있으면 그대로 사용
    if (checklist.category) {
      return checklist.category;
    }

    // category 필드가 없는 경우, 항목 수를 기반으로 추정
    const itemCount = checklist.items.length;

    // 일일 체크리스트는 보통 10-20개 항목
    if (itemCount >= 10 && itemCount <= 20) {
      return 'daily';
    }
    // 주간 체크리스트는 보통 5-10개 항목
    else if (itemCount >= 5 && itemCount < 10) {
      return 'weekly';
    }
    // 월간 체크리스트는 보통 3-8개 항목
    else if (itemCount >= 3 && itemCount < 8) {
      return 'monthly';
    }

    // 기본값은 일일 체크리스트
    return 'daily';
  };

  const calculateCompletionRate = (checklist: ChecklistRecord) => {
    // 해당 체크리스트의 지점 템플릿 가져오기
    const branchTemplate = templates[checklist.branchId];

    if (!branchTemplate) {
      // 템플릿이 없으면 모든 항목을 기준으로 계산
      const totalItems = checklist.items.length;
      const completedItems = checklist.items.filter(item => item.checked).length;
      return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    }

    // 템플릿이 있으면 필수 항목만 계산
    const estimatedCategory = estimateChecklistCategory(checklist);
    const requiredItems = branchTemplate.items.filter(item => item.required && item.category === estimatedCategory);
    const requiredItemIds = requiredItems.map(item => item.id);

    const completedRequiredItems = checklist.items.filter(item =>
      item.checked && requiredItemIds.includes(item.itemId)
    ).length;

    const totalRequiredItems = requiredItemIds.length;
    const completionRate = totalRequiredItems > 0 ? (completedRequiredItems / totalRequiredItems) * 100 : 0;

    // 디버깅용 로그


    return completionRate;
  };

  const getUniqueWorkers = () => {
    const workers = new Set<string>();
    checklists.forEach(checklist => {
      if (checklist.responsiblePerson) workers.add(checklist.responsiblePerson);
      if (checklist.openWorker) workers.add(checklist.openWorker);
      if (checklist.closeWorker) workers.add(checklist.closeWorker);
    });
    return Array.from(workers).sort();
  };

  const handleViewChecklist = (checklistId: string) => {
    router.push(`/dashboard/checklist/${checklistId}`);
  };

  const handleDeleteClick = (checklist: ChecklistRecord) => {
    setChecklistToDelete(checklist);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!checklistToDelete) return;

    try {
      await deleteChecklist(checklistToDelete.id);

      // 로컬 상태에서도 제거
      setChecklists(prev => prev.filter(c => c.id !== checklistToDelete.id));
      setFilteredChecklists(prev => prev.filter(c => c.id !== checklistToDelete.id));

      setDeleteDialogOpen(false);
      setChecklistToDelete(null);
    } catch (error) {
      console.error('Failed to delete checklist:', error);
      // 에러 처리는 useChecklist에서 이미 하고 있음
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setChecklistToDelete(null);
  };

  // 체크리스트 선택 토글
  const toggleChecklistSelection = (checklistId: string) => {
    const newSelected = new Set(selectedChecklists);
    if (newSelected.has(checklistId)) {
      newSelected.delete(checklistId);
    } else {
      newSelected.add(checklistId);
    }
    setSelectedChecklists(newSelected);
  };

  // 전체 선택/해제
  const toggleAllSelection = () => {
    if (selectedChecklists.size === filteredChecklists.length) {
      setSelectedChecklists(new Set());
    } else {
      setSelectedChecklists(new Set(filteredChecklists.map(c => c.id)));
    }
  };

  // 단일 체크리스트 다운로드
  const handleSingleDownload = (checklist: ChecklistRecord) => {
    const template = templates[checklist.branchId];
    exportSingleChecklist(checklist, template);
  };

  // 선택된 체크리스트들 다운로드
  const handleMultipleDownload = () => {
    const selectedChecklistData = filteredChecklists.filter(c => selectedChecklists.has(c.id));
    if (selectedChecklistData.length === 0) return;

    exportMultipleChecklists(selectedChecklistData, templates);
    setDownloadDialogOpen(false);
    setSelectedChecklists(new Set());
  };

  // 요약 다운로드
  const handleSummaryDownload = () => {
    exportChecklistSummary(filteredChecklists);
    setDownloadDialogOpen(false);
  };

  // 다운로드 다이얼로그 닫기
  const handleDownloadCancel = () => {
    setDownloadDialogOpen(false);
  };

  const clearFilters = () => {
    setDateFilter("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setWorkerFilter("all");
    setSearchTerm("");
  };

  // 기존 체크리스트들의 상태를 올바르게 계산하는 함수
  const getCorrectStatus = (checklist: ChecklistRecord) => {
    const completionRate = calculateCompletionRate(checklist);

    if (completionRate === 100) return 'completed';
    else if (completionRate > 0) return 'partial';
    else return 'pending';
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="체크리스트 히스토리"
          description="작성된 체크리스트를 확인하세요."
        />

        {/* 필터 섹션 스켈레톤 */}
        <Card>
          <CardHeader>
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 체크리스트 목록 스켈레톤 */}
        <div className="animate-pulse space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-4 w-4 bg-gray-200 rounded"></div>
                    <div>
                      <div className="h-5 bg-gray-200 rounded w-48 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-64"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="h-4 bg-gray-200 rounded w-12 mb-1"></div>
                      <div className="h-2 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-16 bg-gray-200 rounded"></div>
                      <div className="h-8 w-20 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="체크리스트 히스토리"
          description="작성된 체크리스트를 확인하세요."
        />

        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">데이터 로딩 오류</h3>
            <p className="text-gray-500 mb-4">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                setLoading(true);
                // 페이지 새로고침
                window.location.reload();
              }}
            >
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="체크리스트 히스토리"
        description="작성된 체크리스트를 확인하세요."
      />

      {/* 필터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            필터 및 검색
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFilter">날짜</Label>
              <Input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                placeholder="날짜 선택"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryFilter">카테고리</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="daily">일일</SelectItem>
                  <SelectItem value="weekly">주간</SelectItem>
                  <SelectItem value="monthly">월간</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="statusFilter">상태</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="partial">진행중</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workerFilter">근무자</Label>
              <Select value={workerFilter} onValueChange={setWorkerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="근무자 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {getUniqueWorkers().map(worker => (
                    <SelectItem key={worker} value={worker}>
                      {worker}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="searchTerm">검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="searchTerm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="검색어 입력..."
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              총 {checklists.length}개의 체크리스트 중 {filteredChecklists.length}개 표시
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDownloadDialogOpen(true)}
                size="sm"
                disabled={filteredChecklists.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                엑셀 다운로드
              </Button>
              <Button
                variant="outline"
                onClick={clearFilters}
                size="sm"
              >
                필터 초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 체크리스트 목록 */}
      <div className="space-y-4">
        {/* 전체 선택 헤더 */}
        {filteredChecklists.length > 0 && (
          <Card className="bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedChecklists.size === filteredChecklists.length && filteredChecklists.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">전체 선택</span>
                </div>
                {selectedChecklists.size > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedChecklists.size}개 선택됨
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {filteredChecklists.length > 0 ? (
          filteredChecklists.map((checklist) => (
            <Card key={checklist.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedChecklists.has(checklist.id)}
                      onChange={() => toggleChecklistSelection(checklist.id)}
                      className="rounded border-gray-300"
                    />
                    {getCategoryIcon(estimateChecklistCategory(checklist))}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">
                          {(() => {
                            const category = estimateChecklistCategory(checklist);
                            switch (category) {
                              case 'daily':
                                return `${format(new Date(checklist.date), 'yyyy년 M월 d일 (E)', { locale: ko })} 일일체크리스트`;
                              case 'weekly':
                                return `${format(new Date(checklist.date), 'yyyy년 M월 d일', { locale: ko })} 주간체크리스트`;
                              case 'monthly':
                                return `${format(new Date(checklist.date), 'yyyy년 M월', { locale: ko })} 월간체크리스트`;
                              default:
                                return `${format(new Date(checklist.date), 'yyyy년 M월 d일 (E)', { locale: ko })} 체크리스트`;
                            }
                          })()}
                        </h3>
                        <Badge className={getStatusColor(getCorrectStatus(checklist))}>
                          {getStatusIcon(getCorrectStatus(checklist))}
                          <span className="ml-1">{getStatusText(getCorrectStatus(checklist))}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">

                        담당자: {checklist.responsiblePerson || '미입력'} |
                        오픈: {checklist.openWorker || '미입력'} |
                        마감: {checklist.closeWorker || '미입력'}
                      </p>
                      <p className="text-sm text-gray-500">
                        생성일: {checklist.completedAt && format(checklist.completedAt.toDate(), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                      </p>
                      {checklist.notes && (
                        <p className="text-sm text-gray-500 mt-1">
                          메모: {checklist.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {calculateCompletionRate(checklist).toFixed(1)}%
                      </p>
                      <Progress
                        value={calculateCompletionRate(checklist)}
                        className="w-20 h-2"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewChecklist(checklist.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        보기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSingleDownload(checklist)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        다운로드
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(checklist)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                {checklists.length === 0
                  ? "아직 작성된 체크리스트가 없습니다."
                  : "필터 조건에 맞는 체크리스트가 없습니다."
                }
              </p>
              <p className="text-sm text-gray-400 mb-4">
                총 {checklists.length}개의 체크리스트 중 {filteredChecklists.length}개가 표시됩니다.
              </p>
              {checklists.length === 0 && (
                <Button
                  onClick={() => router.push('/dashboard/checklist/daily/new')}
                >
                  첫 체크리스트 작성하기
                </Button>
              )}
              {(checklists.length > 0 && filteredChecklists.length === 0) && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                >
                  필터 초기화
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-start">
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로 가기
        </Button>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>체크리스트 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 체크리스트를 삭제하시겠습니까?
              <br />
              <span className="font-medium text-red-600">
                이 작업은 되돌릴 수 없습니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 다운로드 옵션 다이얼로그 */}
      <AlertDialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>엑셀 다운로드</AlertDialogTitle>
            <AlertDialogDescription>
              다운로드할 방식을 선택하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-4">
              <Button
                variant="outline"
                onClick={handleSummaryDownload}
                className="justify-start h-auto p-4"
              >
                <div className="text-left">
                  <div className="font-medium">요약 정보 다운로드</div>
                  <div className="text-sm text-gray-500">
                    모든 체크리스트의 요약 정보를 하나의 시트로 다운로드
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                onClick={handleMultipleDownload}
                disabled={selectedChecklists.size === 0}
                className="justify-start h-auto p-4"
              >
                <div className="text-left">
                  <div className="font-medium">선택된 체크리스트 다운로드</div>
                  <div className="text-sm text-gray-500">
                    선택된 {selectedChecklists.size}개 체크리스트를 각각 별도 시트로 다운로드
                  </div>
                </div>
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDownloadCancel}>
              취소
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
