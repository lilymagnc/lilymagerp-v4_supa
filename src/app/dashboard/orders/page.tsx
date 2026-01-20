
"use client";
import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Search, MoreHorizontal, MessageSquareText, Upload, Download, FileText, DollarSign, TrendingUp, ShoppingCart, CheckSquare, Square, ArrowRightLeft, Package, Target, RefreshCw } from "lucide-react";
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useOrders, Order } from "@/hooks/use-orders";
import { useOrderTransfers } from "@/hooks/use-order-transfers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches } from "@/hooks/use-branches";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { MessagePrintDialog } from "./components/message-print-dialog";
import { OrderDetailDialog } from "./components/order-detail-dialog";
import { OrderEditDialog } from "./components/order-edit-dialog";
import { ExcelUploadDialog } from "./components/excel-upload-dialog";
import { OrderTransferDialog } from "@/components/order-transfer-dialog";
import { OrderOutsourceDialog } from "@/components/order-outsource-dialog";
import { Trash2, XCircle, Calendar as CalendarIcon, ExternalLink } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { exportOrdersToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { doc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNotifications } from "@/hooks/use-notifications";
import { useDisplayBoard } from "@/hooks/use-display-board";
import { useCalendar } from "@/hooks/use-calendar";

export default function OrdersPage() {
  const { orders, loading, fetchOrders, fetchAllOrders, updateOrderStatus, updatePaymentStatus, cancelOrder, deleteOrder } = useOrders();
  const [isFullDataLoaded, setIsFullDataLoaded] = useState(false);
  const { branches, loading: branchesLoading } = useBranches();
  const { createTransfer, getTransferPermissions } = useOrderTransfers();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedOrderStatus, setSelectedOrderStatus] = useState("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [selectedReceiptType, setSelectedReceiptType] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMessagePrintDialogOpen, setIsMessagePrintDialogOpen] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null);
  const [isOrderDetailDialogOpen, setIsOrderDetailDialogOpen] = useState(false);
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<Order | null>(null);
  const [isExcelUploadDialogOpen, setIsExcelUploadDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isOrderEditDialogOpen, setIsOrderEditDialogOpen] = useState(false);
  const [selectedOrderForAction, setSelectedOrderForAction] = useState<Order | null>(null);

  // 이관 주문 필터 상태
  const [showTransferredOnly, setShowTransferredOnly] = useState(false);

  // 이관 관련 상태
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedOrderForTransfer, setSelectedOrderForTransfer] = useState<Order | null>(null);

  // 외부 발주 관련 상태
  const [isOutsourceDialogOpen, setIsOutsourceDialogOpen] = useState(false);
  const [selectedOrderForOutsource, setSelectedOrderForOutsource] = useState<Order | null>(null);

  // 일괄 삭제 관련 상태
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  // 사용자 권한에 따른 지점 필터링
  const isAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise;
  // 사용자가 볼 수 있는 지점 목록
  const availableBranches = useMemo(() => {
    if (isAdmin) {
      return branches; // 관리자는 모든 지점
    } else {
      return branches.filter(branch => branch.name === userBranch); // 직원은 소속 지점만
    }
  }, [branches, isAdmin, userBranch]);
  // 직원의 경우 자동으로 소속 지점으로 필터링
  useEffect(() => {
    if (!isAdmin && userBranch && selectedBranch === "all") {
      setSelectedBranch(userBranch);
    }
  }, [isAdmin, userBranch, selectedBranch]);

  const { createNotification } = useNotifications();
  const { createDisplayItem } = useDisplayBoard();
  const { createEvent } = useCalendar();
  const [hasRunAutomation, setHasRunAutomation] = useState(false);

  // 주문 날짜 경과 시 자동 완료 처리
  useEffect(() => {
    // orders가 비어있거나 이미 실행했으면 중단
    if (loading || orders.length === 0 || hasRunAutomation) return;

    const runAutomation = async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");

      // 자동 완료 대상 필터링: '처리중' 상태이고 수령일이 오늘보다 이전인 주문
      const overdueOrders = orders.filter(order => {
        if (order.status !== 'processing') return false;

        // 권한 체크: 본사 관리자는 전체, 지점 관리자는 본인 지점만
        if (!isAdmin && userBranch && order.branchName !== userBranch) return false;

        const scheduleDate = order.pickupInfo?.date || order.deliveryInfo?.date;
        return scheduleDate && scheduleDate < todayStr;
      });

      if (overdueOrders.length === 0) {
        setHasRunAutomation(true);
        return;
      }

      console.log(`[Automation] 자동 완료 대상 주문 ${overdueOrders.length}건 발견`);

      let processedCount = 0;
      for (const order of overdueOrders) {
        try {
          // 1. 주문 상태 업데이트 (Firebase 직접 업데이트하여 반영 속도 개선)
          const orderRef = doc(db, 'orders', order.id);
          await updateDoc(orderRef, {
            status: 'completed',
            updatedAt: serverTimestamp()
          });

          // 2. 시스템 알림 생성
          await createNotification({
            type: 'system',
            subType: 'auto_complete',
            title: '주문 자동 완료 알림',
            message: `[${order.branchName}] ${order.orderer.name}님의 주문이 수령일(${order.pickupInfo?.date || order.deliveryInfo?.date}) 경과로 자동 완료되었습니다.`,
            severity: 'low',
            branchId: order.branchId,
            relatedId: order.id,
            relatedType: 'order',
            isRead: false,
            isArchived: false
          });

          // 3. 전광판 등록 (24시간 노출)
          await createDisplayItem(
            'delivery_complete',
            '주문 자동 완료 알림',
            `수령일(${order.pickupInfo?.date || order.deliveryInfo?.date}) 경과로 주문이 자동 완료 처리되었습니다.\n주문자: ${order.orderer.name}`,
            order.branchId,
            order.branchName,
            'low',
            undefined,
            order.id
          );

          // 4. 캘린더 일정 등록
          await createEvent({
            type: 'notice',
            title: `[자동완료] ${order.orderer.name}`,
            description: `지나간 주문 자동 완료 처리됨 (원래 수령일: ${order.pickupInfo?.date || order.deliveryInfo?.date})`,
            startDate: new Date(),
            branchName: order.branchName,
            status: 'completed',
            relatedId: order.id,
            color: '#94a3b8' // slate-400
          });

          processedCount++;
        } catch (err) {
          console.error(`[Automation] 주문 ${order.id} 자동 완료 처리 중 오류:`, err);
        }
      }

      if (processedCount > 0) {
        toast({
          title: "미처리 주문 정리 완료",
          description: `${processedCount}건의 주문이 과거 수령일 경과로 자동 완료되었습니다.`,
        });
        // 상태 변경 반영을 위해 데이터 다시 불러오기
        fetchOrders();
      }
      setHasRunAutomation(true);
    };

    runAutomation();
  }, [loading, orders, hasRunAutomation, isAdmin, userBranch, createNotification, createDisplayItem, createEvent, fetchOrders, toast]);

  // URL 파라미터에서 메시지 인쇄 다이얼로그 자동 열기
  useEffect(() => {
    const openMessagePrint = searchParams.get('openMessagePrint');
    const orderId = searchParams.get('orderId');

    if (openMessagePrint === 'true' && orderId) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrderForPrint(order);
        setIsMessagePrintDialogOpen(true);

        // URL에서 파라미터 제거
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openMessagePrint');
        newParams.delete('orderId');
        newParams.delete('labelType');
        newParams.delete('start');
        newParams.delete('messageFont');
        newParams.delete('messageFontSize');
        newParams.delete('senderFont');
        newParams.delete('senderFontSize');
        newParams.delete('messageContent');
        newParams.delete('senderName');
        newParams.delete('positions');

        const newUrl = newParams.toString() ? `?${newParams.toString()}` : '';
        router.replace(`/dashboard/orders${newUrl}`, { scroll: false });
      }
    }
  }, [searchParams, orders, router]);

  // 전체 내역 불러오기 핸들러
  const handleLoadFullData = async () => {
    try {
      await fetchAllOrders();
      setIsFullDataLoaded(true);
      toast({
        title: "전체 내역 로드 완료",
        description: "과거 내역을 포함한 모든 주문 데이터를 불러왔습니다."
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "로드 실패",
        description: "전체 내역을 불러오는 중 오류가 발생했습니다."
      });
    }
  };

  // 일괄 삭제 관련 함수들
  const handleSelectOrder = (orderId: string) => {
    const newSelectedIds = new Set(selectedOrderIds);
    if (newSelectedIds.has(orderId)) {
      newSelectedIds.delete(orderId);
    } else {
      newSelectedIds.add(orderId);
    }
    setSelectedOrderIds(newSelectedIds);
  };

  const handleSelectAll = () => {
    if (selectedOrderIds.size === paginatedOrders.length) {
      // 모든 항목이 선택된 경우 전체 해제
      setSelectedOrderIds(new Set());
    } else {
      // 모든 항목 선택
      const allIds = new Set(paginatedOrders.map(order => order.id));
      setSelectedOrderIds(allIds);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0) {
      toast({
        title: "선택된 주문 없음",
        description: "삭제할 주문을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsBulkDeleting(true);
    try {
      let deletedCount = 0;
      for (const orderId of selectedOrderIds) {
        try {
          await deleteOrder(orderId);
          deletedCount++;
        } catch (error) {
          console.error(`주문 삭제 실패: ${orderId}`, error);
        }
      }

      toast({
        title: "일괄 삭제 완료",
        description: `${deletedCount}개의 주문이 삭제되었습니다.`,
      });

      // 선택 초기화
      setSelectedOrderIds(new Set());
      setIsBulkDeleteDialogOpen(false);
    } catch (error) {
      toast({
        title: "삭제 실패",
        description: "일괄 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };
  const handlePrint = (orderId: string) => {
    router.push(`/dashboard/orders/print-preview/${orderId}`);
  };
  const handleMessagePrintClick = (order: Order) => {
    setSelectedOrderForPrint(order);
    setIsMessagePrintDialogOpen(true);
  };
  const handleOrderRowClick = (order: Order) => {
    setSelectedOrderForDetail(order);
    setIsOrderDetailDialogOpen(true);
  };
  // 주문 취소 처리
  const handleCancelOrder = async (orderId: string, reason?: string) => {
    try {
      await cancelOrder(orderId, reason);
      setIsCancelDialogOpen(false);
      setSelectedOrderForAction(null);
    } catch (error) {
      // 주문 취소 오류는 조용히 처리
    }
  };
  // 주문 삭제 처리
  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteOrder(orderId);
      setIsDeleteDialogOpen(false);
      setSelectedOrderForAction(null);
    } catch (error) {
      // 주문 삭제 오류는 조용히 처리
    }
  };

  // 이관 버튼 클릭 처리
  const handleTransferClick = (order: Order) => {
    setSelectedOrderForTransfer(order);
    setIsTransferDialogOpen(true);
  };

  // 외부 발주 버튼 클릭 처리
  const handleOutsourceClick = (order: Order) => {
    setSelectedOrderForOutsource(order);
    setIsOutsourceDialogOpen(true);
  };
  // 취소 다이얼로그 열기
  const openCancelDialog = (order: Order) => {
    setSelectedOrderForAction(order);
    setIsCancelDialogOpen(true);
  };
  // 삭제 다이얼로그 열기
  const openDeleteDialog = (order: Order) => {
    setSelectedOrderForAction(order);
    setIsDeleteDialogOpen(true);
  };
  const handleMessagePrintSubmit = ({
    orderId,
    labelType,
    startPosition,
    messageFont,
    messageFontSize,
    senderFont,
    senderFontSize,
    messageContent,
    senderName,
    selectedPositions
  }: {
    orderId: string;
    labelType: string;
    startPosition: number;
    messageFont: string;
    messageFontSize: number;
    senderFont: string;
    senderFontSize: number;
    messageContent: string;
    senderName: string;
    selectedPositions: number[];
  }) => {
    const params = new URLSearchParams({
      orderId,
      labelType,
      start: String(startPosition),
      messageFont,
      messageFontSize: String(messageFontSize),
      senderFont,
      senderFontSize: String(senderFontSize),
      messageContent,
      senderName,
      positions: selectedPositions.join(','),
    });
    router.push(`/dashboard/orders/print-message?${params.toString()}`);
    setIsMessagePrintDialogOpen(false);
  };
  const handleExcelDownload = () => {
    const ordersToExport = filteredOrders;
    if (ordersToExport.length === 0) {
      toast({
        title: "다운로드할 데이터가 없습니다",
        description: "다운로드할 주문 내역이 없습니다.",
        variant: "destructive",
      });
      return;
    }
    try {
      // startDate와 endDate 파라미터는 선택사항이므로 생략
      exportOrdersToExcel(ordersToExport);
      toast({
        title: "엑셀 다운로드 완료",
        description: `${ordersToExport.length}건의 주문 내역이 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
      toast({
        title: "다운로드 실패",
        description: "엑셀 파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">주문완료</Badge>;
      case 'processing':
        return <Badge variant="secondary">처리중</Badge>;
      case 'canceled':
        return <Badge variant="destructive">취소</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  const getPaymentStatusBadge = (order: Order) => {
    const status = order.payment?.status;
    const completedAt = order.payment?.completedAt;

    switch (status) {
      case 'paid':
      case 'completed':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-blue-500 text-white">완결</Badge>
            {completedAt && (
              <span className="text-xs text-gray-500">
                {format((completedAt as Timestamp).toDate(), 'MM/dd HH:mm')}
              </span>
            )}
          </div>
        );
      case 'split_payment':
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-orange-500 text-white font-semibold">분할결제</Badge>
            <span className="text-xs text-gray-500">후결제 대기</span>
          </div>
        );
      case 'pending':
        return <Badge className="bg-red-500 text-white font-semibold">미결</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 결제 수단 표시 함수
  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case 'card':
        return '카드';
      case 'cash':
        return '현금';
      case 'transfer':
        return '계좌이체';
      case 'mainpay':
        return '메인페이';
      case 'shopping_mall':
        return '쇼핑몰';
      case 'epay':
        return '이페이';
      default:
        return method;
    }
  };

  // 수령 방식 표시 함수
  const getReceiptTypeText = (type: string) => {
    switch (type) {
      case 'store_pickup': return '픽업';
      case 'pickup_reservation': return '픽업예약';
      case 'delivery_reservation': return '배송';
      default: return type || '-';
    }
  };

  // 상품명 추출 로직
  const getProductNames = (order: Order) => {
    if (order.items && order.items.length > 0) {
      const names = order.items.map(item => item.name || '상품명 없음');
      return names.join(', ');
    }
    return '상품 정보 없음';
  };



  // 주문자 이름과 회사명 표시 함수
  const getOrdererDisplay = (orderer: any) => {
    if (orderer.company && orderer.company.trim()) {
      return `${orderer.name} (${orderer.company})`;
    }
    return orderer.name;
  };
  const filteredOrders = useMemo(() => {

    let filtered = orders;

    // 권한에 따른 지점 필터링
    if (!isAdmin && userBranch) {
      // 지점 사용자는 자신의 지점 주문과 이관받은 주문을 모두 볼 수 있음
      filtered = filtered.filter(order =>
        order.branchName === userBranch ||
        (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === userBranch)
      );

    } else if (selectedBranch !== "all") {
      filtered = filtered.filter(order =>
        order.branchName === selectedBranch ||
        (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === selectedBranch)
      );
    }
    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(order =>
        String(order.orderer?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(order.id ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    // 주문 상태 필터링
    if (selectedOrderStatus !== "all") {
      filtered = filtered.filter(order => order.status === selectedOrderStatus);
    }
    // 결제 상태 필터링
    if (selectedPaymentStatus !== "all") {
      filtered = filtered.filter(order => {
        if (selectedPaymentStatus === "paid") {
          return order.payment?.status === "paid" || order.payment?.status === "completed";
        } else if (selectedPaymentStatus === "pending") {
          return order.payment?.status === "pending";
        } else if (selectedPaymentStatus === "split_payment") {
          return order.payment?.status === "split_payment";
        }
        return true;
      });
    }
    if (startDate || endDate) {
      filtered = filtered.filter(order => {
        const orderDate = order.orderDate ? (order.orderDate as Timestamp).toDate() : null;

        // 수령 방식에 따른 정확한 일정 정보 추출
        const scheduleInfo = order.receiptType === 'delivery_reservation' ? order.deliveryInfo : order.pickupInfo;
        const scheduleDateStr = scheduleInfo?.date;
        const scheduleDate = scheduleDateStr ? new Date(scheduleDateStr) : null;

        const isDateInRange = (date: Date | null) => {
          if (!date) return false;
          const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

          if (startDate && endDate) {
            const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            return dateOnly >= startDateOnly && dateOnly <= endDateOnly;
          } else if (startDate) {
            const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            return dateOnly >= startDateOnly;
          } else if (endDate) {
            const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            return dateOnly <= endDateOnly;
          }
          return true;
        };

        // 주문일 또는 수령일 중 하나라도 기간 내에 있으면 포함
        return isDateInRange(orderDate) || isDateInRange(scheduleDate);
      });
    }
    // 이관 주문만 보기 필터
    if (showTransferredOnly) {
      filtered = filtered.filter(order =>
        order.transferInfo?.isTransferred &&
        order.transferInfo?.processBranchName === userBranch
      );
    }

    // 수령 방식 필터링
    if (selectedReceiptType !== "all") {
      filtered = filtered.filter(order => order.receiptType === selectedReceiptType);
    }

    return filtered;
  }, [orders, searchTerm, selectedBranch, selectedOrderStatus, selectedPaymentStatus, startDate, endDate, isAdmin, userBranch, showTransferredOnly, selectedReceiptType]);

  // 최근 3일 이내 승인된 이관 주문 확인
  const recentlyTransferredOrders = useMemo(() => {
    if (isAdmin || !userBranch) return [];

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    return orders.filter(order => {
      // 이관받은 주문인지 확인
      const isTransferredToMe = order.transferInfo?.isTransferred &&
        order.transferInfo?.processBranchName === userBranch;
      if (!isTransferredToMe) return false;

      // 승인 날짜 확인
      if (order.transferInfo?.acceptedAt) {
        const acceptedDate = (order.transferInfo.acceptedAt as Timestamp).toDate();
        return acceptedDate >= threeDaysAgo;
      }
      return false;
    });
  }, [orders, isAdmin, userBranch]);

  // 최근 이관 주문 클릭 핸들러
  const handleRecentTransfersClick = () => {
    setShowTransferredOnly(true);
    // 날짜 필터 초기화 (최근 주문이 보이도록)
    setStartDate(undefined);
    setEndDate(undefined);
    // 상태 필터 초기화
    setSelectedOrderStatus("all");
    setSelectedPaymentStatus("all");
  };

  // 통계 계산
  const orderStats = useMemo(() => {
    // 당일 매출 현황 계산 (주문일 기준 vs 결제일 기준)
    const todayForRevenue = new Date();
    const todayStartForRevenue = new Date(todayForRevenue.getFullYear(), todayForRevenue.getMonth(), todayForRevenue.getDate());
    const todayEndForRevenue = new Date(todayForRevenue.getFullYear(), todayForRevenue.getMonth(), todayForRevenue.getDate(), 23, 59, 59, 999);

    // 오늘 주문한 모든 주문 (주문일 기준)
    const todayOrderedOrdersForRevenue = filteredOrders.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      return orderDateOnly.getTime() === todayStartForRevenue.getTime();
    });

    // 오늘 결제 완료된 모든 주문 (결제완료일 기준)
    const todayCompletedOrdersForRevenue = filteredOrders.filter(order => {
      if ((order.payment?.status !== 'paid' && order.payment?.status !== 'completed') || !order.payment?.completedAt) return false;
      const completedDate = (order.payment.completedAt as Timestamp).toDate();
      const completedDateOnly = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
      return completedDateOnly.getTime() === todayStartForRevenue.getTime();
    });

    // 금일결제: 어제 및 과거주문 + 오늘결제완료 (오늘주문 + 오늘결제완료는 제외)
    const todayPaymentCompletedOrdersForRevenue = todayCompletedOrdersForRevenue.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      // 주문일이 오늘이 아닌 주문만 포함 (어제 및 과거주문)
      return orderDateOnly.getTime() !== todayStartForRevenue.getTime();
    });

    // 오늘 주문했지만 아직 미결제인 주문
    const todayOrderedButPendingOrdersForRevenue = todayOrderedOrdersForRevenue.filter(order =>
      order.payment?.status !== 'paid' && order.payment?.status !== 'completed'
    );

    // 어제 주문했지만 오늘 결제된 주문
    const yesterdayOrderedTodayCompletedOrdersForRevenue = todayCompletedOrdersForRevenue.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      return orderDateOnly.getTime() !== todayStartForRevenue.getTime();
    });

    // 금액 계산
    const todayOrderedAmountForRevenue = todayOrderedOrdersForRevenue.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    const todayCompletedAmountForRevenue = todayCompletedOrdersForRevenue.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    const todayPaymentCompletedAmountForRevenue = todayPaymentCompletedOrdersForRevenue.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    const todayPendingAmountForRevenue = todayOrderedButPendingOrdersForRevenue.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    const yesterdayOrderedTodayCompletedAmountForRevenue = yesterdayOrderedTodayCompletedOrdersForRevenue.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    const totalOrders = filteredOrders.length;

    // 총 매출 계산 (수주받은 주문은 금액 제외, 건수만 포함)
    // 날짜 필터가 있을 때는 결제 완료일 기준으로 계산하여 대시보드 차트와 일치시킴
    const hasDateFilter = startDate || endDate;

    let totalAmount = 0;
    let totalCompletedAmount = 0;
    let totalPendingAmount = 0;

    if (hasDateFilter) {
      // 날짜 필터가 있을 때: 원본 orders에서 결제 완료일 기준으로 필터링 (대시보드 차트와 일치)
      // 먼저 다른 필터(지점, 상태 등) 적용
      let baseFiltered = orders;

      // 지점 필터링
      if (!isAdmin && userBranch) {
        baseFiltered = baseFiltered.filter(order => order.branchName === userBranch);
      } else if (isAdmin && selectedBranch !== "all") {
        baseFiltered = baseFiltered.filter(order => order.branchName === selectedBranch);
      }

      // 주문 상태 필터링
      if (selectedOrderStatus !== "all") {
        baseFiltered = baseFiltered.filter(order => order.status === selectedOrderStatus);
      }

      // 결제 상태 필터링
      if (selectedPaymentStatus !== "all") {
        if (selectedPaymentStatus === "paid") {
          baseFiltered = baseFiltered.filter(order => order.payment?.status === "paid" || order.payment?.status === "completed");
        } else if (selectedPaymentStatus === "pending") {
          baseFiltered = baseFiltered.filter(order => order.payment?.status === "pending");
        } else if (selectedPaymentStatus === "split_payment") {
          baseFiltered = baseFiltered.filter(order => order.payment?.status === "split_payment");
        }
      }

      // 검색어 필터링
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        baseFiltered = baseFiltered.filter(order => {
          const ordererName = order.orderer?.name?.toLowerCase() || '';
          const orderId = order.id.toLowerCase();
          return ordererName.includes(searchLower) || orderId.includes(searchLower);
        });
      }

      // 완결 주문: 결제 완료일 기준으로 필터링
      const completedByPaymentDate = baseFiltered.filter(order => {
        if (order.payment?.status !== 'paid' && order.payment?.status !== 'completed') {
          return false;
        }

        // 결제 완료일 기준으로 필터링
        let revenueDate: Date | null = null;
        if (order.payment?.completedAt) {
          const completedDate = (order.payment.completedAt as Timestamp).toDate();
          revenueDate = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate());
        } else if (order.orderDate) {
          // 결제 완료일이 없으면 주문일 기준
          const orderDate = (order.orderDate as Timestamp).toDate();
          revenueDate = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
        }

        if (!revenueDate) return false;

        if (startDate && endDate) {
          const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          return revenueDate >= startDateOnly && revenueDate <= endDateOnly;
        } else if (startDate) {
          const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          return revenueDate >= startDateOnly;
        } else if (endDate) {
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          return revenueDate <= endDateOnly;
        }
        return true;
      });

      totalCompletedAmount = completedByPaymentDate.reduce((sum, order) => {
        if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
          return sum;
        }
        return sum + (order.summary?.total || 0);
      }, 0);

      // 미결 주문: 주문일 기준으로 필터링
      const pendingByOrderDate = baseFiltered.filter(order => {
        if (order.payment?.status !== 'pending') return false;
        if (!order.orderDate) return false;

        const orderDate = (order.orderDate as Timestamp).toDate();
        const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

        if (startDate && endDate) {
          const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          return orderDateOnly >= startDateOnly && orderDateOnly <= endDateOnly;
        } else if (startDate) {
          const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          return orderDateOnly >= startDateOnly;
        } else if (endDate) {
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
          return orderDateOnly <= endDateOnly;
        }
        return true;
      });

      totalPendingAmount = pendingByOrderDate.reduce((sum, order) => {
        if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
          return sum;
        }
        return sum + (order.summary?.total || 0);
      }, 0);

      totalAmount = totalCompletedAmount + totalPendingAmount;
    } else {
      // 날짜 필터가 없을 때: 주문일 기준으로 계산 (기존 방식)
      totalAmount = filteredOrders.reduce((sum, order) => {
        if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
          return sum;
        }
        return sum + (order.summary?.total || 0);
      }, 0);

      // 총 매출의 완결/미결 분리 (수주받은 주문 제외)
      const totalCompletedOrders = filteredOrders.filter(order =>
        (order.payment?.status === 'paid' || order.payment?.status === 'completed') &&
        !(order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch)
      );
      const totalPendingOrders = filteredOrders.filter(order =>
        order.payment?.status === 'pending' &&
        !(order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch)
      );
      totalCompletedAmount = totalCompletedOrders.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
      totalPendingAmount = totalPendingOrders.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
    }

    // 오늘 주문 (해당 지점에서 발주한 주문만 포함, 수주받은 주문은 건수만)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayOrders = filteredOrders.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
      const isToday = orderDateOnly.getTime() === todayStart.getTime();

      // 지점 사용자의 경우: 자신의 지점 주문 또는 수주한 주문 포함
      if (!isAdmin && userBranch) {
        const isOriginal = order.branchName === userBranch;
        const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === userBranch;
        return isToday && (isOriginal || isProcess);
      }

      // 관리자의 경우: 선택된 지점에서 발주한 주문 또는 수주한 주문 포함
      if (isAdmin && selectedBranch !== "all") {
        const isOriginal = order.branchName === selectedBranch;
        const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === selectedBranch;
        return isToday && (isOriginal || isProcess);
      }

      // 관리자가 전체 지점을 선택한 경우: 모든 지점에서 발주한 주문 포함
      return isToday;
    });

    // 오늘 주문 금액 계산 (수주받은 주문은 금액 제외)
    const todayAmount = todayOrders.reduce((sum, order) => {
      // 수주받은 주문(이관받은 주문)은 금액에 포함하지 않음
      // transferInfo가 null이거나 isTransferred가 false인 경우는 일반 주문으로 처리
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);

    // 오늘 주문의 완결/미결 분리 (이관받은 주문은 금액만 0원으로 처리)
    const todayCompletedOrders = todayOrders.filter(order =>
      (order.payment?.status === 'paid' || order.payment?.status === 'completed')
    );
    const todayPendingOrders = todayOrders.filter(order =>
      order.payment?.status === 'pending'
    );
    const todayCompletedAmount = todayCompletedOrders.reduce((sum, order) => {
      // 이관받은 주문은 금액에서 제외
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);
    const todayPendingAmount = todayPendingOrders.reduce((sum, order) => {
      // 이관받은 주문은 금액에서 제외
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);

    // 이번 달 주문 (해당 지점에서 발주한 주문만 포함, 수주받은 주문은 건수만)
    const thisMonthOrders = filteredOrders.filter(order => {
      if (!order.orderDate) return false;
      const orderDate = (order.orderDate as Timestamp).toDate();
      const isThisMonth = orderDate.getMonth() === today.getMonth() &&
        orderDate.getFullYear() === today.getFullYear();

      // 지점 사용자의 경우: 자신의 지점 주문 또는 수주한 주문 포함
      if (!isAdmin && userBranch) {
        const isOriginal = order.branchName === userBranch;
        const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === userBranch;
        return isThisMonth && (isOriginal || isProcess);
      }

      // 관리자의 경우: 선택된 지점에서 발주한 주문 또는 수주한 주문 포함
      if (isAdmin && selectedBranch !== "all") {
        const isOriginal = order.branchName === selectedBranch;
        const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === selectedBranch;
        return isThisMonth && (isOriginal || isProcess);
      }

      // 관리자가 전체 지점을 선택한 경우: 모든 지점에서 발주한 주문 포함
      return isThisMonth;
    });

    // 이번 달 주문 금액 계산 (수주받은 주문은 금액 제외)
    const thisMonthAmount = thisMonthOrders.reduce((sum, order) => {
      // 수주받은 주문(이관받은 주문)은 금액에 포함하지 않음
      // transferInfo가 null이거나 isTransferred가 false인 경우는 일반 주문으로 처리
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);

    // 이번 달 주문의 완결/미결 분리 (이관받은 주문은 금액만 0원으로 처리)
    const thisMonthCompletedOrders = thisMonthOrders.filter(order =>
      (order.payment?.status === 'paid' || order.payment?.status === 'completed')
    );
    const thisMonthPendingOrders = thisMonthOrders.filter(order =>
      order.payment?.status === 'pending'
    );
    const thisMonthCompletedAmount = thisMonthCompletedOrders.reduce((sum, order) => {
      // 이관받은 주문은 금액에서 제외
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);
    const thisMonthPendingAmount = thisMonthPendingOrders.reduce((sum, order) => {
      // 이관받은 주문은 금액에서 제외
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);

    // 미결 주문 통계 (수주받은 주문은 건수만, 금액은 제외)
    const pendingPaymentOrders = filteredOrders.filter(order =>
      order.payment?.status === 'pending'
    );

    const statusCounts = filteredOrders.reduce((acc, order) => {
      const paymentStatus = order.payment?.status || 'undefined';
      acc[paymentStatus] = (acc[paymentStatus] || 0) + 1;
      return acc;
    }, {});

    // completed 상태인 주문들 확인
    const completedStatusOrders = filteredOrders.filter(order =>
      order.payment?.status === 'completed'
    );

    const pendingPaymentCount = pendingPaymentOrders.length;
    const pendingPaymentAmount = pendingPaymentOrders.reduce((sum, order) => {
      // 수주받은 주문(이관받은 주문)은 금액에 포함하지 않음
      // transferInfo가 null이거나 isTransferred가 false인 경우는 일반 주문으로 처리
      if (order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && userBranch && order.transferInfo.processBranchName === userBranch) {
        return sum; // 금액 제외
      }
      return sum + (order.summary?.total || 0);
    }, 0);





    // 주문 상태별 통계
    const statusStats = filteredOrders.reduce((acc, order) => {
      const status = order.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOrders,
      totalAmount,
      totalCompletedAmount,
      totalPendingAmount,
      todayOrders: todayOrders.length,
      todayAmount,
      todayCompletedAmount,
      todayPendingAmount,
      thisMonthOrders: thisMonthOrders.length,
      thisMonthAmount,
      thisMonthCompletedAmount,
      thisMonthPendingAmount,
      pendingPaymentCount,
      pendingPaymentAmount,
      statusStats,
      // 당일 매출 현황 데이터
      todayOrderedAmountForRevenue,
      todayCompletedAmountForRevenue,
      todayPaymentCompletedAmountForRevenue,
      todayPendingAmountForRevenue,
      yesterdayOrderedTodayCompletedAmountForRevenue,
      todayOrderedOrdersForRevenue: todayOrderedOrdersForRevenue.length,
      todayCompletedOrdersForRevenue: todayCompletedOrdersForRevenue.length,
      todayPaymentCompletedOrdersForRevenue: todayPaymentCompletedOrdersForRevenue.length,
      todayOrderedButPendingOrdersForRevenue: todayOrderedButPendingOrdersForRevenue.length,
      yesterdayOrderedTodayCompletedOrdersForRevenue: yesterdayOrderedTodayCompletedOrdersForRevenue.length
    };
  }, [filteredOrders, orders, startDate, endDate, selectedBranch, selectedOrderStatus, selectedPaymentStatus, searchTerm, isAdmin, userBranch]);

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedOrderStatus, selectedPaymentStatus, startDate, endDate, selectedReceiptType]);

  // 당일/미래 픽업 및 배송 요약 데이터
  const quickSchedule = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");

    const getScheduleOrders = (type: 'today' | 'future') => {
      return orders.filter(order => {
        // 권한 필터링 (자신의 지점 주문만 + 이관받은 주문 포함)
        if (!isAdmin && userBranch) {
          const isOwnBranch = order.branchName === userBranch;
          const isTransferredToMe = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === userBranch;
          if (!isOwnBranch && !isTransferredToMe) return false;
        }

        // 지점 필터가 적용된 경우 해당 지점만 (+ 이관받은 주문 포함)
        if (isAdmin && selectedBranch !== "all") {
          const isSelectedBranch = order.branchName === selectedBranch;
          const isTransferredToSelected = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === selectedBranch;
          if (!isSelectedBranch && !isTransferredToSelected) return false;
        }

        const schedule = order.receiptType === 'delivery_reservation' ? order.deliveryInfo : order.pickupInfo;
        if (!schedule?.date || order.status === 'canceled' || order.status === 'completed') return false;

        if (type === 'today') {
          return schedule.date === todayStr;
        } else {
          return schedule.date > todayStr;
        }
      }).sort((a, b) => {
        const dateA = (a.pickupInfo?.date || a.deliveryInfo?.date || "");
        const dateB = (b.pickupInfo?.date || b.deliveryInfo?.date || "");
        if (dateA !== dateB) return dateA.localeCompare(dateB);

        const timeA = (a.pickupInfo?.time || a.deliveryInfo?.time || "00:00");
        const timeB = (b.pickupInfo?.time || b.deliveryInfo?.time || "00:00");
        return timeA.localeCompare(timeB);
      });
    };

    return {
      today: getScheduleOrders('today'),
      future: getScheduleOrders('future')
    };
  }, [orders, isAdmin, userBranch, selectedBranch]);
  return (
    <>
      <PageHeader
        title="주문 현황"
        description={`모든 주문 내역을 확인하고 관리하세요.${!isAdmin ? ` (${userBranch})` : ''}`}
      >
        <div className="flex flex-wrap gap-2">
          {!isFullDataLoaded && (
            <Button
              variant="outline"
              onClick={handleLoadFullData}
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              과거 내역 포함 불러오기
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard/orders/new">
              <PlusCircle className="mr-2 h-4 w-4" />
              주문 접수
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setIsExcelUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            엑셀 업로드
          </Button>
          <Button variant="outline" onClick={handleExcelDownload}>
            <Download className="mr-2 h-4 w-4" />
            엑셀 다운로드
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/transfers">
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              주문이관 관리
            </Link>
          </Button>
          <Button variant="default" className="bg-purple-600 hover:bg-purple-700" asChild>
            <Link href="/dashboard/orders/daily-settlement">
              <Target className="mr-2 h-4 w-4" />
              일일 마감 정산
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 xl:grid-cols-6 gap-4 mb-6">
        {loading ? (
          // 로딩 중일 때 스켈레톤 표시
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 주문</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 매출</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {isAdmin
                    ? (selectedBranch !== "all" ? `${selectedBranch} 오늘 주문` : '오늘 주문')
                    : `${userBranch} 오늘 주문`
                  }
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">이번 달 주문</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">미결 주문</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">당일 매출 현황</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 주문</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.totalOrders.toLocaleString()}건</div>
                <p className="text-xs text-muted-foreground">
                  필터링된 주문 수
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 매출</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₩{orderStats.totalAmount.toLocaleString()}</div>
                <div className="space-y-1">
                  <p className="text-xs text-green-600 font-medium">
                    완결: ₩{orderStats.totalCompletedAmount.toLocaleString()}
                  </p>
                  {orderStats.todayPaymentCompletedAmountForRevenue > 0 && (
                    <p className="text-xs text-blue-600 font-medium">
                      금일결제: ₩{orderStats.todayPaymentCompletedAmountForRevenue.toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs text-orange-600 font-medium">
                    미결: ₩{orderStats.totalPendingAmount.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {isAdmin
                    ? (selectedBranch !== "all" ? `${selectedBranch} 오늘 주문` : '오늘 주문')
                    : `${userBranch} 오늘 주문`
                  }
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.todayOrders}건</div>
                <div className="space-y-1">
                  <p className="text-xs text-green-600 font-medium">
                    완결: ₩{orderStats.todayCompletedAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-600 font-medium">
                    미결: ₩{orderStats.todayPendingAmount.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">이번 달 주문</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.thisMonthOrders}건</div>
                <div className="space-y-1">
                  <p className="text-xs text-green-600 font-medium">
                    완결: ₩{orderStats.thisMonthCompletedAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-orange-600 font-medium">
                    미결: ₩{orderStats.thisMonthPendingAmount.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium opacity-90">
                  {isAdmin
                    ? (selectedBranch !== "all" ? `${selectedBranch} 미결` : '미결 주문')
                    : `${userBranch} 미결`
                  }
                </CardTitle>
                <Package className="h-4 w-4 opacity-90" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orderStats.pendingPaymentCount}건</div>
                <p className="text-xs opacity-90">₩{orderStats.pendingPaymentAmount.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium opacity-90">
                  {isAdmin
                    ? (selectedBranch !== "all" ? `${selectedBranch} 당일 매출` : '당일 매출 현황')
                    : `${userBranch} 당일 매출`
                  }
                </CardTitle>
                <DollarSign className="h-4 w-4 opacity-90" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₩{(orderStats.todayCompletedAmount + orderStats.todayPaymentCompletedAmountForRevenue).toLocaleString()}</div>
                <div className="space-y-1 mt-2">
                  <p className="text-xs opacity-90">
                    금일결제: ₩{orderStats.todayPaymentCompletedAmountForRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs opacity-90">
                    미결제: ₩{orderStats.todayPendingAmountForRevenue.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 당일/미래 스케줄 요약 */}
      {!loading && (quickSchedule.today.length > 0 || quickSchedule.future.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="border-blue-100 bg-blue-50/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">오늘</span>
                오늘의 픽업/배송 일정 ({quickSchedule.today.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4 h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200 scrollbar-track-transparent">
              {quickSchedule.today.length > 0 ? (
                <div className="space-y-2 pb-2">
                  {quickSchedule.today.map(order => (
                    <div
                      key={order.id}
                      className="flex flex-col gap-1 p-2 bg-white rounded border border-blue-100 hover:border-blue-300 cursor-pointer shadow-sm transition-all"
                      onClick={() => handleOrderRowClick(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-blue-700 min-w-[40px]">{order.pickupInfo?.time || order.deliveryInfo?.time || '-'}</span>
                          <Badge variant="outline" className={cn(
                            "px-1 py-0 h-4 text-[10px] whitespace-nowrap",
                            order.receiptType === 'delivery_reservation' ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-green-50 text-green-600 border-green-200"
                          )}>
                            {getReceiptTypeText(order.receiptType)}
                          </Badge>
                          <span className="font-semibold truncate max-w-[80px]">{order.deliveryInfo?.recipientName || order.pickupInfo?.pickerName || order.orderer.name}</span>
                          <span className="text-[10px] text-muted-foreground bg-gray-100 px-1 rounded">{order.branchName}</span>
                        </div>
                        <Badge variant="outline" className="px-1 py-0 h-4 text-[10px] whitespace-nowrap">
                          {getStatusBadge(order.status).props.children}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground truncate flex-1 mr-2">{getProductNames(order)}</span>
                        <div className="flex gap-1">
                          {order.transferInfo?.isTransferred && (
                            <span className={cn(
                              "px-1 rounded border whitespace-nowrap",
                              order.branchName === (selectedBranch === 'all' ? userBranch : selectedBranch)
                                ? "bg-blue-50 text-blue-600 border-blue-100"
                                : "bg-purple-50 text-purple-600 border-purple-100"
                            )}>
                              {order.branchName === (selectedBranch === 'all' ? userBranch : selectedBranch)
                                ? `이관발주 → ${order.transferInfo.processBranchName}`
                                : `이관수주 ← ${order.branchName}`
                              }
                            </span>
                          )}
                          {order.outsourceInfo?.isOutsourced && (
                            <span className="bg-orange-50 text-orange-600 border border-orange-100 px-1 rounded whitespace-nowrap">외부:{order.outsourceInfo.partnerName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">오늘 일정이 없습니다.</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-purple-100 bg-purple-50/30">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span className="bg-purple-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">예약</span>
                향후 전체 예약 일정 ({quickSchedule.future.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 px-4 h-[250px] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-200 scrollbar-track-transparent">
              {quickSchedule.future.length > 0 ? (
                <div className="space-y-2 pb-2">
                  {quickSchedule.future.map(order => (
                    <div
                      key={order.id}
                      className="flex flex-col gap-1 p-2 bg-white rounded border border-purple-100 hover:border-purple-300 cursor-pointer shadow-sm transition-all"
                      onClick={() => handleOrderRowClick(order)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-purple-700 min-w-[75px]">{order.pickupInfo?.date?.substring(5) || order.deliveryInfo?.date?.substring(5)} {order.pickupInfo?.time || order.deliveryInfo?.time || '-'}</span>
                          <Badge variant="outline" className={cn(
                            "px-1 py-0 h-4 text-[10px] whitespace-nowrap",
                            order.receiptType === 'delivery_reservation' ? "bg-orange-50 text-orange-600 border-orange-200" : "bg-green-50 text-green-600 border-green-200"
                          )}>
                            {getReceiptTypeText(order.receiptType)}
                          </Badge>
                          <span className="font-semibold truncate max-w-[80px]">{order.deliveryInfo?.recipientName || order.pickupInfo?.pickerName || order.orderer.name}</span>
                          <span className="text-[10px] text-muted-foreground bg-gray-100 px-1 rounded">{order.branchName}</span>
                        </div>
                        <Badge variant="outline" className="px-1 py-0 h-4 text-[10px] whitespace-nowrap">
                          {getStatusBadge(order.status).props.children}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground truncate flex-1 mr-2">{getProductNames(order)}</span>
                        <div className="flex gap-1">
                          {order.transferInfo?.isTransferred && (
                            <span className={cn(
                              "px-1 rounded border whitespace-nowrap",
                              order.branchName === (selectedBranch === 'all' ? userBranch : selectedBranch)
                                ? "bg-blue-50 text-blue-600 border-blue-100"
                                : "bg-purple-50 text-purple-600 border-purple-100"
                            )}>
                              {order.branchName === (selectedBranch === 'all' ? userBranch : selectedBranch)
                                ? `이관발주 → ${order.transferInfo.processBranchName}`
                                : `이관수주 ← ${order.branchName}`
                              }
                            </span>
                          )}
                          {order.outsourceInfo?.isOutsourced && (
                            <span className="bg-orange-50 text-orange-600 border border-orange-100 px-1 rounded whitespace-nowrap">외부:{order.outsourceInfo.partnerName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic">향후 일정이 없습니다.</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>주문 내역</CardTitle>
          <CardDescription>
            최근 주문 목록을 검색하고 관리합니다.
            {!isAdmin && ` 현재 ${userBranch} 지점의 주문만 표시됩니다.`}
            <br />
            <span className="text-blue-600">💡 엑셀 다운로드:</span> 업로드 템플릿과 동일한 형식으로 다운로드되어 수정 후 재업로드가 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
            <div className="relative w-full sm:w-auto flex-1 sm:flex-initial">
              <label htmlFor="order-search" className="sr-only">주문 검색</label>
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="order-search"
                name="order-search"
                type="search"
                placeholder="주문자명, 주문ID 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                autoComplete="off"
              />
            </div>
            {isAdmin && (
              <div>
                <label htmlFor="branch-select" className="sr-only">지점 선택</label>
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger id="branch-select" name="branch-select" className="w-full sm:w-[180px]">
                    <SelectValue placeholder="지점 선택" />
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
              </div>
            )}
            <div>
              <label htmlFor="order-status-select" className="sr-only">주문 상태 선택</label>
              <Select value={selectedOrderStatus} onValueChange={setSelectedOrderStatus}>
                <SelectTrigger id="order-status-select" name="order-status-select" className="w-full sm:w-[140px]">
                  <SelectValue placeholder="주문 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="processing">처리중</SelectItem>
                  <SelectItem value="completed">주문완료</SelectItem>
                  <SelectItem value="canceled">취소</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="payment-status-select" className="sr-only">결제 상태 선택</label>
              <Select value={selectedPaymentStatus} onValueChange={setSelectedPaymentStatus}>
                <SelectTrigger id="payment-status-select" name="payment-status-select" className="w-full sm:w-[140px]">
                  <SelectValue placeholder="결제 상태" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 결제</SelectItem>
                  <SelectItem value="paid">완결</SelectItem>
                  <SelectItem value="split_payment">분할결제</SelectItem>
                  <SelectItem value="pending">미결</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="receipt-type-select" className="sr-only">수령 방법 선택</label>
              <Select value={selectedReceiptType} onValueChange={setSelectedReceiptType}>
                <SelectTrigger id="receipt-type-select" name="receipt-type-select" className="w-full sm:w-[140px]">
                  <SelectValue placeholder="수령 방법" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 수령방법</SelectItem>
                  <SelectItem value="store_pickup">픽업</SelectItem>
                  <SelectItem value="pickup_reservation">픽업예약</SelectItem>
                  <SelectItem value="delivery_reservation">배송</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[200px] justify-start text-left font-normal",
                      !startDate && !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate && endDate ? (
                      <>
                        {format(startDate, "yyyy-MM-dd")} ~ {format(endDate, "yyyy-MM-dd")}
                      </>
                    ) : startDate ? (
                      format(startDate, "yyyy-MM-dd") + " 이후"
                    ) : endDate ? (
                      format(endDate, "yyyy-MM-dd") + " 이전"
                    ) : (
                      "날짜 범위 선택"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex gap-2 p-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">시작일</label>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">종료일</label>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 p-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                    >
                      초기화
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>총 {filteredOrders.length}건</span>
                <span>총 ₩{orderStats.totalAmount.toLocaleString()}</span>
                {loading && <span className="text-blue-500">(로딩 중...)</span>}
                {!loading && filteredOrders.length === 0 && (
                  <span className="text-red-500">
                    (전체 주문: {orders.length}건, 필터링 후: 0건)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="page-size" className="text-sm text-muted-foreground">페이지당:</label>
                <Select value={String(pageSize)} onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger id="page-size" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 최근 이관 주문 알림 배너 */}
          {!isAdmin && recentlyTransferredOrders.length > 0 && !showTransferredOnly && (
            <div
              className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
              onClick={handleRecentTransfersClick}
            >
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 p-2 rounded-full">
                  <ArrowRightLeft className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium text-orange-900">최근 이관된 주문이 {recentlyTransferredOrders.length}건 있습니다!</h3>
                  <p className="text-sm text-orange-700">여기를 클릭하여 이관받은 주문 목록을 확인하세요.</p>
                </div>
              </div>
              <Button variant="outline" className="border-orange-300 text-orange-700 hover:text-orange-800 hover:bg-orange-200">
                확인하기 <ArrowRightLeft className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 이관 주문 필터 활성화 알림 */}
          {showTransferredOnly && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full">
                  <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900">이관받은 주문만 보고 있습니다</h3>
                  <p className="text-sm text-blue-700">총 {filteredOrders.length}건의 이관 주문이 있습니다.</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700 hover:text-blue-800 hover:bg-blue-200"
                onClick={() => setShowTransferredOnly(false)}
              >
                전체 주문 보기 <XCircle className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 일괄 삭제 액션 바 */}
          {selectedOrderIds.size > 0 && (
            <Card className="border-orange-200 bg-orange-50 mb-4">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-orange-800">
                      {selectedOrderIds.size}개 주문 선택됨
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderIds(new Set())}
                    >
                      선택 해제
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setIsBulkDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      선택된 주문 삭제
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-6 w-6 p-0"
                  >
                    {selectedOrderIds.size === paginatedOrders.length && paginatedOrders.length > 0 ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </Button>
                </TableHead>
                <TableHead>주문일</TableHead>
                <TableHead>수령방법</TableHead>
                <TableHead>픽업/배송일</TableHead>
                <TableHead>주문자/회사명</TableHead>
                <TableHead>상품명</TableHead>
                <TableHead>출고지점</TableHead>
                <TableHead>결제수단</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="text-right flex-shrink-0 w-16">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                paginatedOrders.map((order) => {

                  return (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOrderRowClick(order)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectOrder(order.id);
                          }}
                          className="h-6 w-6 p-0"
                        >
                          {selectedOrderIds.has(order.id) ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs">{order.orderDate && format((order.orderDate as Timestamp).toDate(), 'yyyy-MM-dd')}</span>
                          <span className="text-[10px] text-muted-foreground">{order.orderDate && format((order.orderDate as Timestamp).toDate(), 'HH:mm')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(
                          "px-2 py-0.5 whitespace-nowrap",
                          order.receiptType === 'delivery_reservation' ? "bg-orange-50 text-orange-700 border-orange-200" :
                            order.receiptType === 'pickup_reservation' ? "bg-green-50 text-green-700 border-green-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {getReceiptTypeText(order.receiptType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const info = order.receiptType === 'delivery_reservation' ? order.deliveryInfo : order.pickupInfo;
                          if (!info || !info.date) return <span className="text-muted-foreground">-</span>;
                          return (
                            <div className="flex flex-col">
                              <span className={cn(
                                "text-xs font-medium italic",
                                order.status === 'processing' ? "text-red-600" : "text-blue-600"
                              )}>
                                {info.date}
                              </span>
                              <span className={cn(
                                "text-[10px] font-medium",
                                order.status === 'processing' ? "text-red-500" : "text-blue-500"
                              )}>
                                {info.time || ''}
                              </span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={getOrdererDisplay(order.orderer)}>
                          {getOrdererDisplay(order.orderer)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={getProductNames(order)}>
                          {getProductNames(order)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span>{order.branchName}</span>
                            {order.transferInfo?.isTransferred && (
                              <Badge variant="outline" className="text-xs">
                                이관됨
                              </Badge>
                            )}
                            {order.outsourceInfo?.isOutsourced && (
                              <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                                외부발주
                              </Badge>
                            )}
                          </div>
                          {order.transferInfo?.isTransferred && order.transferInfo?.processBranchName && (
                            <div className="text-xs text-gray-500">
                              처리: {order.transferInfo.processBranchName}
                            </div>
                          )}
                          {order.outsourceInfo?.isOutsourced && order.outsourceInfo?.partnerName && (
                            <div className="text-xs text-orange-500 font-medium">
                              업체: {order.outsourceInfo.partnerName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.payment?.isSplitPayment ? (
                          <div className="text-sm">
                            <div className="text-green-600 font-medium">
                              선: {order.payment.firstPaymentMethod ? getPaymentMethodText(order.payment.firstPaymentMethod) : '미설정'}
                            </div>
                            <div className="text-orange-600 font-medium">
                              후: {order.payment.secondPaymentMethod ? getPaymentMethodText(order.payment.secondPaymentMethod) : '미설정'}
                            </div>
                          </div>
                        ) : (
                          order.payment?.method ? getPaymentMethodText(order.payment.method) : '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {getStatusBadge(order.status)}
                          {order.payment && getPaymentStatusBadge(order)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">₩{order.summary.total.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">메뉴 토글</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>작업</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handlePrint(order.id);
                            }}>
                              주문서 인쇄
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleMessagePrintClick(order);
                            }}>
                              <MessageSquareText className="mr-2 h-4 w-4" />
                              메시지 인쇄
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setIsOrderEditDialogOpen(true);
                              setSelectedOrderForAction(order);
                            }}>
                              <FileText className="mr-2 h-4 w-4" />
                              주문 수정
                            </DropdownMenuItem>
                            {getTransferPermissions().canCreateTransfer && !order.transferInfo?.isTransferred && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleTransferClick(order);
                              }}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                지점 이관
                              </DropdownMenuItem>
                            )}
                            {((isAdmin || order.branchName === userBranch) && !order.outsourceInfo?.isOutsourced) && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleOutsourceClick(order);
                              }}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                외부 발주
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>주문 상태 변경</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  updateOrderStatus(order.id, 'processing');
                                }}>
                                  처리중
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  updateOrderStatus(order.id, 'completed');
                                }}>
                                  주문완료
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  updateOrderStatus(order.id, 'canceled');
                                }}>
                                  취소
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>결제 상태 변경</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  updatePaymentStatus(order.id, 'paid');
                                }}>
                                  완결
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  updatePaymentStatus(order.id, 'pending');
                                }}>
                                  미결
                                </DropdownMenuItem>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openCancelDialog(order);
                              }}
                              className="text-orange-600 focus:text-orange-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              주문 취소 (금액 0원)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openDeleteDialog(order);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              주문 삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* 페이지네이션 컨트롤 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} / {filteredOrders.length}건
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card >
      {selectedOrderForPrint && (
        <MessagePrintDialog
          isOpen={isMessagePrintDialogOpen}
          onOpenChange={setIsMessagePrintDialogOpen}
          order={selectedOrderForPrint}
          onSubmit={handleMessagePrintSubmit}
        />
      )
      }
      {
        selectedOrderForDetail && (
          <OrderDetailDialog
            isOpen={isOrderDetailDialogOpen}
            onOpenChange={setIsOrderDetailDialogOpen}
            order={selectedOrderForDetail}
          />
        )
      }
      {
        selectedOrderForAction && (
          <OrderEditDialog
            isOpen={isOrderEditDialogOpen}
            onOpenChange={setIsOrderEditDialogOpen}
            order={selectedOrderForAction}
          />
        )
      }
      <ExcelUploadDialog
        isOpen={isExcelUploadDialogOpen}
        onOpenChange={setIsExcelUploadDialogOpen}
      />

      <OrderTransferDialog
        isOpen={isTransferDialogOpen}
        onClose={() => setIsTransferDialogOpen(false)}
        order={selectedOrderForTransfer}
      />
      {/* 주문 취소 다이얼로그 */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>주문 취소</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 주문을 취소하시겠습니까?
              <br />
              <strong>주문 ID:</strong> {selectedOrderForAction?.id}
              <br />
              <strong>주문자:</strong> {selectedOrderForAction?.orderer.name}
              <br />
              <strong>현재 금액:</strong> ₩{selectedOrderForAction?.summary.total.toLocaleString()}
              <br />
              <strong>환급 포인트:</strong> {selectedOrderForAction?.summary.pointsUsed ? `${selectedOrderForAction.summary.pointsUsed}포인트` : '0포인트'}
              <br />
              <br />
              취소 시 금액이 0원으로 설정되고 주문 상태가 '취소'로 변경되며 고객의 포인트는 환급됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrderForAction && handleCancelOrder(selectedOrderForAction.id)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              주문 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* 주문 삭제 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>주문 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 주문을 완전히 삭제하시겠습니까?
              <br />
              <strong>주문 ID:</strong> {selectedOrderForAction?.id}
              <br />
              <strong>주문자:</strong> {selectedOrderForAction?.orderer.name}
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOrderForAction && handleDeleteOrder(selectedOrderForAction.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 일괄 삭제 다이얼로그 */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>일괄 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              선택된 {selectedOrderIds.size}개의 주문을 모두 삭제하시겠습니까?
              <br />
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBulkDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <OrderOutsourceDialog
        isOpen={isOutsourceDialogOpen}
        onClose={() => setIsOutsourceDialogOpen(false)}
        order={selectedOrderForOutsource}
        onSuccess={() => fetchOrders()}
      />
    </>
  );
}
