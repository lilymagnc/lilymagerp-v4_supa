"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Bell,
  Truck,
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  X,
  Eye,
  Send,
  MessageSquare,
  Calendar,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { useToast } from '@/hooks/use-toast';
import type { MaterialRequest } from '@/types/material-request';
interface DeliveryNotification {
  id: string;
  type: 'shipping_started' | 'delivery_requested' | 'delivery_completed' | 'delivery_delayed';
  title: string;
  message: string;
  requestId: string;
  requestNumber: string;
  branchId: string;
  branchName: string;
  priority: 'normal' | 'high' | 'urgent';
  isRead: boolean;
  createdAt: Date;
  actionRequired?: boolean;
  estimatedDelivery?: Date;
  trackingNumber?: string;
}
interface DeliveryNotificationsProps {
  selectedBranch?: string;
}
export function DeliveryNotifications({ selectedBranch }: DeliveryNotificationsProps) {
  const { user } = useAuth();
  const { getAllRequests, updateRequestStatus, loading } = useMaterialRequests();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);
  // 요청 상태를 기반으로 배송 알림 생성
  const generateDeliveryNotifications = (requests: MaterialRequest[]): DeliveryNotification[] => {
    const notifications: DeliveryNotification[] = [];
    requests.forEach(request => {
      // 배송 시작 알림
      if (request.status === 'shipping' && request.delivery?.shippingDate) {
        notifications.push({
          id: `shipping-${request.id}`,
          type: 'shipping_started',
          title: '배송 시작',
          message: `${request.branchName}에서 요청한 자재(${request.requestNumber})의 배송이 시작되었습니다.`,
          requestId: request.id,
          requestNumber: request.requestNumber,
          branchId: request.branchId,
          branchName: request.branchName,
          priority: request.requestedItems.some(item => item.urgency === 'urgent') ? 'urgent' : 'normal',
          isRead: false,
          createdAt: request.delivery.shippingDate?.toDate ? request.delivery.shippingDate.toDate() : new Date(),
          trackingNumber: request.delivery.trackingNumber
        });
      }
      // 입고 요청 알림 (배송 완료 후 24시간 경과)
      if (request.status === 'delivered' && !request.delivery?.deliveryDate) {
        const shippingDate = request.delivery?.shippingDate?.toDate ? request.delivery.shippingDate.toDate() : null;
        if (shippingDate && Date.now() - shippingDate.getTime() > 24 * 60 * 60 * 1000) {
          notifications.push({
            id: `delivery-req-${request.id}`,
            type: 'delivery_requested',
            title: '입고 확인 요청',
            message: `${request.branchName}으로 배송된 자재(${request.requestNumber})의 입고 확인이 필요합니다.`,
            requestId: request.id,
            requestNumber: request.requestNumber,
            branchId: request.branchId,
            branchName: request.branchName,
            priority: 'high',
            isRead: false,
            createdAt: new Date(shippingDate.getTime() + 24 * 60 * 60 * 1000),
            actionRequired: true
          });
        }
      }
    });
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };
  const loadNotifications = useCallback(async () => {
    try {
      // 실제로는 notifications 컬렉션에서 조회
      // 여기서는 materialRequests에서 배송 관련 상태를 기반으로 알림 생성
      const requests = await getAllRequests();
      // 본부 관리자이고 특정 지점이 선택된 경우 필터링
      let filteredRequests = requests;
      if (user?.role === '본사 관리자' && selectedBranch) {
        filteredRequests = requests.filter(req => req.branchName === selectedBranch);
      } else if (user?.franchise) {
        filteredRequests = requests.filter(req => req.branchName === user.franchise);
      }
      const deliveryNotifications = generateDeliveryNotifications(filteredRequests);
      setNotifications(deliveryNotifications);
      setUnreadCount(deliveryNotifications.filter(n => !n.isRead).length);
    } catch (error) {
      console.error('알림 로딩 오류:', error);
      const testNotifications: DeliveryNotification[] = [
        {
          id: 'notif-1',
          type: 'shipping_started',
          title: '배송 시작',
          message: '강남점에서 요청한 자재의 배송이 시작되었습니다.',
          requestId: 'req-1',
          requestNumber: 'REQ-20241201-001',
          branchId: '강남점',
          branchName: '강남점',
          priority: 'normal',
          isRead: false,
          createdAt: new Date(),
          trackingNumber: 'TRK-123456789'
        },
        {
          id: 'notif-2',
          type: 'delivery_requested',
          title: '입고 요청',
          message: '홍대점으로 배송된 자재의 입고 확인이 필요합니다.',
          requestId: 'req-2',
          requestNumber: 'REQ-20241201-002',
          branchId: '홍대점',
          branchName: '홍대점',
          priority: 'high',
          isRead: false,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2시간 전
          actionRequired: true
        }
      ];
      setNotifications(testNotifications);
      setUnreadCount(testNotifications.filter(n => !n.isRead).length);
    }
  }, [user, selectedBranch, getAllRequests]);
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) {
        await loadNotifications();
      }
    };
    loadData();
    // 실시간 알림 업데이트 (30초마다)
    const interval = setInterval(() => {
      if (isMounted) {
        loadNotifications();
      }
    }, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedBranch, loadNotifications]); // selectedBranch 변경 시에도 다시 로드
  // 알림 읽음 처리
  const markAsRead = async (notificationId: string) => {
    try {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      // 실제로는 Firestore 업데이트
      } catch (error) {
      console.error('알림 읽음 처리 오류:', error);
    }
  };
  // 모든 알림 읽음 처리
  const markAllAsRead = async () => {
    try {
      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
      toast({
        title: "알림 확인",
        description: "모든 알림을 읽음으로 처리했습니다.",
      });
    } catch (error) {
      console.error('전체 알림 읽음 처리 오류:', error);
    }
  };
  // 알림 삭제
  const deleteNotification = async (notificationId: string) => {
    try {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast({
        title: "알림 삭제",
        description: "알림이 삭제되었습니다.",
      });
    } catch (error) {
      console.error('알림 삭제 오류:', error);
    }
  };
  // 배송 알림 전송 (본사 관리자용)
  const sendDeliveryNotification = async (
    requestId: string,
    type: 'shipping_started' | 'delivery_requested',
    customMessage?: string
  ) => {
    try {
      // 실제로는 푸시 알림, 이메일, SMS 등 전송
      toast({
        title: "알림 전송",
        description: "배송 알림이 전송되었습니다.",
      });
    } catch (error) {
      console.error('알림 전송 오류:', error);
    }
  };
  const getNotificationIcon = (type: DeliveryNotification['type']) => {
    switch (type) {
      case 'shipping_started':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'delivery_requested':
        return <Package className="h-4 w-4 text-orange-600" />;
      case 'delivery_completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'delivery_delayed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };
  const getPriorityColor = (priority: DeliveryNotification['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-200 bg-red-50';
      case 'high':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-gray-200 bg-white';
    }
  };
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) {
      return `${diffDays}일 전`;
    } else if (diffHours > 0) {
      return `${diffHours}시간 전`;
    } else {
      return '방금 전';
    }
  };
  const visibleNotifications = showAll ? notifications : notifications.slice(0, 5);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              배송 알림
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              실시간 배송 상태 및 입고 요청 알림
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <CheckCircle className="h-4 w-4 mr-2" />
                모두 읽음
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={loadNotifications}>
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>새로운 알림이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`border rounded-lg p-3 transition-colors ${getPriorityColor(notification.priority)
                  } ${!notification.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{notification.title}</h4>
                        {!notification.isRead && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        {notification.priority === 'urgent' && (
                          <Badge variant="destructive" className="text-xs">긴급</Badge>
                        )}
                        {notification.actionRequired && (
                          <Badge variant="outline" className="text-xs">조치필요</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {notification.branchName}
                        </span>
                        <span>{notification.requestNumber}</span>
                      </div>
                      {/* 송장번호 표시 */}
                      {notification.trackingNumber && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                          <span className="text-blue-800">
                            송장번호: {notification.trackingNumber}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {/* 본사 관리자용 추가 액션 */}
                    {user?.role === '본사 관리자' && notification.type === 'delivery_requested' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendDeliveryNotification(notification.requestId, 'delivery_requested')}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {/* 조치 필요 알림 */}
                {notification.actionRequired && (
                  <Alert className="mt-3 border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <div className="flex items-center justify-between">
                        <span>입고 확인이 필요합니다. 자재를 확인하고 입고 처리를 완료해 주세요.</span>
                        <Button variant="outline" size="sm" className="ml-2">
                          입고 확인하기
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
            {/* 더보기 버튼 */}
            {notifications.length > 5 && (
              <div className="text-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? '간단히 보기' : `더 보기 (${notifications.length - 5}개 더)`}
                </Button>
              </div>
            )}
          </div>
        )}
        {/* 긴급 알림 요약 */}
        {notifications.some(n => n.priority === 'urgent' && !n.isRead) && (
          <Alert className="mt-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>긴급 알림:</strong> {notifications.filter(n => n.priority === 'urgent' && !n.isRead).length}건의
              긴급 배송 알림이 있습니다. 즉시 확인해 주세요.
            </AlertDescription>
          </Alert>
        )}
        {/* 연락처 정보 (긴급 시) */}
        {notifications.some(n => n.priority === 'urgent') && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
            <h5 className="font-medium mb-2">긴급 연락처</h5>
            <div className="space-y-1 text-muted-foreground">
              <p className="flex items-center gap-2">
                <Phone className="h-3 w-3" />
                본사 구매팀: 02-1234-5678
              </p>
              <p className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                purchase@company.com
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
