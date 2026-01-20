"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CalendarEvent } from '@/hooks/use-calendar';
import { canEditCalendarEvent, canDeleteCalendarEvent, type User } from '@/lib/calendar-permissions';

interface EventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  branches: Array<{ id: string; name: string; type: string }>;
  onSave: (event: Omit<CalendarEvent, 'id'>) => void;
  onDelete?: (id: string) => void;
  currentUser?: User;
}

export function EventDialog({
  isOpen,
  onOpenChange,
  event,
  branches,
  onSave,
  onDelete,
  currentUser
}: EventDialogProps) {
  const isEditing = !!event;
  
  // 권한 확인 로직
  const canEdit = useMemo(() => {
    return canEditCalendarEvent(currentUser || null, event);
  }, [currentUser, event]);
  
  const canDelete = useMemo(() => {
    return canDeleteCalendarEvent(currentUser || null, event);
  }, [currentUser, event]);
  
  // 폼 상태
  const [formData, setFormData] = useState({
    type: 'delivery' as CalendarEvent['type'],
    title: '',
    description: '',
    startDate: new Date(),
    endDate: undefined as Date | undefined,
    startTime: '',
    endTime: '',
    branchName: '',
    status: 'pending' as CalendarEvent['status'],
    isAllDay: false
  });

  // 이벤트 타입별 설정
  const eventTypes = [
    { value: 'delivery', label: '배송', color: 'bg-blue-500' },
    { value: 'pickup', label: '픽업', color: 'bg-green-500' },
    { value: 'material', label: '자재요청', color: 'bg-orange-500' },
    { value: 'employee', label: '직원스케줄', color: 'bg-purple-500' },
    { value: 'notice', label: '공지/알림', color: 'bg-red-500' },
    { value: 'payment', label: '월결제일', color: 'bg-yellow-500' }
  ];

  // 이벤트 타입 변경 시 지점 자동 설정
  const handleEventTypeChange = (value: string) => {
    const newType = value as CalendarEvent['type'];
    setFormData(prev => ({
      ...prev,
      type: newType,
      // 공지/알림의 경우 사용자 권한에 따라 설정
      branchName: newType === 'notice' 
        ? (currentUser?.role === '본사 관리자' ? '전체' : currentUser?.franchise || '')
        : (currentUser?.role === '본사 관리자' ? branches[0]?.name || '' : currentUser?.franchise || '')
    }));
  };

  // 이벤트 편집 시 폼 데이터 초기화
  useEffect(() => {
    if (event) {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : undefined;
      
      setFormData({
        type: event.type,
        title: event.title,
        description: event.description || '',
        startDate: startDate,
        endDate: endDate,
        startTime: event.startDate ? format(startDate, 'HH:mm') : '',
        endTime: event.endDate ? format(endDate!, 'HH:mm') : '',
        branchName: event.branchName,
        status: event.status,
        isAllDay: event.isAllDay || false
      });
    } else {
      // 새 이벤트 생성 시 기본값 설정
      const defaultBranch = currentUser?.role === '본사 관리자' 
        ? branches[0]?.name || '' 
        : currentUser?.franchise || '';
      
      setFormData({
        type: 'delivery',
        title: '',
        description: '',
        startDate: new Date(),
        endDate: undefined,
        startTime: '',
        endTime: '',
        branchName: defaultBranch,
        status: 'pending',
        isAllDay: false
      });
    }
  }, [event, branches, currentUser]);

  // 폼 제출 처리
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 자동 생성된 이벤트는 수정할 수 없음
    if (event?.relatedId) {
      alert('자동 생성된 픽업/배송 예약은 수정할 수 없습니다. 주문 관리에서 수정해주세요.');
      return;
    }
    
    // 종료날짜가 설정되지 않은 경우 시작날짜와 동일하게 설정
    const endDate = formData.endDate || formData.startDate;
    
    // 시간 정보를 날짜에 적용
    let startDateWithTime = new Date(formData.startDate);
    let endDateWithTime = new Date(endDate);
    
    if (formData.startTime) {
      const [hours, minutes] = formData.startTime.split(':').map(Number);
      startDateWithTime.setHours(hours, minutes, 0, 0);
    }
    
    if (formData.endTime) {
      const [hours, minutes] = formData.endTime.split(':').map(Number);
      endDateWithTime.setHours(hours, minutes, 0, 0);
    }
    
    const eventData: Omit<CalendarEvent, 'id'> = {
      type: formData.type,
      title: formData.title,
      description: formData.description,
      startDate: startDateWithTime,
      endDate: endDateWithTime,
      branchName: formData.branchName,
      status: formData.status,
      color: eventTypes.find(t => t.value === formData.type)?.color || 'bg-gray-500',
      isAllDay: formData.isAllDay,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: currentUser?.uid || 'unknown',
      createdByRole: currentUser?.role,
      createdByBranch: currentUser?.franchise
    };

    onSave(eventData);
    onOpenChange(false);
  };

  // 삭제 처리
  const handleDelete = async () => {
    if (event && onDelete) {
      // 자동 생성된 이벤트는 삭제할 수 없음
      if (event.relatedId) {
        alert('자동 생성된 픽업/배송 예약은 삭제할 수 없습니다. 주문 관리에서 처리해주세요.');
        return;
      }
      
      try {
        await onDelete(event.id);
        // 삭제 후 다이얼로그 닫기
        onOpenChange(false);
      } catch (error) {
        console.error('삭제 중 오류 발생:', error);
      }
    }
  };

  // 픽업/배송관리 페이지로 이동
  const handleGoToPickupDelivery = () => {
    if (event?.relatedId) {
      window.location.href = '/dashboard/pickup-delivery';
    }
  };

  // 자재요청 페이지로 이동
  const handleGoToMaterialRequest = () => {
    if (event?.relatedId) {
      window.location.href = '/dashboard/material-request';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '일정 수정' : '새 일정 추가'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? '일정 정보를 수정하세요.' : '새로운 일정을 추가하세요.'}
          </DialogDescription>
        </DialogHeader>

        {/* 픽업/배송 예약 이벤트인 경우 이동 버튼 표시 */}
        {event?.relatedId && event.type === 'delivery' && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800">픽업/배송 예약</p>
                <p className="text-xs text-blue-600">이 일정은 주문 시스템에서 자동 생성되었습니다. 수정/삭제는 주문 관리에서 해주세요.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToPickupDelivery}
                className="text-blue-600 border-blue-300 hover:bg-blue-100"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                픽업/배송관리로 이동
              </Button>
            </div>
          </div>
        )}

        {/* 자재요청 이벤트인 경우 이동 버튼 표시 */}
        {event?.relatedId && event.type === 'material' && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-800">자재요청</p>
                <p className="text-xs text-orange-600">이 일정은 자재요청 시스템에서 자동 생성되었습니다. 수정/삭제는 자재요청 관리에서 해주세요.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoToMaterialRequest}
                className="text-orange-600 border-orange-300 hover:bg-orange-100"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                자재요청 관리로 이동
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" id="event-form">
          {/* 이벤트 타입 */}
          <div className="space-y-2">
            <Label htmlFor="type">이벤트 유형</Label>
            <Select
              value={formData.type}
              onValueChange={handleEventTypeChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 제목 */}
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="일정 제목을 입력하세요"
              required
            />
          </div>

          {/* 설명 */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {formData.type === 'notice' ? '공지 내용' : '설명'}
            </Label>
            {formData.type === 'notice' ? (
              <RichTextEditor
                value={formData.description}
                onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                placeholder="공지 내용을 입력하세요. HTML 형식으로 작성할 수 있습니다."
                className="min-h-[300px]"
              />
            ) : (
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="일정에 대한 설명을 입력하세요"
                rows={3}
              />
            )}
            
            {formData.type === 'notice' && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>💡 공지 내용은 모든 대상 사용자에게 표시됩니다. HTML 에디터를 사용하여 더 풍부한 내용을 제공할 수 있습니다.</p>
                <p>📝 <strong>사용 가능한 기능:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>제목 (H1, H2, H3), 굵은 글씨, 기울임, 밑줄, 취소선</li>
                  <li>색상, 배경색, 목록, 정렬</li>
                  <li>링크, 이미지, 코드 블록</li>
                </ul>
              </div>
            )}
          </div>

          {/* 시작 날짜 */}
          <div className="space-y-2">
            <Label>시작 날짜</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.startDate ? format(formData.startDate, "PPP", { locale: ko }) : "날짜를 선택하세요"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.startDate}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, startDate: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* 종료 날짜 (선택사항) */}
          <div className="space-y-2">
            <Label>종료 날짜 (선택사항)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.endDate ? format(formData.endDate, "PPP", { locale: ko }) : "날짜를 선택하세요"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.endDate}
                  onSelect={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {formData.type === 'employee' && (
              <p className="text-xs text-blue-600">
                💡 직원스케줄의 경우 시작날짜부터 종료날짜까지 모든 날짜에 일정이 표시됩니다.
              </p>
            )}
            <p className="text-xs text-gray-500">
              종료날짜를 설정하지 않으면 시작날짜와 동일한 날짜로 설정됩니다.
            </p>
          </div>

          {/* 시간 입력 필드 (직원스케줄과 공지/알림에만 표시) */}
          {(formData.type === 'employee' || formData.type === 'notice') && (
            <>
              {/* 시작 시간 */}
              <div className="space-y-2">
                <Label htmlFor="startTime">시작 시간</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  placeholder="시작 시간을 선택하세요"
                />
                <p className="text-xs text-gray-500">
                  시간을 설정하지 않으면 종일 일정으로 표시됩니다.
                </p>
              </div>

              {/* 종료 시간 */}
              <div className="space-y-2">
                <Label htmlFor="endTime">종료 시간</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  placeholder="종료 시간을 선택하세요"
                />
                <p className="text-xs text-gray-500">
                  종료 시간을 설정하지 않으면 시작 시간과 동일하게 설정됩니다.
                </p>
              </div>
            </>
          )}

          {/* 지점 */}
          <div className="space-y-2">
            <Label htmlFor="branch">
              {formData.type === 'notice' ? '공지 대상' : '지점'}
            </Label>
            <Select
              value={formData.branchName}
              onValueChange={(value) => setFormData(prev => ({ ...prev, branchName: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={formData.type === 'notice' ? "공지 대상을 선택하세요" : "지점을 선택하세요"} />
              </SelectTrigger>
              <SelectContent>
                {/* 본사 관리자만 전체 지점과 본사 공지 선택 가능 */}
                {currentUser?.role === '본사 관리자' && (
                  <>
                    <SelectItem value="전체">
                      📢 전체 지점 (본사 및 모든 지점 공지)
                    </SelectItem>
                    <SelectItem value="separator" disabled className="text-gray-400">
                      ────────────────
                    </SelectItem>
                    <SelectItem value="본사">
                      🏢 본사 (본사만의 공지)
                    </SelectItem>
                    <SelectItem value="separator2" disabled className="text-gray-400">
                      ────────────────
                    </SelectItem>
                  </>
                )}
                {/* 개별 지점 공지 - 본사 관리자는 모든 지점, 지점 사용자는 자신의 지점만 */}
                {branches
                  .filter(branch => branch.type !== '본사')
                  .filter(branch => 
                    currentUser?.role === '본사 관리자' || 
                    branch.name === currentUser?.franchise
                  )
                  .map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      📌 {branch.name} (지점 공지)
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {formData.type === 'notice' && (
              <p className="text-xs text-gray-500">
                {formData.branchName === '전체' 
                  ? '본사 및 모든 지점에서 확인할 수 있는 공지입니다.' 
                  : formData.branchName === '본사'
                  ? '본사에서만 확인할 수 있는 공지입니다.'
                  : `${formData.branchName} 지점에서만 확인할 수 있는 공지입니다.`
                }
              </p>
            )}
          </div>

          {/* 상태 */}
          <div className="space-y-2">
            <Label htmlFor="status">상태</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as CalendarEvent['status'] }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">대기</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="completed">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">완료</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="cancelled">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">취소</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={isEditing && (!canEdit || !!event?.relatedId)}
              title={
                isEditing && event?.relatedId 
                  ? "자동 생성된 이벤트는 수정할 수 없습니다" 
                  : isEditing && !canEdit
                  ? "수정 권한이 없습니다"
                  : ""
              }
            >
              {isEditing ? '수정' : '추가'}
            </Button>
          </DialogFooter>
          
          {/* 권한 안내 메시지 */}
          {isEditing && !canEdit && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {event?.type === 'notice' && (event?.branchName === '전체' || event?.branchName === '본사')
                  ? "본사 관리자가 작성한 공지는 본사 관리자만 수정할 수 있습니다."
                  : event?.relatedId
                  ? "자동 생성된 이벤트는 수정할 수 없습니다."
                  : "이 일정을 수정할 권한이 없습니다."
                }
              </p>
            </div>
          )}
        </form>
        
        {/* 삭제 버튼을 폼 밖으로 분리 */}
        {isEditing && onDelete && canDelete && (
          <div className="mt-4 pt-4 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full cursor-pointer"
                >
                  삭제
                </Button>
              </AlertDialogTrigger>
             <AlertDialogContent>
               <AlertDialogHeader>
                 <AlertDialogTitle>일정 삭제</AlertDialogTitle>
                 <AlertDialogDescription>
                   정말로 이 일정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                 </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                 <AlertDialogCancel>취소</AlertDialogCancel>
                 <AlertDialogAction
                   onClick={async () => {
                     await handleDelete();
                   }}
                   className="bg-destructive hover:bg-destructive/90"
                 >
                   삭제
                 </AlertDialogAction>
               </AlertDialogFooter>
             </AlertDialogContent>
           </AlertDialog>
         </div>
       )}
     </DialogContent>
   </Dialog>
 );
}
