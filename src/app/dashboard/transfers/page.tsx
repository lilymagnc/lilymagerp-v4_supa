"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { 
  Search, 
  Filter, 
  ArrowRightLeft, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Download,
  RefreshCw,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrderTransfers } from "@/hooks/use-order-transfers";
import { useAuth } from "@/hooks/use-auth";
import { useBranches } from "@/hooks/use-branches";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Timestamp } from "firebase/firestore";
import { TransferFilter, TransferStats } from "@/types/order-transfer";
import { TransferStatusDialog } from "./components/transfer-status-dialog";
import { TransferDetailDialog } from "./components/transfer-detail-dialog";
import { TransferCancelDialog } from "./components/transfer-cancel-dialog";

export default function TransfersPage() {
  const { 
    transfers, 
    loading, 
    error, 
    hasMore,
    getTransferPermissions,
    fetchTransfers,
    updateTransferStatus,
    cancelTransfer,
    deleteTransfer,
    cleanupOrphanTransfers,
    getTransferStats
  } = useOrderTransfers();
  
  const { user } = useAuth();
  const { branches } = useBranches();
  
  // 상태 관리
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedOrderBranch, setSelectedOrderBranch] = useState<string>("all");
  const [selectedProcessBranch, setSelectedProcessBranch] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [stats, setStats] = useState<TransferStats | null>(null);
  
  // 다이얼로그 상태
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [transferToDelete, setTransferToDelete] = useState<string | null>(null);

  // 권한 확인
  const permissions = getTransferPermissions();
  const isAdmin = user?.role === '본사 관리자';

  // 사용자가 볼 수 있는 지점 목록
  const availableBranches = useMemo(() => {
    if (isAdmin) {
      return branches;
    } else {
      return branches.filter(branch => branch.name === user?.franchise);
    }
  }, [branches, isAdmin, user?.franchise]);

  // 필터링된 이관 목록
  const filteredTransfers = useMemo(() => {
    return transfers.filter(transfer => {
      // 검색어 필터
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          transfer.originalOrderId.toLowerCase().includes(searchLower) ||
          transfer.orderBranchName.toLowerCase().includes(searchLower) ||
          transfer.processBranchName.toLowerCase().includes(searchLower) ||
          transfer.transferByUser.toLowerCase().includes(searchLower) ||
          transfer.transferReason.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // 상태 필터
      if (selectedStatus !== "all" && transfer.status !== selectedStatus) {
        return false;
      }

      // 발주지점 필터
      if (selectedOrderBranch !== "all" && transfer.orderBranchName !== selectedOrderBranch) {
        return false;
      }

      // 수주지점 필터
      if (selectedProcessBranch !== "all" && transfer.processBranchName !== selectedProcessBranch) {
        return false;
      }

      // 날짜 필터
      if (startDate) {
        const transferDate = transfer.transferDate instanceof Timestamp 
          ? transfer.transferDate.toDate() 
          : new Date(transfer.transferDate);
        if (transferDate < startDate) return false;
      }

      if (endDate) {
        const transferDate = transfer.transferDate instanceof Timestamp 
          ? transfer.transferDate.toDate() 
          : new Date(transfer.transferDate);
        if (transferDate > endDate) return false;
      }

      return true;
    });
  }, [transfers, searchTerm, selectedStatus, selectedOrderBranch, selectedProcessBranch, startDate, endDate]);

  // 통계 계산
  const calculateStats = async () => {
    try {
      const transferStats = await getTransferStats();
      
      // 발주/수주 구분 통계 추가 (본사 관리자가 아닌 경우에만)
      const userBranch = user?.franchise;
      let orderBranchCount = 0;
      let processBranchCount = 0;
      let orderBranchDetails: Record<string, number> = {};
      let processBranchDetails: Record<string, number> = {};
      
      if (!isAdmin && userBranch) {
        // 전체 이관 데이터에서 발주/수주 구분 계산
        orderBranchCount = transfers.filter(transfer => 
          transfer.orderBranchName === userBranch
        ).length;
        processBranchCount = transfers.filter(transfer => 
          transfer.processBranchName === userBranch
        ).length;
        
        // 발주 이관 상세 정보 (수주지점별 건수)
        orderBranchDetails = transfers
          .filter(transfer => transfer.orderBranchName === userBranch)
          .reduce((acc, transfer) => {
            const processBranch = transfer.processBranchName;
            acc[processBranch] = (acc[processBranch] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        
        // 수주 이관 상세 정보 (발주지점별 건수)
        processBranchDetails = transfers
          .filter(transfer => transfer.processBranchName === userBranch)
          .reduce((acc, transfer) => {
            const orderBranch = transfer.orderBranchName;
            acc[orderBranch] = (acc[orderBranch] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
      }
      
      setStats({
        ...transferStats,
        orderBranchCount,
        processBranchCount,
        orderBranchDetails,
        processBranchDetails
      });
    } catch (error) {
      console.error('통계 조회 오류:', error);
    }
  };

  // 초기 통계 로드 및 필터 변경 시 재계산
  React.useEffect(() => {
    calculateStats();
  }, [transfers, searchTerm, selectedStatus, selectedOrderBranch, selectedProcessBranch, startDate, endDate, user?.franchise, loading]);

  // 사용자 지점에 따른 자동 필터링 - 제거 (이미 훅에서 필터링됨)
  // React.useEffect(() => {
  //   if (!isAdmin && user?.franchise) {
  //     // 일반 사용자는 자동으로 자신의 지점으로 필터링
  //     setSelectedOrderBranch(user.franchise);
  //     setSelectedProcessBranch(user.franchise);
  //   }
  // }, [isAdmin, user?.franchise]);

  // 상태 변경 핸들러
  const handleStatusChange = (transferId: string, status: 'accepted' | 'rejected' | 'completed', notes?: string) => {
    setSelectedTransfer(transfers.find(t => t.id === transferId));
    setIsStatusDialogOpen(true);
  };

  // 상세 보기 핸들러
  const handleDetailClick = (transfer: any) => {
    setSelectedTransfer(transfer);
    setIsDetailDialogOpen(true);
  };

  const handleCancelClick = (transfer: any) => {
    setSelectedTransfer(transfer);
    setIsCancelDialogOpen(true);
  };

  // 이관 기록 삭제 처리
  const handleDeleteTransfer = async (transferId: string) => {
    setTransferToDelete(transferId);
    setIsDeleteDialogOpen(true);
  };

  // 이관 기록 삭제 확인
  const confirmDeleteTransfer = async () => {
    if (!transferToDelete) return;
    
    try {
      await deleteTransfer(transferToDelete);
      setIsDeleteDialogOpen(false);
      setTransferToDelete(null);
      
      // 이관 기록 삭제 후 강제 새로고침 및 통계 업데이트
      await fetchTransfers();
      setTimeout(async () => {
        await calculateStats();
      }, 200);
    } catch (error) {
      console.error('이관 기록 삭제 실패:', error);
    }
  };

  // 고아 이관 기록 정리
  const handleCleanupOrphanTransfers = async () => {
    try {
      await cleanupOrphanTransfers();
    } catch (error) {
      console.error('고아 이관 기록 정리 실패:', error);
    }
  };

  // 상태 배지 렌더링
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />대기중</Badge>;
      case 'accepted':
        return <Badge variant="default" className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />수락됨</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" />거절됨</Badge>;
      case 'completed':
        return <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3" />완료됨</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="flex items-center gap-1 bg-gray-100 text-gray-800"><X className="h-3 w-3" />취소됨</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="주문 이관 관리"
        description="지점 간 주문 이관 요청을 관리하고 처리합니다."
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchTransfers()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
          {user?.role === '본사 관리자' && (
            <Button variant="outline" onClick={handleCleanupOrphanTransfers}>
              <X className="mr-2 h-4 w-4" />
              고아 기록 정리
            </Button>
          )}
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            엑셀 다운로드
          </Button>
        </div>
      </PageHeader>

             {/* 통계 카드 */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                 {loading ? (
           // 로딩 중일 때 스켈레톤 표시
           Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-20" />
                </CardTitle>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 이관</CardTitle>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalTransfers || 0}건</div>
                <p className="text-xs text-muted-foreground">
                  전체 이관 요청 수
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">대기중</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.pendingTransfers || 0}건</div>
                <p className="text-xs text-muted-foreground">
                  처리 대기 중
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">수락됨</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.acceptedTransfers || 0}건</div>
                <p className="text-xs text-muted-foreground">
                  수락된 이관
                </p>
              </CardContent>
            </Card>
                         <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">취소됨</CardTitle>
                 <X className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{stats?.cancelledTransfers || 0}건</div>
                 <p className="text-xs text-muted-foreground">
                   취소된 이관
                 </p>
               </CardContent>
             </Card>
             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">완료됨</CardTitle>
                 <CheckCircle className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">{stats?.completedTransfers || 0}건</div>
                 <p className="text-xs text-muted-foreground">
                   완료된 이관
                 </p>
               </CardContent>
             </Card>
                         <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">총 금액</CardTitle>
                 <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="text-2xl font-bold">₩{(stats?.totalAmount || 0).toLocaleString()}</div>
                 <div className="text-xs text-muted-foreground mt-2">
                   <div className="flex justify-between items-center">
                     <span>발주금액:</span>
                     <span className="font-semibold">₩{(stats?.orderBranchAmount || 0).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span>수주금액:</span>
                     <span className="font-semibold">₩{(stats?.processBranchAmount || 0).toLocaleString()}</span>
                   </div>
                 </div>
               </CardContent>
             </Card>
            {!isAdmin && user?.franchise && (
              <>
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">발주 이관</CardTitle>
                    <ArrowRightLeft className="h-4 w-4 opacity-90" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.orderBranchCount || 0}건</div>
                    <div className="text-xs opacity-90 mt-2">
                      {stats?.orderBranchDetails && Object.keys(stats.orderBranchDetails).length > 0 ? (
                        Object.entries(stats.orderBranchDetails).map(([branch, count]) => (
                          <div key={branch} className="flex justify-between items-center">
                            <span>{branch}</span>
                            <span className="font-semibold">{count}건</span>
                          </div>
                        ))
                      ) : (
                        <span>수주지점 없음</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium opacity-90">수주 이관</CardTitle>
                    <ArrowRightLeft className="h-4 w-4 opacity-90" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.processBranchCount || 0}건</div>
                    <div className="text-xs opacity-90 mt-2">
                      {stats?.processBranchDetails && Object.keys(stats.processBranchDetails).length > 0 ? (
                        Object.entries(stats.processBranchDetails).map(([branch, count]) => (
                          <div key={branch} className="flex justify-between items-center">
                            <span>{branch}</span>
                            <span className="font-semibold">{count}건</span>
                          </div>
                        ))
                      ) : (
                        <span>발주지점 없음</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>이관 내역</CardTitle>
          <CardDescription>
            주문 이관 요청 내역을 확인하고 처리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 필터 */}
          <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
            <div className="relative w-full sm:w-auto flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="주문ID, 지점명, 사유 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="pending">대기중</SelectItem>
                <SelectItem value="accepted">수락됨</SelectItem>
                <SelectItem value="rejected">거절됨</SelectItem>
                <SelectItem value="completed">완료됨</SelectItem>
                <SelectItem value="cancelled">취소됨</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <>
                <Select value={selectedOrderBranch} onValueChange={setSelectedOrderBranch}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="발주지점" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 지점</SelectItem>
                    {availableBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.name}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedProcessBranch} onValueChange={setSelectedProcessBranch}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue placeholder="수주지점" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 지점</SelectItem>
                    {availableBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.name}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* 테이블 */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이관 ID</TableHead>
                <TableHead>원본 주문</TableHead>
                <TableHead>발주지점</TableHead>
                <TableHead>수주지점</TableHead>
                <TableHead>이관 사유</TableHead>
                <TableHead>금액 분배</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>이관일</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTransfers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    이관 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransfers.map((transfer) => (
                  <TableRow key={transfer.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {transfer.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      {transfer.originalOrderId.slice(0, 8)}...
                    </TableCell>
                    <TableCell>{transfer.orderBranchName}</TableCell>
                    <TableCell>{transfer.processBranchName}</TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={transfer.transferReason}>
                        {transfer.transferReason}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>발주: {transfer.amountSplit.orderBranch}%</div>
                        <div>수주: {transfer.amountSplit.processBranch}%</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(transfer.status)}
                    </TableCell>
                    <TableCell>
                      {transfer.transferDate instanceof Timestamp 
                        ? format(transfer.transferDate.toDate(), 'yyyy-MM-dd HH:mm')
                        : format(new Date(transfer.transferDate), 'yyyy-MM-dd HH:mm')
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDetailClick(transfer)}
                        >
                          상세
                        </Button>
                        {transfer.status === 'pending' && permissions.canAcceptTransfer && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleStatusChange(transfer.id, 'accepted')}
                          >
                            수락
                          </Button>
                        )}
                        {transfer.status === 'pending' && 
                         (transfer.orderBranchName === user?.franchise || user?.role === '본사 관리자') && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancelClick(transfer)}
                          >
                            취소
                          </Button>
                        )}
                        {(user?.role === '본사 관리자' || 
                          (user?.role === '가맹점 관리자' && 
                           (transfer.orderBranchName === user?.franchise || transfer.processBranchName === user?.franchise))) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTransfer(transfer.id)}
                          >
                            삭제
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 더보기 버튼 */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => fetchTransfers()}
                disabled={loading}
              >
                {loading ? "로딩 중..." : "더 보기"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상태 변경 다이얼로그 */}
      <TransferStatusDialog
        isOpen={isStatusDialogOpen}
        onClose={() => setIsStatusDialogOpen(false)}
        transfer={selectedTransfer}
        onStatusUpdate={updateTransferStatus}
      />

      {/* 상세 보기 다이얼로그 */}
      <TransferDetailDialog
        isOpen={isDetailDialogOpen}
        onClose={() => setIsDetailDialogOpen(false)}
        transfer={selectedTransfer}
      />

      {/* 취소 다이얼로그 */}
      <TransferCancelDialog
        isOpen={isCancelDialogOpen}
        onClose={() => setIsCancelDialogOpen(false)}
        transfer={selectedTransfer}
      />

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이관 기록 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 이관 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTransfer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
