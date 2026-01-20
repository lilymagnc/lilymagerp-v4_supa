"use client";
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/hooks/use-calendar';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Clock, MapPin, User, Package, Bell, CreditCard, Users, Truck, Calendar } from 'lucide-react';
import { isHoliday, holidayColors } from '@/lib/holidays';

interface DayEventsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onNoticeClick?: (event: CalendarEvent) => void;
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'delivery':
      return <Truck className="w-4 h-4" />;
    case 'material':
      return <Package className="w-4 h-4" />;
    case 'employee':
      return <Users className="w-4 h-4" />;
    case 'notice':
      return <Bell className="w-4 h-4" />;
    case 'payment':
      return <CreditCard className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">대기</Badge>;
    case 'completed':
      return <Badge variant="default" className="bg-green-100 text-green-800">완료</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">취소</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

function DayEventsDialogComponent({
  isOpen,
  onOpenChange,
  date,
  events,
  onEventClick,
  onNoticeClick
}: DayEventsDialogProps) {
  if (!date) return null;

  const holiday = isHoliday(date);

  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      // 완료된 이벤트는 뒤로
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      
      // 시간순 정렬 (시간이 있는 경우)
      const timeA = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
      const timeB = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
      return timeA - timeB;
    });
  }, [events]);

  const pendingEvents = React.useMemo(() => 
    sortedEvents.filter(event => event.status === 'pending'), 
    [sortedEvents]
  );
  
  const completedEvents = React.useMemo(() => 
    sortedEvents.filter(event => event.status === 'completed'), 
    [sortedEvents]
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {format(date, 'yyyy년 M월 d일 (EEE)', { locale: ko })} 일정
            <Badge variant="outline" className="ml-2">
              총 {events.length}건
            </Badge>
          </DialogTitle>
          <DialogDescription>
            해당 날짜의 모든 일정을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 공휴일 정보 */}
          {holiday && (
            <div className="p-4 border rounded-lg bg-gradient-to-r from-yellow-50 to-orange-50">
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${holidayColors[holiday.type]}`}></div>
                <div>
                  <h3 className="font-semibold text-lg text-orange-800">
                    🎉 {holiday.name}
                  </h3>
                  {holiday.description && (
                    <p className="text-sm text-orange-600">{holiday.description}</p>
                  )}
                  <p className="text-xs text-orange-500 mt-1">
                    {holiday.type === 'fixed' ? '고정 공휴일' : 
                     holiday.type === 'lunar' ? '음력 공휴일' : '대체공휴일'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 대기 중인 일정 */}
          {pendingEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">대기</Badge>
                대기 중인 일정 ({pendingEvents.length}건)
              </h3>
              <div className="space-y-3">
                {pendingEvents.map((event) => (
                                     <div
                     key={event.id}
                     className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                     onClick={() => {
                       if (event.type === 'notice' && onNoticeClick) {
                         onNoticeClick(event);
                       } else {
                         onEventClick(event);
                       }
                     }}
                   >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-3 h-3 rounded-full mt-1 ${event.color}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getEventIcon(event.type)}
                            <h4 className="font-medium">{event.title}</h4>
                            {event.type === 'notice' && (
                              <span className="text-xs text-gray-500">
                                {event.branchName === '본사' ? '📢 전체공지' : `📌 ${event.branchName}`}
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <div className={`mb-2 ${event.type === 'notice' ? 'bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400' : ''}`}>
                              <p className={`${event.type === 'notice' ? 'text-sm text-blue-800 leading-relaxed' : 'text-sm text-gray-600'}`}>
                                {event.description}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(event.startDate), 'HH:mm')}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.branchName}
                            </div>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(event.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 완료된 일정 */}
          {completedEvents.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="default" className="bg-green-100 text-green-800">완료</Badge>
                완료된 일정 ({completedEvents.length}건)
              </h3>
              <div className="space-y-3">
                {completedEvents.map((event) => (
                                     <div
                     key={event.id}
                     className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                     onClick={() => {
                       if (event.type === 'notice' && onNoticeClick) {
                         onNoticeClick(event);
                       } else {
                         onEventClick(event);
                       }
                     }}
                   >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`w-3 h-3 rounded-full mt-1 ${event.color}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getEventIcon(event.type)}
                            <h4 className="font-medium text-gray-700">{event.title}</h4>
                            {event.type === 'notice' && (
                              <span className="text-xs text-gray-500">
                                {event.branchName === '본사' ? '📢 전체공지' : `📌 ${event.branchName}`}
                              </span>
                            )}
                          </div>
                          {event.description && (
                            <div className={`mb-2 ${event.type === 'notice' ? 'bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400' : ''}`}>
                              <p className={`${event.type === 'notice' ? 'text-sm text-blue-800 leading-relaxed' : 'text-sm text-gray-600'}`}>
                                {event.description}
                              </p>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(event.startDate), 'HH:mm')}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.branchName}
                            </div>
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(event.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 일정이 없는 경우 */}
          {events.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>이 날짜에는 일정이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const DayEventsDialog = React.memo(DayEventsDialogComponent);