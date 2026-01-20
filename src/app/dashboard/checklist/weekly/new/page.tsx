"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckSquare, 
  CalendarDays, 
  Save, 
  ArrowLeft,
  User,
  Clock,
  FileText
} from "lucide-react";
import { useChecklist } from "@/hooks/use-checklist";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { ChecklistTemplate, ChecklistItem, ChecklistItemRecord } from "@/types/checklist";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { ko } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

export default function NewWeeklyChecklistPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { userRole } = useUserRole();
  const { getTemplate, createChecklist, toggleItem, addWorker } = useChecklist();
  const { toast } = useToast();
  
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // 담당자 정보
  const [openWorker, setOpenWorker] = useState("");
  const [closeWorker, setCloseWorker] = useState("");
  const [responsiblePerson, setResponsiblePerson] = useState(user?.displayName || "");
  
  // 메타 정보
  const [notes, setNotes] = useState("");
  const [specialEvents, setSpecialEvents] = useState("");
  
  // 체크리스트 항목들
  const [items, setItems] = useState<ChecklistItemRecord[]>([]);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  
  // 날짜 (이번 주로 기본 설정)
  const [selectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true);
        const branchId = userRole?.branchId || user?.franchise || '';
        if (!branchId) {
          toast({
            title: "오류",
            description: "지점 정보를 찾을 수 없습니다.",
            variant: "destructive",
          });
          router.push('/dashboard/checklist');
          return;
        }
        const templateData = await getTemplate(branchId);
        if (templateData) {
          setTemplate(templateData);
          
          // Weekly 항목들만 필터링하여 초기화
          const weeklyItems = templateData.items
            .filter(item => item.category === 'weekly')
            .map(item => ({
              itemId: item.id,
              checked: false,
            }));
          setItems(weeklyItems);
        }
      } catch (error) {
        console.error('Error loading template:', error);
        toast({
          title: "오류",
          description: "템플릿을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadTemplate();
    }
  }, [user, getTemplate, toast]);

  const handleCreateChecklist = async () => {
    if (!template) return;

    try {
      setSaving(true);
      
      // 근무자 정보 저장
      if (openWorker) await addWorker(openWorker);
      if (closeWorker) await addWorker(closeWorker);
      if (responsiblePerson) await addWorker(responsiblePerson);

      const checklistId = await createChecklist(
        template.id,
        selectedDate,
        'weekly',
        {
          openWorker,
          closeWorker,
          responsiblePerson,
        },
        {
          notes,
          specialEvents,
        }
      );

      setChecklistId(checklistId);
      
      toast({
        title: "성공",
        description: "주간 체크리스트가 생성되었습니다.",
      });
    } catch (error) {
      console.error('Error creating checklist:', error);
      toast({
        title: "오류",
        description: "체크리스트 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleItemToggle = async (itemId: string, checked: boolean) => {
    if (!checklistId) return;

    try {
      await toggleItem(checklistId, itemId, checked);
      
      // 로컬 상태 업데이트
      setItems(prev => prev.map(item => 
        item.itemId === itemId ? { ...item, checked } : item
      ));
    } catch (error) {
      console.error('Error toggling item:', error);
      toast({
        title: "오류",
        description: "항목 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getItemByRecord = (record: ChecklistItemRecord): ChecklistItem | undefined => {
    return template?.items.find(item => item.id === record.itemId);
  };

  const calculateCompletionRate = () => {
    const totalItems = items.length;
    const completedItems = items.filter(item => item.checked).length;
    return totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  };

  const getRequiredItems = () => {
    return items.filter(record => {
      const item = getItemByRecord(record);
      return item?.required;
    });
  };

  const getCompletedRequiredItems = () => {
    return getRequiredItems().filter(item => item.checked);
  };

  const getWeekRange = () => {
    const start = startOfWeek(new Date(selectedDate), { weekStartsOn: 1 });
    const end = endOfWeek(new Date(selectedDate), { weekStartsOn: 1 });
    return {
      start: format(start, 'yyyy년 M월 d일', { locale: ko }),
      end: format(end, 'yyyy년 M월 d일', { locale: ko })
    };
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader 
          title="새 주간 체크리스트" 
          description="이번 주 업무를 체크하세요." 
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

  const weekRange = getWeekRange();

  return (
    <div className="space-y-8">
      <PageHeader 
        title="새 주간 체크리스트" 
        description={`${userRole?.branchName || user?.franchise || '지점명 없음'} - 이번 주 업무를 체크하세요.`}
      />

      {/* 담당자 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            담당자 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="openWorker">오픈 근무자</Label>
              <Input
                id="openWorker"
                value={openWorker}
                onChange={(e) => setOpenWorker(e.target.value)}
                placeholder="오픈 근무자명"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closeWorker">마감 근무자</Label>
              <Input
                id="closeWorker"
                value={closeWorker}
                onChange={(e) => setCloseWorker(e.target.value)}
                placeholder="마감 근무자명"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsiblePerson">담당자</Label>
              <Input
                id="responsiblePerson"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="담당자명"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메타 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            추가 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="specialEvents">특별 이벤트</Label>
            <Select value={specialEvents} onValueChange={setSpecialEvents}>
              <SelectTrigger>
                <SelectValue placeholder="특별한 이벤트가 있나요?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="없음">없음</SelectItem>
                <SelectItem value="행사">행사</SelectItem>
                <SelectItem value="휴일">휴일</SelectItem>
                <SelectItem value="점검">점검</SelectItem>
                <SelectItem value="기타">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">주간 메모</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="이번 주 특이사항이나 메모를 입력하세요..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 체크리스트 항목들 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              주간 업무 체크리스트
            </CardTitle>
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
          <p className="text-sm text-gray-600">
            {weekRange.start} ~ {weekRange.end} 주간 체크리스트
          </p>
        </CardHeader>
        <CardContent>
          {!checklistId ? (
            <div className="text-center py-8">
              <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">주간 체크리스트를 생성하면 업무를 체크할 수 있습니다.</p>
              <Button 
                onClick={handleCreateChecklist}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    주간 체크리스트 생성
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((record) => {
                const item = getItemByRecord(record);
                if (!item) return null;

                return (
                  <div 
                    key={record.itemId}
                    className={`flex items-start gap-4 p-4 border rounded-lg transition-colors ${
                      record.checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
        {checklistId && (
          <Button 
            onClick={() => router.push('/dashboard/checklist')}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckSquare className="h-4 w-4 mr-2" />
            완료
          </Button>
        )}
      </div>
    </div>
  );
}
