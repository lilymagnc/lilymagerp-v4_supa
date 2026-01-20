"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  Package, Truck, CheckCircle, Clock, MapPin, Phone,
  Calendar as CalendarIcon, Download, DollarSign, Filter, Search, X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useOrders, Order } from "@/hooks/use-orders";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, subMonths, startOfMonth, endOfMonth, isToday } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBranches, Branch } from "@/hooks/use-branches";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSimpleExpenses } from "@/hooks/use-simple-expenses";
import { SimpleExpenseCategory } from "@/types/simple-expense";
import { usePartners } from "@/hooks/use-partners";
import { OrderDetailDialog } from "./components/order-detail-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { exportPickupDeliveryToExcel } from "@/lib/excel-export";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Sub-components
import { TodayDashboard } from "./components/TodayDashboard";
import { PickupTable } from "./components/PickupTable";
import { DeliveryTable } from "./components/DeliveryTable";
import { DeliveryCostTable } from "./components/DeliveryCostTable";
import { CalendarView } from "./components/CalendarView";
import { DeliverySettingsDialog } from "./components/DeliverySettingsDialog";

export default function PickupDeliveryPage() {
  const { orders, loading, updateOrderStatus, updateOrder, completeDelivery } = useOrders();
  const { branches, loading: branchesLoading, updateBranch } = useBranches();
  const { user } = useAuth();
  const { toast } = useToast();
  const { addExpense } = useSimpleExpenses();
  const { partners, addPartner } = usePartners();

  // View State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [activeTab, setActiveTab] = useState("pickup");
  const [dateFilterType, setDateFilterType] = useState<'order' | 'pickup' | 'delivery'>('pickup');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfDay(new Date()));
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  // UI States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportType, setExportType] = useState<'pickup' | 'delivery'>('pickup');
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(undefined);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(undefined);
  const [isDeliveryCostDialogOpen, setIsDeliveryCostDialogOpen] = useState(false);
  const [selectedOrderForCost, setSelectedOrderForCost] = useState<Order | null>(null);
  const [deliveryCost, setDeliveryCost] = useState('');
  const [deliveryCostReason, setDeliveryCostReason] = useState('');

  const [editingDriverInfo, setEditingDriverInfo] = useState<{
    orderId: string;
    driverAffiliation: string;
    driverName: string;
    driverContact: string;
    actualDeliveryCost?: string;
  } | null>(null);

  // Settings States
  const [isDeliveryFeeSettingsOpen, setIsDeliveryFeeSettingsOpen] = useState(false);
  const [selectedBranchForSettings, setSelectedBranchForSettings] = useState<Branch | null>(null);

  const isAdmin = user?.role === '본사 관리자';
  const userBranch = user?.franchise;

  // Integration Logic
  const ensurePartnerExists = async (driverAffiliation: string, driverName?: string, driverContact?: string) => {
    if (!driverAffiliation || driverAffiliation === '운송업체') return;
    try {
      const existingPartner = partners.find(partner =>
        partner.name === driverAffiliation ||
        partner.contactPerson === driverName ||
        partner.phone === driverContact
      );
      if (!existingPartner) {
        await addPartner({
          name: driverAffiliation,
          type: '운송업체',
          contactPerson: driverName || '',
          phone: driverContact || '',
          memo: `자동 등록 - 기사: ${driverName || ''}`,
          items: '배송 서비스',
          bankAccount: '',
          businessNumber: '',
          ceoName: '',
          address: '',
          email: ''
        });
      }
    } catch (error) { console.error('거래처 자동 등록 오류:', error); }
  };

  const createDeliveryExpense = async (order: Order, actualCost: number) => {
    try {
      const orderBranch = branches.find(branch => branch.name === order.branchName);
      if (!orderBranch) return;

      await ensurePartnerExists(
        order.deliveryInfo?.driverAffiliation || '',
        order.deliveryInfo?.driverName,
        order.deliveryInfo?.driverContact
      );

      const driverInfo = order.deliveryInfo?.driverName ? `, 배송기사: ${order.deliveryInfo.driverName}` : '';
      await addExpense({
        date: Timestamp.now(),
        category: SimpleExpenseCategory.TRANSPORT,
        subCategory: 'DELIVERY',
        description: `배송비-${order.orderer.name}${driverInfo}`,
        amount: actualCost,
        supplier: order.deliveryInfo?.driverAffiliation || '운송업체',
        quantity: 1,
        unitPrice: actualCost,
        relatedOrderId: order.id,
      }, orderBranch.id, orderBranch.name);
    } catch (error) { console.error('배송비 자동 지출 생성 오류:', error); }
  };

  // Handlers
  const handleCompletePickup = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'completed');
      toast({ title: '픽업 완료', description: '픽업이 완료 처리되었습니다.' });
    } catch (error) { toast({ variant: 'destructive', title: '오류', description: '픽업 완료 처리 중 오류가 발생했습니다.' }); }
  };

  const handleCompleteDelivery = async (orderId: string, completionPhotoUrl?: string) => {
    try {
      if (completionPhotoUrl) {
        await completeDelivery(orderId, completionPhotoUrl, user?.uid);
        toast({ title: '배송 완료', description: '사진과 함께 배송이 완료 처리되었습니다.' });
      } else {
        await updateOrderStatus(orderId, 'completed');
        toast({ title: '배송 완료', description: '배송이 완료 처리되었습니다.' });
      }
    } catch (error) { toast({ variant: 'destructive', title: '오류', description: '배송 완료 처리 중 오류가 발생했습니다.' }); }
  };

  const handleDeleteDeliveryPhoto = async (orderId: string, photoUrl: string) => {
    if (!confirm('배송완료 사진을 삭제하시겠습니까?')) return;
    try {
      const { deleteFile } = await import('@/lib/firebase-storage');
      await deleteFile(photoUrl);
      const order = orders.find(o => o.id === orderId);
      if (order?.deliveryInfo) {
        await updateOrder(orderId, { deliveryInfo: { ...order.deliveryInfo, completionPhotoUrl: null } });
        toast({ title: "사진 삭제 완료" });
      }
    } catch (error) { toast({ variant: 'destructive', title: '오류', description: '사진 삭제 중 오류가 발생했습니다.' }); }
  };

  const handleUpdateDriverInfo = async () => {
    if (!editingDriverInfo) return;
    try {
      const order = orders.find(o => o.id === editingDriverInfo.orderId);
      if (!order?.deliveryInfo) return;
      const updateData: any = {
        deliveryInfo: {
          ...order.deliveryInfo,
          driverAffiliation: editingDriverInfo.driverAffiliation,
          driverName: editingDriverInfo.driverName,
          driverContact: editingDriverInfo.driverContact,
        }
      };
      if (editingDriverInfo.actualDeliveryCost?.trim()) {
        const actualCost = parseInt(editingDriverInfo.actualDeliveryCost);
        updateData.actualDeliveryCost = actualCost;
        updateData.deliveryCostStatus = 'completed';
        updateData.deliveryProfit = (order.summary?.deliveryFee || 0) - actualCost;
        await createDeliveryExpense(order, actualCost);
      }
      updateOrder(editingDriverInfo.orderId, updateData);
      toast({ title: '완료', description: '정보가 업데이트되었습니다.' });
      setIsDriverDialogOpen(false);
    } catch (error) { toast({ variant: 'destructive', title: '오류', description: '정보 업데이트 중 오류가 발생했습니다.' }); }
  };

  const handleExportToExcel = () => {
    if (!exportStartDate || !exportEndDate) {
      toast({ variant: 'destructive', title: '오류', description: '시작일과 종료일을 모두 선택해주세요.' });
      return;
    }
    try {
      const startDateStr = format(exportStartDate, 'yyyy-MM-dd');
      const endDateStr = format(exportEndDate, 'yyyy-MM-dd');
      const targetOrders = exportType === 'pickup' ? pickupOrders : deliveryOrders;
      exportPickupDeliveryToExcel(targetOrders, exportType, startDateStr, endDateStr);
      toast({ title: '성공', description: '엑셀 파일이 다운로드되었습니다.' });
      setIsExportDialogOpen(false);
      setExportStartDate(undefined);
      setExportEndDate(undefined);
    } catch (error) {
      console.error('Excel export error:', error);
      toast({ variant: 'destructive', title: '오류', description: '엑셀 파일 생성 중 오류가 발생했습니다.' });
    }
  };

  const handleSaveDeliveryCost = async () => {
    if (!selectedOrderForCost || !deliveryCost) {
      toast({ variant: 'destructive', title: '오류', description: '배송비를 입력해주세요.' });
      return;
    }
    try {
      const actualCost = parseInt(deliveryCost);
      await updateOrder(selectedOrderForCost.id, {
        actualDeliveryCost: actualCost,
        deliveryCostStatus: 'completed',
        deliveryCostUpdatedAt: new Date(),
        deliveryCostUpdatedBy: user?.email || 'unknown',
        deliveryCostReason: deliveryCostReason,
        deliveryProfit: (selectedOrderForCost.summary?.deliveryFee || 0) - actualCost,
      });

      await createDeliveryExpense(selectedOrderForCost, actualCost);
      toast({ title: '완료', description: '배송비가 입력되었습니다.' });
      setIsDeliveryCostDialogOpen(false);
      setSelectedOrderForCost(null);
      setDeliveryCost('');
      setDeliveryCostReason('');
    } catch (error) {
      console.error('Error saving delivery cost:', error);
      toast({ variant: 'destructive', title: '오류', description: '배송비 입력 중 오류가 발생했습니다.' });
    }
  };

  const handleQuickFilter = (type: 'today' | 'tomorrow' | 'week') => {
    const now = new Date();
    if (type === 'today') {
      setStartDate(startOfDay(now));
      setEndDate(endOfDay(now));
    } else if (type === 'tomorrow') {
      const tomorrow = addDays(now, 1);
      setStartDate(startOfDay(tomorrow));
      setEndDate(endOfDay(tomorrow));
    } else if (type === 'week') {
      setStartDate(startOfDay(startOfWeek(now, { weekStartsOn: 1 })));
      setEndDate(endOfDay(endOfWeek(now, { weekStartsOn: 1 })));
    }
  };

  // Memoized Filters
  const isDateInRange = (dateString: string, start?: Date, end?: Date) => {
    if (!dateString) return true;
    const target = new Date(dateString);
    if (start && target < start) return false;
    if (end && target > end) return false;
    return true;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Basic Filters
      if (order.status === 'canceled') return false;
      if (!isAdmin && userBranch && order.branchName !== userBranch && order.transferInfo?.processBranchName !== userBranch) return false;
      if (selectedBranch !== 'all' && order.branchName !== selectedBranch && order.transferInfo?.processBranchName !== selectedBranch) return false;

      // Date Filter
      if (startDate || endDate) {
        let dateStr = '';
        if (dateFilterType === 'order') dateStr = (order.orderDate as any).toDate?.().toISOString() || new Date(order.orderDate as any).toISOString();
        else if (dateFilterType === 'pickup') dateStr = order.pickupInfo?.date || '';
        else if (dateFilterType === 'delivery') dateStr = order.deliveryInfo?.date || '';
        if (!isDateInRange(dateStr, startDate, endDate)) return false;
      }

      // Search
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return order.orderer.name.toLowerCase().includes(s) ||
          order.id.toLowerCase().includes(s) ||
          order.deliveryInfo?.recipientName?.toLowerCase().includes(s) ||
          order.pickupInfo?.pickerName?.toLowerCase().includes(s);
      }
      return true;
    });
  }, [orders, isAdmin, userBranch, selectedBranch, startDate, endDate, dateFilterType, searchTerm]);

  const pickupOrders = useMemo(() => filteredOrders.filter(o => o.receiptType === 'pickup_reservation'), [filteredOrders]);
  const deliveryOrders = useMemo(() => filteredOrders.filter(o => o.receiptType === 'delivery_reservation'), [filteredOrders]);
  const completedDeliveryOrders = useMemo(() => deliveryOrders.filter(o => o.status === 'completed' || o.actualDeliveryCost !== undefined), [deliveryOrders]);

  const stats = useMemo(() => ({
    pendingPickup: pickupOrders.filter(o => o.status === 'processing').length,
    completedPickup: pickupOrders.filter(o => o.status === 'completed').length,
    pendingDelivery: deliveryOrders.filter(o => o.status === 'processing').length,
    completedDelivery: deliveryOrders.filter(o => o.status === 'completed').length,
  }), [pickupOrders, deliveryOrders]);

  if (loading || branchesLoading) {
    return <div className="p-8 space-y-4"><Skeleton className="h-10 w-1/4" /><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="픽업/배송 관리"
        description="예약된 픽업 및 배송 일정을 한눈에 확인하고 관리하세요."
      >
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => {
                const branch = branches.find(b => b.name === (selectedBranch === 'all' ? (userBranch || branches[0]?.name) : selectedBranch));
                if (branch) {
                  setSelectedBranchForSettings(branch);
                  setIsDeliveryFeeSettingsOpen(true);
                }
              }}
              className="flex items-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              배송비 설정
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setIsExportDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            엑셀 출력
          </Button>
        </div>
      </PageHeader>

      <TodayDashboard pickupOrders={pickupOrders} deliveryOrders={deliveryOrders} />

      <Card className="border-none shadow-sm bg-slate-50/50">
        <CardContent className="p-4 pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="flex items-center gap-2 bg-white p-1 rounded-lg border mr-2">
                <Button
                  variant={viewMode === 'list' ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 text-xs font-medium"
                >
                  리스트형
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className="h-8 text-xs font-medium"
                >
                  달력형
                </Button>
              </div>

              {viewMode === 'list' && (
                <>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="주문자, 번호 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-10 border-slate-200 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-white p-1 rounded-lg border">
                    <Button variant={isToday(startDate || new Date()) && !isToday(addDays(endDate || new Date(), -1)) ? "secondary" : "ghost"} size="sm" onClick={() => handleQuickFilter('today')} className="h-8 text-xs px-3">오늘</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleQuickFilter('tomorrow')} className="h-8 text-xs px-3">내일</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleQuickFilter('week')} className="h-8 text-xs px-3">이번 주</Button>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-10 border-slate-200 bg-white min-w-[200px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                        {startDate ? (endDate ? `${format(startDate, "MM/dd")} - ${format(endDate, "MM/dd")}` : format(startDate, "MM/dd")) : "기간 선택"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <div className="p-2 border-b">
                        <Select value={dateFilterType} onValueChange={(v: any) => setDateFilterType(v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pickup">픽업일 기준</SelectItem>
                            <SelectItem value="delivery">배송일 기준</SelectItem>
                            <SelectItem value="order">주문일 기준</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Calendar mode="range" selected={{ from: startDate, to: endDate }} onSelect={(range: any) => { setStartDate(range?.from); setEndDate(range?.to); }} initialFocus locale={ko} />
                    </PopoverContent>
                  </Popover>

                  <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setStartDate(undefined); setEndDate(undefined); }} className="h-10 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4 mr-1" /> 초기화
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger className="w-[160px] h-10 bg-white">
                    <SelectValue placeholder="지점 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 지점</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === 'calendar' ? (
        <CalendarView
          orders={orders}
          onDateSelect={(date) => {
            setStartDate(startOfDay(date));
            setEndDate(endOfDay(date));
            setViewMode('list');
          }}
          currentDate={currentCalendarDate}
          onCurrentDateChange={setCurrentCalendarDate}
        />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md h-12 bg-slate-100 p-1">
            <TabsTrigger value="pickup" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              픽업 <Badge variant="secondary" className="ml-1.5 h-5 px-1 bg-slate-200 text-slate-600 border-none font-bold">{stats.pendingPickup}</Badge>
            </TabsTrigger>
            <TabsTrigger value="delivery" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              배송 <Badge variant="secondary" className="ml-1.5 h-5 px-1 bg-slate-200 text-slate-600 border-none font-bold">{stats.pendingDelivery}</Badge>
            </TabsTrigger>
            <TabsTrigger value="costs" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
              정산 <Badge variant="secondary" className="ml-1.5 h-5 px-1 bg-slate-200 text-slate-600 border-none font-bold">{completedDeliveryOrders.filter(o => !o.actualDeliveryCost).length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pickup" className="mt-6">
            <PickupTable
              orders={pickupOrders}
              onComplete={handleCompletePickup}
              onRowClick={(order) => { setSelectedOrder(order); setIsDialogOpen(true); }}
              formatDateTime={(d, t) => `${format(new Date(d), 'MM/dd')} ${t}`}
              getStatusBadge={(s) => s === 'processing' ? <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-none h-5 px-2 text-[10px]">처리중</Badge> : <Badge className="bg-green-100 text-green-700 border-none h-5 px-2 text-[10px]">완료</Badge>}
            />
          </TabsContent>

          <TabsContent value="delivery" className="mt-6">
            <DeliveryTable
              orders={deliveryOrders}
              onComplete={handleCompleteDelivery}
              onDeletePhoto={handleDeleteDeliveryPhoto}
              onEditDriver={(order) => {
                setEditingDriverInfo({
                  orderId: order.id,
                  driverAffiliation: order.deliveryInfo?.driverAffiliation || '',
                  driverName: order.deliveryInfo?.driverName || '',
                  driverContact: order.deliveryInfo?.driverContact || '',
                  actualDeliveryCost: order.actualDeliveryCost?.toString() || '',
                });
                setIsDriverDialogOpen(true);
              }}
              onRowClick={(order) => { setSelectedOrder(order); setIsDialogOpen(true); }}
              formatDateTime={(d, t) => `${format(new Date(d), 'MM/dd')} ${t}`}
              getStatusBadge={(s) => s === 'processing' ? <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none h-5 px-2 text-[10px]">배송전</Badge> : <Badge className="bg-green-100 text-green-700 border-none h-5 px-2 text-[10px]">완료</Badge>}
            />
          </TabsContent>

          <TabsContent value="costs" className="mt-6">
            <DeliveryCostTable
              orders={completedDeliveryOrders}
              onCostInput={(order) => { setSelectedOrderForCost(order); setDeliveryCost(order.actualDeliveryCost?.toString() || ''); setIsDeliveryCostDialogOpen(true); }}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Dialogs */}
      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onOrderUpdate={() => { }} // Hook handles real-time updates
        />
      )}

      {/* 기사 정보 수정 다이얼로그 */}
      <Dialog open={isDriverDialogOpen} onOpenChange={setIsDriverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>배송 상세 정보 수정</DialogTitle>
            <DialogDescription>배송 기사 정보와 실제 배송 비용을 입력합니다.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="affiliation">배송 소속</Label>
              <Input
                id="affiliation"
                value={editingDriverInfo?.driverAffiliation}
                onChange={(e) => setEditingDriverInfo(prev => prev ? { ...prev, driverAffiliation: e.target.value } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driverName">기사 성함</Label>
              <Input
                id="driverName"
                value={editingDriverInfo?.driverName}
                onChange={(e) => setEditingDriverInfo(prev => prev ? { ...prev, driverName: e.target.value } : null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="driverContact">연락처</Label>
              <Input
                id="driverContact"
                value={editingDriverInfo?.driverContact}
                onChange={(e) => setEditingDriverInfo(prev => prev ? { ...prev, driverContact: e.target.value } : null)}
              />
            </div>
            <div className="grid gap-2 border-t pt-4">
              <Label htmlFor="actualCost">실제 배송 비용 (₩)</Label>
              <Input
                id="actualCost"
                type="number"
                placeholder="지출된 배송비를 입력하세요"
                value={editingDriverInfo?.actualDeliveryCost}
                onChange={(e) => setEditingDriverInfo(prev => prev ? { ...prev, actualDeliveryCost: e.target.value } : null)}
              />
              <p className="text-[10px] text-slate-400">배송비를 입력하면 자동으로 지출 내역에 등록됩니다.</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsDriverDialogOpen(false)}>취소</Button>
            <Button onClick={handleUpdateDriverInfo}>저장하기</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 엑셀 수출 다이얼로그 */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>엑셀 출력 설정</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>출력 대상</Label>
              <RadioGroup value={exportType} onValueChange={(v: any) => setExportType(v)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pickup" id="ex-pickup" />
                  <Label htmlFor="ex-pickup">픽업 리스트</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="delivery" id="ex-delivery" />
                  <Label htmlFor="ex-delivery">배송 리스트</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>시작일</Label>
                <Input type="date" value={exportStartDate ? exportStartDate.toISOString().split('T')[0] : ''} onChange={(e) => setExportStartDate(new Date(e.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>종료일</Label>
                <Input type="date" value={exportEndDate ? exportEndDate.toISOString().split('T')[0] : ''} onChange={(e) => setExportEndDate(new Date(e.target.value))} />
              </div>
            </div>
          </div>
          <Button onClick={handleExportToExcel} className="w-full">파일 생성 및 다운로드</Button>
        </DialogContent>
      </Dialog>

      {/* 배송비 입력 다이얼로그 */}
      <Dialog open={isDeliveryCostDialogOpen} onOpenChange={setIsDeliveryCostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>배송 비용 입력</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>실제 지출된 배송비</Label>
              <Input
                type="number"
                value={deliveryCost}
                onChange={(e) => setDeliveryCost(e.target.value)}
                placeholder="금액을 입력하세요"
              />
            </div>
            <div className="grid gap-2">
              <Label>비고 (메모)</Label>
              <Textarea
                value={deliveryCostReason}
                onChange={(e) => setDeliveryCostReason(e.target.value)}
                placeholder="특이사항이 있으면 입력하세요"
              />
            </div>
          </div>
          <Button onClick={handleSaveDeliveryCost} className="w-full">보관하기</Button>
        </DialogContent>
      </Dialog>

      {/* 배송 설정 다이얼로그 */}
      {selectedBranchForSettings && (
        <DeliverySettingsDialog
          branch={selectedBranchForSettings}
          isOpen={isDeliveryFeeSettingsOpen}
          onOpenChange={setIsDeliveryFeeSettingsOpen}
          onSave={async (branchId, settings) => {
            await updateBranch(branchId, settings);
            setIsDeliveryFeeSettingsOpen(false);
          }}
        />
      )}
    </div>
  );
}
