"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, Trash2, Clock, Volume2 } from "lucide-react";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

// Simple notification sound (chime) - removed in favor of TTS
// const NOTIFICATION_SOUND = ...
// const ALERT_SOUND = ...

export function NotificationCenter() {
  const { notifications, markAsRead, markAllAsRead } = useRealtimeNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const lastNotificationIdRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  // Helper to speak text
  const speakMessage = (text: string) => {
    if (!('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Reset

      const utter = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const korVoice = voices.find(v => v.lang.includes('ko') || v.lang.includes('KR'));

        if (korVoice) {
          utterance.voice = korVoice;
        }

        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          utter();
          window.speechSynthesis.onvoiceschanged = null; // Clean up
        };
      } else {
        utter();
      }
    } catch (e) {
      console.error("TTS Error:", e);
    }
  };

  // Play TTS and show toast when new notification arrives
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];

      // 초기 로드 시 가장 최신 알림 ID만 저장하고 알림은 울리지 않음
      if (!isInitializedRef.current) {
        lastNotificationIdRef.current = latest.id;
        isInitializedRef.current = true;
        return;
      }

      // If we have a new notification that is not read
      if (latest.id !== lastNotificationIdRef.current && !latest.isRead) {
        lastNotificationIdRef.current = latest.id;

        // Only for transfer related notifications
        if (latest.type === 'order_transfer' || latest.type === 'order_complete') {

          // 1. TTS (Text-to-Speech) Notification - robust call
          // Wait 300ms to ensure UI is ready or previous audio is cleared
          setTimeout(() => {
            speakMessage(latest.message);
          }, 500);

          // 2. Show Toast (Popup)
          toast({
            title: latest.title,
            description: latest.message,
            duration: 5000,
            action: (
              <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                확인
              </Button>
            ),
          });
        }
      }
    } else {
      // 알림이 하나도 없는 경우 초기화 처리
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
      }
    }
  }, [notifications, toast]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const formatTime = (timestamp: any) => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return '방금 전';
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`;
    return date.toLocaleDateString('ko-KR');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order_transfer':
        return '🔄';
      case 'order_complete':
        return '✅';
      case 'delivery':
        return '🚚';
      default:
        return '📢';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order_transfer':
        return 'bg-blue-100 text-blue-800';
      case 'order_complete':
        return 'bg-green-100 text-green-800';
      case 'delivery':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="relative">
      {/* 알림 버튼 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* 알림 드롭다운 */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  알림
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {unreadCount}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => speakMessage("알림 소리가 정상적으로 설정되었습니다.")}
                    className="text-xs text-muted-foreground hover:text-primary"
                    title="알림 소리 테스트"
                  >
                    <Volume2 className="h-4 w-4 mr-1" />
                    소리 켜기
                  </Button>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      <CheckCheck className="h-3 w-3 mr-1" />
                      모두 읽음
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-80">
                {notifications.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">알림이 없습니다</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.isRead ? 'bg-blue-50' : ''
                          }`}
                        onClick={() => !notification.isRead && markAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-lg">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {notification.title}
                              </p>
                              <Badge className={`text-xs ${getNotificationColor(notification.type)}`}>
                                {notification.type === 'order_transfer' ? '주문이관' :
                                  notification.type === 'order_complete' ? '주문완료' :
                                    notification.type === 'delivery' ? '배송' : '기타'}
                              </Badge>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Clock className="h-3 w-3" />
                                {formatTime(notification.createdAt)}
                              </div>
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notification.id);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 배경 클릭 시 닫기 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
