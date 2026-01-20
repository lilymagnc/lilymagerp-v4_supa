
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
  MapPin
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { useToast } from '@/hooks/use-toast';
import type { MaterialRequest, RequestStatus } from '@/types/material-request';
import { REQUEST_STATUS_LABELS, URGENCY_LABELS } from '@/types/material-request';
interface RequestStatusTrackerProps {
  selectedBranch?: string;
}
export function RequestStatusTracker({ selectedBranch }: RequestStatusTrackerProps) {
  const { user } = useAuth();
  const { getRequestsByBranch, getRequestsByBranchId, getAllRequests, updateRequestStatus, loading } = useMaterialRequests();
  const { toast } = useToast();
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0); // 새로고침을 위한 키
  const [displayCount, setDisplayCount] = useState(5); // 표시할 요청 수
  // 컴포넌트를 외부에서 제어할 수 있도록 ref로 노출
  React.useImperativeHandle(React.useRef(), () => ({
    refresh: () => setRefreshKey(prev => prev + 1)
  }));
  const loadRequests = useCallback(async () => {
    if (!user) return;
    try {
      let fetchedRequests: MaterialRequest[];
      if (user.role === '본사 관리자') {
        if (selectedBranch) {
          // 선택된 지점의 요청만 조회
          try {
            const { getDocs, collection, query, where } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const branchesQuery = query(
              collection(db, 'branches'),
              where('name', '==', selectedBranch)
            );
            const branchesSnapshot = await getDocs(branchesQuery);
            if (!branchesSnapshot.empty) {
              const branchId = branchesSnapshot.docs[0].id;
              fetchedRequests = await getRequestsByBranchId(branchId);
            } else {
              fetchedRequests = await getRequestsByBranch(selectedBranch);
            }
          } catch (error) {
            console.error('branchId 조회 실패, branchName으로 대체:', error);
            fetchedRequests = await getRequestsByBranch(selectedBranch);
          }
        } else {
          fetchedRequests = await getAllRequests();
        }
      } else if (user.franchise) {
        // branchId로 직접 쿼리 (기존 인덱스 활용)
        try {
          // 먼저 지점 정보를 가져와서 branchId를 찾습니다
          const { getDocs, collection, query, where } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const branchesQuery = query(
            collection(db, 'branches'),
            where('name', '==', user.franchise)
          );
          const branchesSnapshot = await getDocs(branchesQuery);
          if (!branchesSnapshot.empty) {
            const branchId = branchesSnapshot.docs[0].id;
            fetchedRequests = await getRequestsByBranchId(branchId);
          } else {
            fetchedRequests = await getRequestsByBranch(user.franchise);
          }
        } catch (error) {
          console.error('branchId 조회 실패, branchName으로 대체:', error);
          fetchedRequests = await getRequestsByBranch(user.franchise);
        }
      } else {
        fetchedRequests = [];
      }
      // 안전한 timestamp 정렬
      setRequests(fetchedRequests.sort((a, b) => {
        const getTimestamp = (timestamp: any) => {
          if (!timestamp) return 0;
          if (timestamp.toMillis) return timestamp.toMillis();
          if (timestamp.seconds) return timestamp.seconds * 1000;
          if (timestamp instanceof Date) return timestamp.getTime();
          return new Date(timestamp).getTime();
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
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    if (timestamp instanceof Date) return timestamp;
    return new Date(timestamp);
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
  const toggleRequestExpansion = (requestId: string) => {
    setExpandedRequest(expandedRequest === requestId ? null : requestId);
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
                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleRequestExpansion(request.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(request.status)}
                          <div>
                            <p className="font-medium text-sm">{request.requestNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(request.createdAt)} • {formatDate(request.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* 배송 예정일 */}
                          {['shipping', 'purchased'].includes(request.status) && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {getEstimatedDeliveryDate(request)}
                            </div>
                          )}
                          {/* 비용 비교 표시 */}
                          {comparison && (
                            <div className="flex items-center gap-1 text-xs">
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
                          <Badge variant="outline" className="text-xs">
                            {REQUEST_STATUS_LABELS[request.status]}
                          </Badge>
                          {request.requestedItems.some(item => item.urgency === 'urgent') && (
                            <Badge variant="destructive" className="text-xs">
                              긴급
                            </Badge>
                          )}
                          {/* 배송완료 버튼 - 배송중 상태일 때 표시 */}
                          {request.status === 'shipping' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateRequestStatus(request.id, 'delivered');
                                  setRefreshKey(prev => prev + 1);
                                  toast({
                                    title: "배송 완료",
                                    description: "배송이 완료 처리되었습니다."
                                  });
                                } catch (error) {
                                  toast({
                                    variant: "destructive",
                                    title: "오류",
                                    description: "배송 완료 처리 중 오류가 발생했습니다."
                                  });
                                }
                              }}
                            >
                              <Truck className="h-3 w-3 mr-1" />
                              배송완료
                            </Button>
                          )}
                          {/* 입고완료 버튼 - 배송완료 상태일 때 표시 */}
                          {request.status === 'delivered' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateRequestStatus(request.id, 'completed');
                                  setRefreshKey(prev => prev + 1);
                                  toast({
                                    title: "입고 완료",
                                    description: "자재 입고가 완료 처리되었습니다."
                                  });
                                } catch (error) {
                                  toast({
                                    variant: "destructive",
                                    title: "오류",
                                    description: "입고 완료 처리 중 오류가 발생했습니다."
                                  });
                                }
                              }}
                            >
                              <Package className="h-3 w-3 mr-1" />
                              입고완료
                            </Button>
                          )}
                          {/* 완료 버튼 - 요청됨 상태일 때 표시 (기존) */}
                          {request.status === 'submitted' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await updateRequestStatus(request.id, 'completed');
                                  setRefreshKey(prev => prev + 1);
                                  toast({
                                    title: "요청 완료",
                                    description: "자재 요청이 완료 처리되었습니다."
                                  });
                                } catch (error) {
                                  toast({
                                    variant: "destructive",
                                    title: "오류",
                                    description: "완료 처리 중 오류가 발생했습니다."
                                  });
                                }
                              }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              완료
                            </Button>
                          )}
                          {expandedRequest === request.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                      {/* 진행률 표시 */}
                      <div className="mt-2">
                        <Progress 
                          value={getStatusProgress(request.status)} 
                          className="h-1"
                        />
                      </div>
                    </div>
                    {/* 요청 상세 정보 */}
                    {expandedRequest === request.id && (
                      <div className="border-t bg-muted/20">
                        <div className="p-3 space-y-4">
                          {/* 요청 vs 실제 비교 */}
                          {comparison && (
                            <div className="bg-white rounded-lg p-3 border">
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Info className="h-4 w-4" />
                                요청 vs 실제 비교
                              </h4>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">요청 금액</p>
                                  <p className="font-medium">{comparison.requestedTotal.toLocaleString()}원</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">실제 금액</p>
                                  <p className="font-medium">{comparison.actualTotal.toLocaleString()}원</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">차이</p>
                                  <p className={`font-medium flex items-center gap-1 ${
                                    comparison.isHigher ? 'text-red-600' : 
                                    comparison.isLower ? 'text-green-600' : 'text-gray-600'
                                  }`}>
                                    {comparison.isHigher ? (
                                      <TrendingUp className="h-3 w-3" />
                                    ) : comparison.isLower ? (
                                      <TrendingDown className="h-3 w-3" />
                                    ) : (
                                      <Minus className="h-3 w-3" />
                                    )}
                                    {comparison.difference > 0 ? '+' : ''}{comparison.difference.toLocaleString()}원
                                    <span className="text-xs text-muted-foreground">
                                      ({comparison.percentDiff > 0 ? '+' : ''}{comparison.percentDiff.toFixed(1)}%)
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                          {/* 요청 품목 */}
                          <div>
                            <h4 className="text-sm font-medium mb-2">요청 품목</h4>
                            <div className="space-y-2">
                              {request.requestedItems.map((item, index) => (
                                <div key={index} className="flex justify-between items-center text-sm bg-white rounded p-2">
                                  <div className="flex items-center gap-2">
                                    <span>{item.materialName}</span>
                                    {item.urgency === 'urgent' && (
                                      <Badge variant="destructive" className="text-xs">
                                        긴급
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p>{item.requestedQuantity}개</p>
                                    <p className="text-xs text-muted-foreground">
                                      {(item.requestedQuantity * item.estimatedPrice).toLocaleString()}원
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 실제 구매 정보 (구매 완료 후) */}
                          {request.actualPurchase && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">실제 구매 정보</h4>
                              <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-muted-foreground">구매일</p>
                                    <p>{formatDate(request.actualPurchase.purchaseDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">구매자</p>
                                    <p>{request.actualPurchase.purchaserName}</p>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">실제 비용</p>
                                  <p className="font-medium text-lg">{request.actualPurchase.totalCost.toLocaleString()}원</p>
                                </div>
                                {request.actualPurchase.notes && (
                                  <div>
                                    <p className="text-muted-foreground">메모</p>
                                    <p className="text-sm bg-muted/50 rounded p-2">{request.actualPurchase.notes}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 배송 추적 정보 */}
                          {request.delivery && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                배송 추적
                              </h4>
                              <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-muted-foreground">배송 시작</p>
                                    <p>{formatDate(request.delivery.shippingDate)}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">배송 방법</p>
                                    <p>{request.delivery.deliveryMethod}</p>
                                  </div>
                                </div>
                                {request.delivery.trackingNumber && (
                                  <div>
                                    <p className="text-muted-foreground">송장번호</p>
                                    <p className="font-mono text-sm bg-muted/50 rounded p-2">
                                      {request.delivery.trackingNumber}
                                    </p>
                                  </div>
                                )}
                                {request.delivery.deliveryDate ? (
                                  <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>배송 완료: {formatDate(request.delivery.deliveryDate)}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 text-blue-600">
                                    <MapPin className="h-4 w-4" />
                                    <span>예상 도착: {getEstimatedDeliveryDate(request)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* 입고 예정 알림 */}
                          {request.status === 'shipping' && (
                            <Alert className="border-blue-200 bg-blue-50">
                              <Bell className="h-4 w-4 text-blue-600" />
                              <AlertDescription className="text-blue-800">
                                <strong>입고 준비 알림:</strong> 곧 자재가 도착할 예정입니다. 입고 공간을 준비해 주세요.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                    )}
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
    </div>
  );
}
