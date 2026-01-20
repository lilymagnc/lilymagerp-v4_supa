"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckSquare,
  Calendar,
  CalendarDays,
  Building,
  ArrowLeft,
  Edit,
  Download,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  User,
  FileText,
  Cloud,
  GripVertical
} from "lucide-react";
import { useChecklist } from "@/hooks/use-checklist";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { ChecklistRecord, ChecklistTemplate, ChecklistItem } from "@/types/checklist";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function ChecklistDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { userRole, isHQManager } = useUserRole();
  const { getChecklist, getTemplate, toggleItem, updateChecklist, updateTemplate } = useChecklist();
  const { toast } = useToast();

  const [checklist, setChecklist] = useState<ChecklistRecord | null>(null);
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    openWorker: '',
    closeWorker: '',
    responsiblePerson: '',
    notes: '',
    weather: '',
    specialEvents: ''
  });


  const checklistId = params.id as string;

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        setLoading(true);
        const checklistData = await getChecklist(checklistId);
        if (checklistData) {
          // 권한 확인: 본사 관리자가 아니면 자신의 지점 체크리스트만 볼 수 있음
          if (!isHQManager() && user?.role !== '본사 관리자' && checklistData.branchId !== (userRole?.branchId || user?.franchise)) {
            toast({
              title: "접근 권한 없음",
              description: "해당 체크리스트에 접근할 권한이 없습니다.",
              variant: "destructive",
            });
            router.push('/dashboard/checklist');
            return;
          }

          setChecklist(checklistData);

          // 템플릿도 함께 로드
          const templateData = await getTemplate(checklistData.branchId);
          if (templateData) {
            setTemplate(templateData);
          }
        } else {
          toast({
            title: "오류",
            description: "체크리스트를 찾을 수 없습니다.",
            variant: "destructive",
          });
          router.push('/dashboard/checklist');
        }
      } catch (error) {
        console.error('Error loading checklist:', error);
        toast({
          title: "오류",
          description: "체크리스트를 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (checklistId && user) {
      loadChecklist();
    }
  }, [checklistId, user, userRole?.role, getChecklist, getTemplate, router, toast]);

  const handleItemToggle = useCallback(async (itemId: string, checked: boolean) => {
    if (!checklist) return;

    try {
      await toggleItem(checklist.id, itemId, checked);

      // 로컬 상태 업데이트
      setChecklist(prev => {
        if (!prev) return null;

        const updatedItems = prev.items.map(item =>
          item.itemId === itemId ? { ...item, checked } : item
        );

        // 필수 항목만으로 완료율 계산
        const requiredItems = template?.items.filter(item => item.required && item.category === checklist.category) || [];
        const requiredItemIds = requiredItems.map(item => item.id);

        const completedRequiredItems = updatedItems.filter(item =>
          item.checked && requiredItemIds.includes(item.itemId)
        ).length;

        const totalRequiredItems = requiredItemIds.length;
        const completionRate = totalRequiredItems > 0 ? (completedRequiredItems / totalRequiredItems) * 100 : 0;

        let status: 'pending' | 'completed' | 'partial' = 'pending';
        if (completionRate === 100) status = 'completed';
        else if (completionRate > 0) status = 'partial';

        return {
          ...prev,
          items: updatedItems,
          status,
        };
      });
    } catch (error) {
      console.error('Error toggling item:', error);
      toast({
        title: "오류",
        description: "항목 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  }, [checklist, toggleItem, toast]);

  const getStatusIcon = useCallback((status: string) => {
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
  }, []);

  const getStatusText = useCallback((status: string) => {
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
  }, []);

  const getStatusColor = useCallback((status: string) => {
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
  }, []);

  const getCategoryIcon = useCallback((category: string) => {
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
  }, []);

  const calculateCompletionRate = useCallback(() => {
    if (!checklist || !template) return 0;

    // 필수 항목만으로 완료율 계산
    const requiredItems = template.items.filter(item => item.required && item.category === checklist.category);
    const requiredItemIds = requiredItems.map(item => item.id);

    const completedRequiredItems = checklist.items.filter(item =>
      item.checked && requiredItemIds.includes(item.itemId)
    ).length;

    const totalRequiredItems = requiredItemIds.length;
    return totalRequiredItems > 0 ? (completedRequiredItems / totalRequiredItems) * 100 : 0;
  }, [checklist, template]);

  const getItemByRecord = useCallback((itemId: string): ChecklistItem | undefined => {
    return template?.items.find(item => item.id === itemId);
  }, [template]);

  const getRequiredItems = useCallback(() => {
    if (!checklist) return [];
    return checklist.items.filter(record => {
      const item = getItemByRecord(record.itemId);
      return item?.required;
    });
  }, [checklist, getItemByRecord]);

  const getCompletedRequiredItems = useCallback(() => {
    return getRequiredItems().filter(item => item.checked);
  }, [getRequiredItems]);

  // 편집 관련 함수들
  const handleEditClick = useCallback(() => {
    if (!checklist) return;

    setEditForm({
      openWorker: checklist.openWorker || '',
      closeWorker: checklist.closeWorker || '',
      responsiblePerson: checklist.responsiblePerson || '',
      notes: checklist.notes || '',
      weather: checklist.weather || '',
      specialEvents: checklist.specialEvents || ''
    });
    setEditDialogOpen(true);
  }, [checklist]);

  const handleEditSave = useCallback(async () => {
    if (!checklist) return;

    try {
      await updateChecklist(checklist.id, {
        openWorker: editForm.openWorker,
        closeWorker: editForm.closeWorker,
        responsiblePerson: editForm.responsiblePerson,
        notes: editForm.notes,
        weather: editForm.weather,
        specialEvents: editForm.specialEvents
      });

      // 로컬 상태 업데이트
      setChecklist(prev => {
        if (!prev) return null;
        return {
          ...prev,
          openWorker: editForm.openWorker,
          closeWorker: editForm.closeWorker,
          responsiblePerson: editForm.responsiblePerson,
          notes: editForm.notes,
          weather: editForm.weather,
          specialEvents: editForm.specialEvents
        };
      });

      setEditDialogOpen(false);
      toast({
        title: "편집 완료",
        description: "체크리스트가 성공적으로 수정되었습니다.",
      });
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast({
        title: "오류",
        description: "체크리스트 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  }, [checklist, editForm, updateChecklist, toast]);



  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="체크리스트 상세"
          description="체크리스트를 확인하세요."
        />
        <div className="animate-pulse space-y-4">
          <Card>
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="체크리스트 상세"
          description="체크리스트를 확인하세요."
        />
        <Card>
          <CardContent className="p-8 text-center">
            <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">체크리스트를 찾을 수 없습니다.</p>
            <Button onClick={() => router.push('/dashboard/checklist')}>
              체크리스트 목록으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="체크리스트 상세"
        description="체크리스트를 확인하세요."
      />

      {/* 체크리스트 헤더 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {getCategoryIcon(checklist.category)}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold">
                    {checklist.category === 'daily' && `${format(new Date(checklist.date), 'yyyy년 M월 d일 (E)', { locale: ko })} 일일체크리스트`}
                    {checklist.category === 'weekly' && `${format(new Date(checklist.date), 'yyyy년 M월 d일', { locale: ko })} 주간체크리스트`}
                    {checklist.category === 'monthly' && `${format(new Date(checklist.date), 'yyyy년 M월', { locale: ko })} 월간체크리스트`}
                  </h2>
                  <Badge className={getStatusColor(checklist.status)}>
                    {getStatusIcon(checklist.status)}
                    <span className="ml-1">{getStatusText(checklist.status)}</span>
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  지점: {checklist.branchName || '지점명 없음'} |
                  작성일: {format(checklist.completedAt.toDate(), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">
                  {calculateCompletionRate().toFixed(1)}%
                </p>
                <Progress value={calculateCompletionRate()} className="w-20 h-2" />
              </div>
              <Badge variant="outline">
                {getCompletedRequiredItems().length}/{getRequiredItems().length} 필수 완료
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 담당자 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            담당자 정보
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">오픈 근무자</p>
              <p className="font-medium">{checklist.openWorker || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">마감 근무자</p>
              <p className="font-medium">{checklist.closeWorker || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">담당자</p>
              <p className="font-medium">{checklist.responsiblePerson || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메타 정보 */}
      {(checklist.notes || checklist.weather || checklist.specialEvents) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              추가 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklist.weather && (
                <div>
                  <p className="text-sm font-medium text-gray-500">날씨</p>
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    <p>{checklist.weather}</p>
                  </div>
                </div>
              )}
              {checklist.specialEvents && (
                <div>
                  <p className="text-sm font-medium text-gray-500">특별 이벤트</p>
                  <p>{checklist.specialEvents}</p>
                </div>
              )}
            </div>
            {checklist.notes && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500">메모</p>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{checklist.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 체크리스트 항목들 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            업무 체크리스트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {checklist.items.map((record) => {
              const item = getItemByRecord(record.itemId);
              if (!item) return null;

              return (
                <div
                  key={record.itemId}
                  className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${record.checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                >
                  <Checkbox
                    checked={record.checked}
                    onCheckedChange={(checked) =>
                      handleItemToggle(record.itemId, checked as boolean)
                    }
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${record.checked ? 'line-through text-gray-500' : ''}`}>
                        {item.title}
                      </p>
                      {item.required && (
                        <Badge variant="destructive" className="text-xs">
                          필수
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {item.description}
                      </p>
                    )}
                    {record.notes && (
                      <p className="text-sm text-blue-600 mt-1">
                        메모: {record.notes}
                      </p>
                    )}
                    {record.checked && record.checkedBy && (
                      <p className="text-xs text-gray-500 mt-1">
                        체크: {record.checkedBy} | {record.checkedAt && format(record.checkedAt.toDate(), 'MM/dd HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 액션 버튼 */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로 가기
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleEditClick}
          >
            <Edit className="h-4 w-4 mr-2" />
            편집
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/checklist/template')}
            className="border-orange-200 text-orange-700 hover:bg-orange-50"
          >
            <GripVertical className="h-4 w-4 mr-2" />
            템플릿 편집
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              // 엑셀 다운로드 기능 (향후 구현)
              // 엑셀 다운로드 기능 (향후 구현)

            }}
          >
            <Download className="h-4 w-4 mr-2" />
            다운로드
          </Button>
        </div>
      </div>

      {/* 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>체크리스트 편집</DialogTitle>
            <DialogDescription>
              체크리스트 정보를 수정하세요. 변경사항은 즉시 저장됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* 담당자 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openWorker">오픈 근무자</Label>
                <Input
                  id="openWorker"
                  value={editForm.openWorker}
                  onChange={(e) => setEditForm(prev => ({ ...prev, openWorker: e.target.value }))}
                  placeholder="오픈 근무자명"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closeWorker">마감 근무자</Label>
                <Input
                  id="closeWorker"
                  value={editForm.closeWorker}
                  onChange={(e) => setEditForm(prev => ({ ...prev, closeWorker: e.target.value }))}
                  placeholder="마감 근무자명"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="responsiblePerson">담당자</Label>
                <Input
                  id="responsiblePerson"
                  value={editForm.responsiblePerson}
                  onChange={(e) => setEditForm(prev => ({ ...prev, responsiblePerson: e.target.value }))}
                  placeholder="담당자명"
                />
              </div>
            </div>

            {/* 날씨 및 특별 이벤트 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weather">날씨</Label>
                <Input
                  id="weather"
                  value={editForm.weather}
                  onChange={(e) => setEditForm(prev => ({ ...prev, weather: e.target.value }))}
                  placeholder="예: 맑음, 흐림, 비, 눈"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialEvents">특별 이벤트</Label>
                <Input
                  id="specialEvents"
                  value={editForm.specialEvents}
                  onChange={(e) => setEditForm(prev => ({ ...prev, specialEvents: e.target.value }))}
                  placeholder="예: 행사, 휴일, 특별 업무"
                />
              </div>
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label htmlFor="notes">메모</Label>
              <Textarea
                id="notes"
                value={editForm.notes}
                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="추가 메모를 입력하세요..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEditSave}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
