"use client";
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarEvent } from '@/hooks/use-calendar';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Bell, Clock, MapPin, Edit } from 'lucide-react';
import { canEditCalendarEvent, type User } from '@/lib/calendar-permissions';

interface NoticeViewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  onEdit?: () => void;
  currentUser?: User;
}

export function NoticeViewDialog({
  isOpen,
  onOpenChange,
  event,
  onEdit,
  currentUser
}: NoticeViewDialogProps) {
  if (!event || event.type !== 'notice') return null;

  // 권한 확인 로직
  const canEdit = React.useMemo(() => {
    return canEditCalendarEvent(currentUser || null, event);
  }, [currentUser, event]);

  // HTML 내용을 안전하게 렌더링하는 함수
  const renderHtmlContent = (htmlContent: string) => {
    if (!htmlContent) return '';
    
    // 기본적인 HTML 태그는 그대로 사용 (Quill 에디터에서 생성된 안전한 HTML)
    return htmlContent;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-500" />
            공지사항
            <Badge variant="outline" className="ml-2">
              {event.branchName === '전체' ? '📢 전체공지' : 
               event.branchName === '본사' ? '🏢 본사공지' : 
               `📌 ${event.branchName}`}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            공지사항의 상세 내용을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 제목 */}
          <div className="border-b pb-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {format(new Date(event.startDate), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.branchName}
              </div>
            </div>
          </div>

          {/* 내용 */}
          {event.description && (
            <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-400">
                             <div 
                 className="notice-content prose prose-lg max-w-none"
                 dangerouslySetInnerHTML={{ 
                   __html: renderHtmlContent(event.description)
                 }}
               />
            </div>
          )}

          {/* 상태 및 버튼 */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">상태:</span>
              <Badge 
                variant={event.status === 'completed' ? 'default' : 'secondary'}
                className={event.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
              >
                {event.status === 'completed' ? '완료' : '대기'}
              </Badge>
            </div>
            
            <div className="flex gap-2">
              {onEdit && canEdit && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onEdit}
                  className="flex items-center gap-1"
                >
                  <Edit className="w-4 h-4" />
                  수정
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>

        {/* HTML 렌더링을 위한 스타일 */}
        <style jsx global>{`
          .notice-content {
            color: #1f2937;
            line-height: 1.7;
            word-break: break-word;
          }
          
          .notice-content h1 {
            font-size: 1.8em;
            font-weight: bold;
            margin: 1.2em 0 0.6em 0;
            color: #111827;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 0.3em;
          }
          
          .notice-content h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 1em 0 0.5em 0;
            color: #111827;
          }
          
          .notice-content h3 {
            font-size: 1.3em;
            font-weight: bold;
            margin: 0.8em 0 0.4em 0;
            color: #111827;
          }
          
          .notice-content p {
            margin: 0.8em 0;
            line-height: 1.7;
          }
          
          .notice-content ul {
            margin: 0.8em 0;
            padding-left: 1.8em;
            line-height: 1.7;
          }
          
          .notice-content ol {
            margin: 0.8em 0;
            padding-left: 1.8em;
            line-height: 1.7;
          }
          
          .notice-content li {
            margin: 0.4em 0;
          }
          
          .notice-content strong {
            font-weight: bold;
            color: #111827;
          }
          
          .notice-content em {
            font-style: italic;
          }
          
          .notice-content u {
            text-decoration: underline;
          }
          
          .notice-content a {
            color: #2563eb;
            text-decoration: underline;
            transition: color 0.2s;
          }
          
          .notice-content a:hover {
            color: #1d4ed8;
            text-decoration: none;
          }
          
          .notice-content img {
            max-width: 100%;
            height: auto;
            margin: 1em 0;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .notice-content hr {
            border: none;
            border-top: 2px solid #e5e7eb;
            margin: 1.5em 0;
          }
          
          .notice-content blockquote {
            border-left: 4px solid #3b82f6;
            margin: 1em 0;
            padding-left: 1em;
            font-style: italic;
            color: #6b7280;
          }
          
          .notice-content code {
            background-color: #f3f4f6;
            padding: 0.2em 0.4em;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          
          .notice-content pre {
            background-color: #f3f4f6;
            padding: 1em;
            border-radius: 8px;
            overflow-x: auto;
            margin: 1em 0;
          }
          
          .notice-content pre code {
            background: none;
            padding: 0;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
