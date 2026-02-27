
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ClipboardList,
  Eye,
  ShoppingCart,
  CheckCircle,
  Truck,
  Package,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Calendar,
  MapPin,
  Trash2,
  Edit2
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { useMaterials } from '@/hooks/use-materials';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { MaterialRequest, RequestStatus } from '@/types/material-request';
import { REQUEST_STATUS_LABELS, URGENCY_LABELS } from '@/types/material-request';
import { parseDate } from '@/lib/date-utils';
import { RequestDetailDialog } from '@/app/dashboard/purchase-management/components/request-detail-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DeliveryConfirmDialog } from './delivery-confirm-dialog';

interface RequestStatusTrackerProps {
  selectedBranch?: string;
  onEditRequest?: (request: MaterialRequest) => void;
}

export function RequestStatusTracker({ selectedBranch, onEditRequest }: RequestStatusTrackerProps) {
  const { user } = useAuth();
  const { getRequestsByBranch, getRequestsByBranchId, getAllRequests, updateRequestStatus, deleteRequest, loading } = useMaterialRequests();
  const { updateStock } = useMaterials();
  const { deleteExpenseByRequestId } = useSimpleExpenses({ enableRealtime: false });
  const { toast } = useToast();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [detailRequest, setDetailRequest] = useState<MaterialRequest | null>(null);
  const [deliveryConfirmRequest, setDeliveryConfirmRequest] = useState<MaterialRequest | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0); // 새로고침을 위한 키
  const [displayCount, setDisplayCount] = useState(5); // 표시할 요청 수

  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      let fetchedRequests: MaterialRequest[];

      if (user.role === '본사 관리자') {
        if (selectedBranch) {
          // 선택된 지점의 요청만 조회 by Branch ID if possible
          const { data: branchData } = await supabase
            .from('branches')
            .select('id')
            .eq('name', selectedBranch)
            .maybeSingle();

          if (branchData) {
            fetchedRequests = await getRequestsByBranchId(branchData.id);
          } else {
            // Fallback to name if not found (though unusual)
            fetchedRequests = await getRequestsByBranch(selectedBranch);
          }
        } else {
          fetchedRequests = await getAllRequests();
        }
      } else if (user.franchise) {
        // 프랜차이즈 사용자: 자신의 지점 요청만 조회
        const { data: branchData } = await supabase
          .from('branches')
          .select('id')
          .eq('name', user.franchise)
          .maybeSingle();

        if (branchData) {
          fetchedRequests = await getRequestsByBranchId(branchData.id);
        } else {
          fetchedRequests = await getRequestsByBranch(user.franchise);
        }
      } else {
        fetchedRequests = [];
      }

      // 안전한 timestamp 정렬 (Supabase returns ISO strings for createdAt)
      setRequests(fetchedRequests.sort((a, b) => {
        const getTimestamp = (timestamp: any) => {
          const date = parseDate(timestamp);
          return date ? date.getTime() : 0;
        };
        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      }));
      setLastUpdated(new Date());
    } catch (error) {
      console.error('요청 목록 로딩 오류:', error);
    }
  }, [user, getAllRequests, getRequestsByBranch, getRequestsByBranchId, selectedBranch]);
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      if (isMounted) {
        await loadRequests();
        if (isMounted) {
          setDisplayCount(5); // 새로 로드할 때 표시 수 초기화
        }
      }
    };
    loadData();
    return () => {
      isMounted = false;
    };
  }, [loadRequests, refreshKey]); // refreshKey가 변경되면 새로고침
  const getStatusIcon = (status: RequestStatus) => {
    const iconProps = { className: "h-4 w-4" };
    switch (status) {
      case 'submitted':
        return <ClipboardList {...iconProps} />;
      case 'reviewing':
        return <Eye {...iconProps} />;
      case 'purchasing':
        return <ShoppingCart {...iconProps} />;
      case 'purchased':
        return <CheckCircle {...iconProps} />;
      case 'shipping':
        return <Truck {...iconProps} />;
      case 'delivered':
        return <Package {...iconProps} />;
      case 'completed':
        return <CheckCircle {...iconProps} />;
      default:
        return <Clock {...iconProps} />;
    }
  };
  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'submitted':
        return 'blue';
      case 'reviewing':
        return 'yellow';
      case 'purchasing':
        return 'orange';
      case 'purchased':
        return 'green';
      case 'shipping':
        return 'purple';
      case 'delivered':
        return 'indigo';
      case 'completed':
        return 'gray';
      default:
        return 'gray';
    }
  };
  const getStatusProgress = (status: RequestStatus): number => {
    switch (status) {
      case 'submitted': return 10;
      case 'reviewing': return 25;
      case 'purchasing': return 50;
      case 'purchased': return 70;
      case 'shipping': return 85;
      case 'delivered': return 95;
      case 'completed': return 100;
      default: return 0;
    }
  };
  const getEstimatedDeliveryDate = (request: MaterialRequest): string => {
    if (request.delivery?.deliveryDate) {
      return formatDate(request.delivery.deliveryDate);
    }
    const createdDate = getDateFromTimestamp(request.createdAt);
    let estimatedDays = 0;
    switch (request.status) {
      case 'submitted':
      case 'reviewing':
        estimatedDays = 5;
        break;
      case 'purchasing':
        estimatedDays = 3;
        break;
      case 'purchased':
        estimatedDays = 2;
        break;
      case 'shipping':
        estimatedDays = 1;
        break;
      default:
        return '-';
    }
    const estimatedDate = new Date(createdDate);
    estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);
    return estimatedDate.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    }) + ' 예상';
  };
  const compareRequestVsActual = (request: MaterialRequest) => {
    if (!request.actualPurchase) return null;
    const requestedTotal = request.requestedItems.reduce(
      (sum, item) => sum + (item.requestedQuantity * item.estimatedPrice), 0
    );
    const actualTotal = request.actualPurchase.totalCost;
    const difference = actualTotal - requestedTotal;
    const percentDiff = ((difference / requestedTotal) * 100);
    return {
      requestedTotal,
      actualTotal,
      difference,
      percentDiff,
      isHigher: difference > 0,
      isLower: difference < 0
    };
  };
  const urgentRequests = useMemo(() => {
    return requests.filter(request =>
      request.requestedItems.some(item => item.urgency === 'urgent') &&
      !['completed', 'delivered'].includes(request.status)
    );
  }, [requests]);
  const deliveryAlerts = useMemo(() => {
    return requests.filter(request =>
      request.status === 'shipping' ||
      (request.status === 'delivered' && !request.delivery?.deliveryDate)
    );
  }, [requests]);
  // 안전한 Date 변환 유틸리티 함수
  const getDateFromTimestamp = (timestamp: any): Date => {
    return parseDate(timestamp) || new Date();
  };
  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      const date = getDateFromTimestamp(timestamp);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return '-';
    }
  };
  const formatRelativeTime = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      const date = getDateFromTimestamp(timestamp);
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
    } catch (error) {
      console.error('Relative time formatting error:', error);
      return '-';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            요청 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {/* 알림 섹션 */}
      {(urgentRequests.length > 0 || deliveryAlerts.length > 0) && (
        <div className="space-y-2">
          {urgentRequests.length > 0 && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>긴급 요청 {urgentRequests.length}건</strong>이 처리 중입니다.
              </AlertDescription>
            </Alert>
          )}
          {deliveryAlerts.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <Bell className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <strong>배송 중인 요청 {deliveryAlerts.length}건</strong>이 있습니다. 입고 준비를 해주세요.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                요청 현황
              </CardTitle>
              <CardDescription>
                실시간 자재 요청 상태 추적 • 마지막 업데이트: {formatRelativeTime(lastUpdated)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRefreshKey(prev => prev + 1)} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>요청 내역이 없습니다</p>
              <p className="text-sm">자재를 요청하면 여기에 표시됩니다</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.slice(0, displayCount).map((request) => {
                const comparison = compareRequestVsActual(request);
                return (
                  <div key={request.id} className="border rounded-lg">
                    {/* 요청 헤더 */}
                    <div
                      className="p-2.5 sm:p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setDetailRequest(request)}
                    >
                      {/* 1행: 요청번호 + 배지 */}
                      <div className="flex items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div className="shrink-0">{getStatusIcon(request.status)}</div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs sm:text-sm">{request.requestNumber}</p>
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                              {formatRelativeTime(request.createdAt)} • {formatDate(request.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0 flex-wrap justify-end">
                          {/* 배송 예정일 */}
                          {['shipping', 'purchased'].includes(request.status) && (
                            <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1 hidden sm:flex">
                              <Calendar className="h-3 w-3" />
                              {getEstimatedDeliveryDate(request)}
                            </div>
                          )}
                          {/* 비용 비교 표시 */}
                          {comparison && (
                            <div className="flex items-center gap-0.5 text-[10px] sm:text-xs hidden sm:flex">
                              {comparison.isHigher ? (
                                <TrendingUp className="h-3 w-3 text-red-500" />
                              ) : comparison.isLower ? (
                                <TrendingDown className="h-3 w-3 text-green-500" />
                              ) : (
                                <Minus className="h-3 w-3 text-gray-500" />
                              )}
                              <span className={
                                comparison.isHigher ? 'text-red-600' :
                                  comparison.isLower ? 'text-green-600' : 'text-gray-600'
                              }>
                                {comparison.difference > 0 ? '+' : ''}{comparison.difference.toLocaleString()}원
                              </span>
                            </div>
                          )}
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {REQUEST_STATUS_LABELS[request.status]}
                          </Badge>
                          {request.requestedItems.some(item => item.urgency === 'urgent') && (
                            <Badge variant="destructive" className="text-[10px] sm:text-xs">
                              긴급
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* 2행: 액션 버튼들 (줄바꿈 허용) */}
                      <div className="flex items-center gap-1 sm:gap-1.5 mt-2 flex-wrap">
                        {/* 배송 및 입고처리 버튼 - 배송중/도착 상태일 때 표시 */}
                        {(request.status === 'shipping' || request.status === 'delivered') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] sm:text-xs px-2 sm:px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeliveryConfirmRequest(request);
                            }}
                          >
                            <Package className="h-3 w-3 mr-0.5 sm:mr-1" />
                            배송/입고 처리
                          </Button>
                        )}
                        {/* 배송취소 버튼 - 도착 상태일 때 표시 */}
                        {request.status === 'delivered' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[10px] sm:text-xs px-2 sm:px-3 text-red-500 border-red-200 hover:bg-red-50"
                                onClick={(e) => e.stopPropagation()}
                              >
                                배송취소
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>배송 완료를 취소하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  상태가 &quot;배송중&quot;으로 복원됩니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>닫기</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={async () => {
                                    try {
                                      // 1. 상태 복원 (delivered → shipping)
                                      await updateRequestStatus(request.id, 'shipping');
                                      setRefreshKey(prev => prev + 1);
                                      toast({ title: "배송 취소", description: "배송이 취소(배송중으로 복원)되었습니다." });
                                    } catch (error) {
                                      toast({ variant: "destructive", title: "오류", description: "배송 취소 처리 중 오류가 발생했습니다." });
                                    }
                                  }}
                                >
                                  배송 취소
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {/* 수정 버튼 */}
                        {onEditRequest && !['completed', 'delivered'].includes(request.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] sm:text-xs px-2 sm:px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('기존 요청을 취소하고 장바구니로 다시 불러와 수정하시겠습니까?')) {
                                onEditRequest(request);
                              }
                            }}
                          >
                            <Edit2 className="h-3 w-3 mr-0.5 sm:mr-1" />
                            수정
                          </Button>
                        )}
                        {/* 취소 버튼 - 진행 중인 요청만 */}
                        {!['completed', 'delivered'].includes(request.status) && (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-[10px] sm:text-xs px-2 sm:px-3"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('정말 이 자재 요청을 취소하시겠습니까?')) {
                                try {
                                  await deleteRequest(request.id);
                                  setRefreshKey(prev => prev + 1);
                                } catch (error) {
                                  // 오류 처리는 deleteRequest 내부에 toast로 됨
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-0.5 sm:mr-1" />
                            취소
                          </Button>
                        )}

                        <div className="flex-1" />

                        {/* 삭제 (모든 상태) */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 sm:px-2"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`요청번호 ${request.requestNumber}을(를) 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
                              try {
                                await deleteRequest(request.id);
                                setRefreshKey(prev => prev + 1);
                                toast({
                                  title: "삭제 완료",
                                  description: `요청 ${request.requestNumber}이(가) 삭제되었습니다.`
                                });
                              } catch (error) {
                                toast({
                                  variant: "destructive",
                                  title: "삭제 실패",
                                  description: "요청 삭제 중 오류가 발생했습니다."
                                });
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        {/* 상세 보기 */}
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] sm:text-xs px-1.5 sm:px-2">
                          <Eye className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">상세</span>
                        </Button>
                      </div>

                      {/* 진행률 표시 */}
                      <div className="mt-2">
                        <Progress
                          value={getStatusProgress(request.status)}
                          className="h-1"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {requests.length > displayCount && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayCount(prev => prev + 5)}
                  >
                    더 보기 ({requests.length - displayCount}개 더)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RequestDetailDialog
        request={detailRequest}
        open={!!detailRequest}
        onOpenChange={(open) => {
          if (!open) setDetailRequest(null);
        }}
        onDelete={async (id) => {
          try {
            await deleteRequest(id);
            setDetailRequest(null);
            setRefreshKey(prev => prev + 1);
          } catch (e) { /* error handled in deleteRequest */ }
        }}
      />
      <DeliveryConfirmDialog
        request={deliveryConfirmRequest}
        isOpen={!!deliveryConfirmRequest}
        onClose={() => setDeliveryConfirmRequest(null)}
        onSuccess={() => {
          setRefreshKey(prev => prev + 1);
        }}
      />
    </div >
  );
}
