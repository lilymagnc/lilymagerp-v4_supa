"use client";
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PurchaseRequestDashboard } from './components/purchase-request-dashboard';
import { PurchaseBatchList } from './components/purchase-batch-list';
import { MaterialPivotTable } from './components/material-pivot-table';
import { RequestDetailDialog } from './components/request-detail-dialog';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { useMaterials } from '@/hooks/use-materials';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import type { MaterialRequest, RequestStatus, UrgencyLevel } from '@/types/material-request';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

import { Trash2, Eye } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
export default function PurchaseManagementPage() {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | 'all'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [deliveryTabKey, setDeliveryTabKey] = useState(0); // 새로운 key state
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequest | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const { getAllRequests, updateRequestStatus, deleteRequest } = useMaterialRequests();
  const { updateStock } = useMaterials();
  const { addMaterialRequestExpense, deleteExpenseByRequestId } = useSimpleExpenses({ enableRealtime: false });
  const { user } = useAuth();
  const { toast } = useToast();
  // 요청 목록 로드
  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const allRequests = await getAllRequests();
      setRequests(allRequests);
      setFilteredRequests(allRequests);
    } catch (error) {
      console.error('요청 목록 로드 오류:', error);
      // 여기에 사용자에게 오류를 알리는 토스트 메시지 등을 추가할 수 있습니다.
    } finally {
      setLoading(false);
    }
  }, [getAllRequests]); // getAllRequests가 변경될 때마다 실행
  useEffect(() => {
    loadRequests();
  }, [loadRequests]); // loadRequests가 변경될 때마다 실행
  // 필터링 로직
  useEffect(() => {
    let filtered = requests;
    // 입고완료된 요청은 구매관리에서 제외 (취합뷰에서 보이지 않음)
    filtered = filtered.filter(request => request.status !== 'completed');
    // 검색어 필터
    if (searchTerm) {
      filtered = filtered.filter(request =>
        request.requestNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.requesterName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }
    // 긴급도 필터
    if (urgencyFilter !== 'all') {
      filtered = filtered.filter(request =>
        request.requestedItems.some(item => item.urgency === urgencyFilter)
      );
    }
    // 지점 필터
    if (branchFilter !== 'all') {
      filtered = filtered.filter(request => request.branchId === branchFilter);
    }
    setFilteredRequests(filtered);
  }, [requests, searchTerm, statusFilter, urgencyFilter, branchFilter]);
  // 배송 완료 처리
  const handleDeliveryComplete = async (requestId: string) => {
    try {
      // 현재 요청 정보를 가져와서 기존 배송 정보를 유지
      const currentRequest = requests.find(r => r.id === requestId);
      if (!currentRequest) {
        throw new Error('요청을 찾을 수 없습니다.');
      }
      const existingDelivery = currentRequest?.delivery;
      const deliveryData: any = {
        shippingDate: existingDelivery?.shippingDate || new Date().toISOString(),
        deliveryDate: new Date().toISOString(),
        deliveryMethod: existingDelivery?.deliveryMethod || '직접배송',
        deliveryStatus: 'delivered',
      };
      // trackingNumber가 존재할 때만 추가
      if (existingDelivery?.trackingNumber) {
        deliveryData.trackingNumber = existingDelivery.trackingNumber;
      }
      // 1. 배송 상태 업데이트 (순수 상태 업데이트용, 실제 재고/지출 등록은 지점에서 수행)
      await updateRequestStatus(requestId, 'delivered', {
        delivery: deliveryData,
      });

      toast({
        title: "배송 상태 업데이트",
        description: "상태가 배송 완료(도착)로 변경되었습니다. (실제 입고는 지점에서 진행합니다)",
      });
      loadRequests();
      setDeliveryTabKey(prev => prev + 1);
    } catch (error) {
      console.error('배송 완료 처리 오류:', error);
      toast({
        variant: 'destructive',
        title: "오류",
        description: "배송 완료 처리 중 오류가 발생했습니다.",
      });
    }
  };

  // 배송 완료 취소 (롤백: 상태 복원 + 재고 차감 + 지출 삭제)
  const handleDeliveryCancel = async (requestId: string) => {
    try {
      const currentRequest = requests.find(r => r.id === requestId);
      if (!currentRequest) {
        throw new Error('요청을 찾을 수 없습니다.');
      }

      // 1. 상태를 purchased로 복원
      await updateRequestStatus(requestId, 'purchased', {
        delivery: {
          ...currentRequest.delivery,
          deliveryDate: null,
          deliveryStatus: 'preparing' as any,
        },
      });

      toast({
        title: "배송 완료 취소",
        description: "상태가 구매완료(배송 준비)로 취소되었습니다.",
      });
      loadRequests();
      setDeliveryTabKey(prev => prev + 1);
    } catch (error) {
      console.error('배송 완료 취소 오류:', error);
      toast({
        variant: 'destructive',
        title: "오류",
        description: "배송 완료 취소 중 오류가 발생했습니다.",
      });
    }
  };
  // 배송 시작 처리
  const handleStartDelivery = async (requestId: string) => {
    try {
      const deliveryData: any = {
        shippingDate: new Date().toISOString(),
        deliveryMethod: '직접배송',
        deliveryStatus: 'shipped'
      };
      await updateRequestStatus(requestId, 'shipping', {
        delivery: deliveryData
      });
      toast({
        title: "배송 시작 처리",
        description: "요청의 배송이 시작되었습니다.",
      });
      await loadRequests(); // 목록 새로고침
      setDeliveryTabKey(prev => prev + 1); // 탭 강제 새로고침
    } catch (error) {
      console.error('배송 시작 처리 오류:', error);
      toast({
        variant: 'destructive',
        title: "오류",
        description: "배송 시작 처리 중 오류가 발생했습니다.",
      });
    }
  };
  // 요청 삭제 처리
  const handleDeleteRequest = async (requestId: string) => {
    try {
      await deleteRequest(requestId);
      toast({
        title: "요청 삭제 완료",
        description: "요청이 성공적으로 삭제되었습니다.",
      });
      await loadRequests(); // 목록 새로고침
    } catch (error) {
      console.error('요청 삭제 오류:', error);
      toast({
        variant: 'destructive',
        title: "오류",
        description: "요청 삭제 중 오류가 발생했습니다.",
      });
    }
  };
  // 요청 상세 보기
  const handleViewRequestDetail = (request: MaterialRequest) => {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  };
  // 고유 지점 목록 추출
  const uniqueBranches = Array.from(
    new Map(requests.map(request => [request.branchId, { id: request.branchId, name: request.branchName }])).values()
  );
  // 통계 계산 (입고완료 제외)
  const activeRequests = requests.filter(r => r.status !== 'completed');
  const stats = {
    total: activeRequests.length,
    pending: activeRequests.filter(r => r.status === 'submitted').length,
    processing: activeRequests.filter(r => ['purchased', 'shipping'].includes(r.status)).length,
    delivered: activeRequests.filter(r => r.status === 'delivered').length,
    urgent: activeRequests.filter(r => r.requestedItems.some(item => item.urgency === 'urgent')).length
  };
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">로딩 중...</div>
        </div>
      </div>
    );
  }
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">구매 관리</h1>
          <p className="text-muted-foreground">
            지점 자재 요청을 취합하고 구매를 관리합니다
          </p>
        </div>
      </div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 요청</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">요청됨</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">처리 중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">배송완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">긴급 요청</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
          </CardContent>
        </Card>
      </div>
      {/* 필터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>필터 및 검색</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="요청번호, 지점명, 요청자 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as RequestStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="상태 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="submitted">요청됨</SelectItem>
                <SelectItem value="purchased">구매완료</SelectItem>
                <SelectItem value="shipping">배송중</SelectItem>
                <SelectItem value="delivered">배송완료</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={(value) => setUrgencyFilter(value as UrgencyLevel | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder="긴급도 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 긴급도</SelectItem>
                <SelectItem value="normal">일반</SelectItem>
                <SelectItem value="urgent">긴급</SelectItem>
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger>
                <SelectValue placeholder="지점 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 지점</SelectItem>
                {uniqueBranches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setUrgencyFilter('all');
                setBranchFilter('all');
              }}
            >
              필터 초기화
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* 메인 대시보드 */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="w-full h-auto p-1 bg-muted/50 grid grid-cols-2 md:grid-cols-5 gap-2">
          <TabsTrigger value="dashboard" className="flex flex-col items-center py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm">
            <span className="text-[10px] md:text-xs opacity-80 mb-1">STEP 1</span>
            <span className="font-bold text-sm md:text-base">요청 취합</span>
          </TabsTrigger>
          <TabsTrigger value="pivot" className="flex flex-col items-center py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm">
            <span className="text-[10px] md:text-xs opacity-80 mb-1">STEP 2</span>
            <span className="font-bold text-sm md:text-base">전체 품목 뷰</span>
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex flex-col items-center py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm">
            <span className="text-[10px] md:text-xs opacity-80 mb-1">STEP 3</span>
            <span className="font-bold text-sm md:text-base">추가/실제 구매</span>
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex flex-col items-center py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm">
            <span className="text-[10px] md:text-xs opacity-80 mb-1">STEP 4</span>
            <span className="font-bold text-sm md:text-base">배송시작/이동</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex flex-col items-center py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md shadow-sm col-span-2 md:col-span-1">
            <span className="text-[10px] md:text-xs opacity-80 mb-1">조회</span>
            <span className="font-bold text-sm md:text-base">전체 목록</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <PurchaseRequestDashboard
            requests={filteredRequests}
            onRefresh={loadRequests}
          />
        </TabsContent>
        <TabsContent value="pivot">
          <MaterialPivotTable
            requests={filteredRequests}
            onPurchaseStart={async (requestIds) => {
              try {
                for (const id of requestIds) {
                  await updateRequestStatus(id, 'purchasing');
                }
                toast({
                  title: "구매 진행",
                  description: `${requestIds.length}건의 요청이 구매 진행 상태로 변경되었습니다.`,
                });
                await loadRequests();
              } catch (error) {
                console.error('구매 진행 처리 오류:', error);
                toast({
                  variant: 'destructive',
                  title: "오류",
                  description: "구매 진행 처리 중 오류가 발생했습니다.",
                });
              }
            }}
          />
        </TabsContent>
        <TabsContent value="batches">
          <PurchaseBatchList
            onRefresh={loadRequests}
          />
        </TabsContent>
        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>배송 관리</CardTitle>
              <CardDescription>
                구매 완료된 자재의 배송을 관리합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRequests
                  .filter(request => ['purchased', 'shipping', 'delivered'].includes(request.status))
                  .map(request => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">{request.requestNumber}</h3>
                          <p className="text-sm text-muted-foreground">
                            {request.branchName} • {request.requesterName}
                          </p>
                        </div>
                        <Badge variant={
                          request.status === 'purchased' ? 'secondary' :
                            request.status === 'shipping' ? 'default' :
                              request.status === 'delivered' ? 'outline' : 'secondary'
                        }>
                          {request.status === 'purchased' && '배송 대기'}
                          {request.status === 'shipping' && '배송 중'}
                          {request.status === 'delivered' && '배송 완료'}
                        </Badge>
                      </div>
                      {/* 배송 관리 컴포넌트 통합 */}
                      <div className="bg-muted/20 rounded-lg p-3">
                        {request.status === 'purchased' && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">배송 시작 가능</p>
                            <p className="text-xs text-muted-foreground">
                              구매가 완료되어 배송을 시작할 수 있습니다.
                            </p>
                            <Button size="lg" className="w-full mt-4 text-base py-6 shadow-md" onClick={() => handleStartDelivery(request.id)}>
                              배송 출발 (이동 시작)
                            </Button>
                          </div>
                        )}
                        {request.status === 'shipping' && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">배송 중</p>
                            <p className="text-xs text-muted-foreground">
                              배송이 진행 중입니다. 지점에서 입고 확인을 기다리고 있습니다.
                            </p>
                            {request.delivery?.trackingNumber && (
                              <p className="text-xs font-mono bg-white rounded px-2 py-1">
                                송장: {request.delivery.trackingNumber}
                              </p>
                            )}
                            {request.delivery?.shippingDate && (
                              <p className="text-xs text-muted-foreground">
                                배송 시작: {new Date(request.delivery.shippingDate).toLocaleDateString()}
                              </p>
                            )}
                            <Button
                              size="lg"
                              className="w-full mt-4 text-base py-6 shadow-md"
                              onClick={() => handleDeliveryComplete(request.id)}
                            >
                              배송 완료 (지점 도착)
                            </Button>
                          </div>
                        )}
                        {request.status === 'delivered' && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-green-600">배송 완료</p>
                            <p className="text-xs text-muted-foreground">
                              배송이 완료되었습니다. 지점에서 품목/가격 확인 후 입고처리를 진행합니다.
                            </p>
                            {request.delivery?.deliveryDate && (
                              <p className="text-xs text-muted-foreground">
                                배송 완료: {new Date(request.delivery.deliveryDate).toLocaleDateString()}
                              </p>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="lg" variant="outline" className="w-full mt-4 text-base py-6 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 shadow-sm">
                                  배송 완료 취소 (뒤로가기)
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>배송 완료를 취소하시겠습니까?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    상태가 &quot;구매완료&quot;로 복원됩니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => handleDeliveryCancel(request.id)}
                                  >
                                    배송 완료 취소
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 text-sm text-muted-foreground">
                        요청 품목: {request.requestedItems.length}개 •
                        예상 비용: ₩{request.requestedItems.reduce((sum, item) =>
                          sum + (item.requestedQuantity * item.estimatedPrice), 0
                        ).toLocaleString()}
                      </div>
                    </div>
                  ))}
                {filteredRequests.filter(request =>
                  ['purchased', 'shipping', 'delivered'].includes(request.status)
                ).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      배송 관리할 요청이 없습니다.
                    </div>
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>요청 목록 ({filteredRequests.length}건)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRequests.map(request => (
                  <div key={request.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => handleViewRequestDetail(request)}
                      >
                        <h3 className="font-semibold hover:text-primary">{request.requestNumber}</h3>
                        <p className="text-sm text-muted-foreground">
                          {request.branchName} • {request.requesterName}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                          {request.status === 'submitted' && '제출됨'}
                          {request.status === 'reviewing' && '검토중'}
                          {request.status === 'purchasing' && '구매중'}
                          {request.status === 'purchased' && '구매완료'}
                          {request.status === 'shipping' && '배송중'}
                          {request.status === 'delivered' && '배송완료'}
                          {request.status === 'completed' && '완료'}
                        </Badge>
                        {request.requestedItems.some(item => item.urgency === 'urgent') && (
                          <Badge variant="destructive">긴급</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      요청 품목: {request.requestedItems.length}개 •
                      예상 비용: ₩{request.requestedItems.reduce((sum, item) =>
                        sum + (item.requestedQuantity * item.estimatedPrice), 0
                      ).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      요청일: {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Eye className="h-4 w-4" />
                        클릭하여 상세보기
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>요청 삭제</AlertDialogTitle>
                            <AlertDialogDescription>
                              정말로 이 요청을 삭제하시겠습니까?
                              <br />
                              <strong>{request.requestNumber}</strong> - {request.branchName}
                              <br />
                              이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRequest(request.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {filteredRequests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    조건에 맞는 요청이 없습니다.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* 요청 상세 팝업 */}
      <RequestDetailDialog
        request={selectedRequest}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onDelete={(id) => { handleDeleteRequest(id); setDetailDialogOpen(false); }}
      />
    </div>
  );
}
