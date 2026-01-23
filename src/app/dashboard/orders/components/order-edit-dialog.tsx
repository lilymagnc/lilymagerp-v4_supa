"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Order } from "@/hooks/use-orders";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/hooks/use-orders";
import { useSettings } from "@/hooks/use-settings";
import { useSimpleExpenses } from "@/hooks/use-simple-expenses";
import { useAuth } from "@/hooks/use-auth"; // Added for user tracking
import { usePartners } from "@/hooks/use-partners";
import { useBranches } from "@/hooks/use-branches";
import { SimpleExpenseCategory } from "@/types/simple-expense";
import {
  User,
  Phone,
  Mail,
  Building,
  MapPin,
  Calendar,
  Clock,
  Package,
  MessageSquare,
  FileText,
  CreditCard,
  Truck,
  Home,
  Save,
  X,
  Plus,
  Minus
} from "lucide-react";

interface OrderEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export function OrderEditDialog({ isOpen, onOpenChange, order }: OrderEditDialogProps) {
  const { toast } = useToast();
  const { updateOrder } = useOrders();
  const { settings } = useSettings();
  const { partners, addPartner } = usePartners();
  const { branches } = useBranches();
  const { user } = useAuth(); // Import user for tracking
  const {
    updateExpenseByOrderId,
    addExpense,
    deleteExpenseByOrderId
  } = useSimpleExpenses();
  const [isLoading, setIsLoading] = useState(false);
  const [editableDeliveryFee, setEditableDeliveryFee] = useState(0);
  const [actualDeliveryCost, setActualDeliveryCost] = useState(0);
  const [actualDeliveryCostCash, setActualDeliveryCostCash] = useState(0);
  const [driverAffiliation, setDriverAffiliation] = useState('');

  // 폼 상태
  const [formData, setFormData] = useState({
    orderer: {
      name: '',
      contact: '',
      companyName: '',
      email: ''
    },
    receiptType: 'store_pickup' as 'store_pickup' | 'pickup_reservation' | 'delivery_reservation',
    pickupDate: '',
    pickupTime: '',
    recipient: {
      name: '',
      contact: ''
    },
    address: '',
    items: [] as OrderItem[],
    message: {
      type: 'none',
      sender: '',
      content: ''
    },
    outsourceInfo: {
      isOutsourced: false,
      partnerName: '',
      partnerPrice: 0
    },
    specialRequests: '',
    status: 'processing' as 'processing' | 'completed' | 'canceled',
    paymentStatus: 'pending' as any,
    paymentMethod: 'card' as any
  });

  // 주문 데이터가 변경될 때 폼 초기화
  useEffect(() => {
    if (order) {
      // 날짜 데이터 처리 (Timestamp 또는 문자열)
      let initialDate = '';
      const rawDate = order.pickupInfo?.date || order.deliveryInfo?.date;

      if (rawDate) {
        if (rawDate instanceof Timestamp) {
          initialDate = format(rawDate.toDate(), 'yyyy-MM-dd');
        } else if (rawDate instanceof Date) {
          initialDate = format(rawDate, 'yyyy-MM-dd');
        } else {
          initialDate = rawDate;
        }
      }

      setFormData({
        orderer: {
          name: order.orderer.name || '',
          contact: order.orderer.contact || '',
          companyName: order.orderer.company || '',
          email: order.orderer.email || ''
        },
        receiptType: order.receiptType || 'store_pickup',
        pickupDate: initialDate,
        pickupTime: order.pickupInfo?.time || order.deliveryInfo?.time || '',
        recipient: {
          name: order.pickupInfo?.pickerName || order.deliveryInfo?.recipientName || '',
          contact: order.pickupInfo?.pickerContact || order.deliveryInfo?.recipientContact || ''
        },
        address: order.deliveryInfo?.address || '',
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        message: {
          type: order.message?.type || 'none',
          sender: '',
          content: order.message?.content || ''
        },
        outsourceInfo: {
          isOutsourced: order.outsourceInfo?.isOutsourced || false,
          partnerName: order.outsourceInfo?.partnerName || '',
          partnerPrice: order.outsourceInfo?.partnerPrice || 0
        },
        specialRequests: order.request || '',
        status: order.status,
        paymentStatus: order.payment?.status || 'pending',
        paymentMethod: order.payment?.method || 'card'
      });

      // 기존 배송비를 초기값으로 설정
      setEditableDeliveryFee(order.summary?.deliveryFee || 0);
      // 실제 배송비 초기값 설정
      setActualDeliveryCost(order.actualDeliveryCost || 0);
      setActualDeliveryCostCash(order.actualDeliveryCostCash || 0);
      setDriverAffiliation(order.deliveryInfo?.driverAffiliation || '');
    }
  }, [order]);

  // 배송기사 소속을 거래처에 자동 등록하는 함수
  const ensurePartnerExists = async (driverAffiliation: string, driverName?: string, driverContact?: string) => {
    if (!driverAffiliation || driverAffiliation === '운송업체') return;

    try {
      // 이미 등록된 거래처인지 확인
      const existingPartner = partners.find(partner =>
        partner.name === driverAffiliation ||
        partner.contactPerson === driverName ||
        partner.phone === driverContact
      );

      if (!existingPartner) {
        // 새로운 거래처로 등록
        const partnerData = {
          name: driverAffiliation,
          type: '운송업체',
          contactPerson: driverName || '',
          phone: driverContact || '',
          email: '',
          address: '',
          businessNumber: '',
          ceoName: '',
          bankAccount: '',
          items: '배송 서비스',
          memo: `자동 등록된 배송업체 - ${driverName ? `기사: ${driverName}` : ''} ${driverContact ? `연락처: ${driverContact}` : ''}`,
        };

        await addPartner(partnerData);
      }
    } catch (error) {
      console.error('거래처 자동 등록 오류:', error);
      // 오류가 발생해도 배송비 지출 생성은 계속 진행
    }
  };

  // 배송비 자동 지출 생성 함수
  const createDeliveryExpense = async (order: Order, actualCost: number, actualCostCash: number) => {
    try {
      const orderBranch = branches.find(branch => branch.name === order.branchName);
      if (!orderBranch) {
        console.error('지점 정보를 찾을 수 없습니다:', order.branchName);
        return;
      }

      const supplierName = driverAffiliation || '운송업체';
      const driverName = order.deliveryInfo?.driverName;
      const driverContact = order.deliveryInfo?.driverContact;

      // 배송기사 소속을 거래처에 자동 등록
      await ensurePartnerExists(
        supplierName,
        driverName,
        driverContact
      );

      // 1. 전체 배송비 지출 생성 (기존 로직) -> 비현금 부분만 기록 (중복 방지)
      const nonCashAmount = Math.max(0, actualCost - actualCostCash);
      const expenseData = {
        date: Timestamp.now(),
        category: SimpleExpenseCategory.TRANSPORT,
        subCategory: 'DELIVERY',
        description: `배송비-${formData.orderer.name}`,
        amount: nonCashAmount,
        supplier: supplierName,
        quantity: 1,
        unitPrice: nonCashAmount,
        memo: `주문번호: ${order.id}, 고객: ${formData.orderer.name}, 배송지: ${formData.address || '주소 없음'}`,
        branchId: orderBranch.id,
        branchName: orderBranch.name,
        isAutoGenerated: true,
        relatedOrderId: order.id,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      await addExpense(expenseData, orderBranch.id, orderBranch.name);

      // 2. 기사 현금 지급액이 있는 경우 별도 지출 생성 (사용자 요청: 시재 차감용)
      if (actualCostCash > 0) {
        const cashExpenseData = {
          date: Timestamp.now(),
          category: SimpleExpenseCategory.TRANSPORT,
          subCategory: 'DELIVERY_CASH', // 구분용 서브카테고리
          description: `배송비-${supplierName} 현금${actualCostCash.toLocaleString()}원`,
          amount: actualCostCash,
          supplier: supplierName,
          quantity: 1,
          unitPrice: actualCostCash,
          memo: `[기사현금지급] 주문번호: ${order.id}, 고객: ${formData.orderer.name}. 이 금액은 일일정산 시재에서 차감됩니다.`,
          branchId: orderBranch.id,
          branchName: orderBranch.name,
          isAutoGenerated: true,
          relatedOrderId: order.id,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          paymentMethod: 'cash' as const // 현금 결제임을 명시
        };
        await addExpense(cashExpenseData, orderBranch.id, orderBranch.name);
      }
    } catch (error) {
      console.error('배송비 지출 생성 오류:', error);
    }
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => {
      // 최상위 레벨 필드인 경우 (receiptType, pickupDate, pickupTime, address, specialRequests, status, paymentStatus, paymentMethod)
      if (field === '') {
        return {
          ...prev,
          [section]: value
        };
      }
      // 중첩된 객체 필드인 경우
      return {
        ...prev,
        [section]: {
          ...prev[section as keyof typeof prev],
          [field]: value
        }
      };
    });
  };

  const handleNestedInputChange = (section: string, subsection: string, field: string, value: any) => {
    setFormData(prev => {
      const parent = prev[section as keyof typeof prev] as any;

      if (subsection) {
        // Deeply nested input (e.g. recipient.contact) - existing logic might be flawed if strict structure expected
        // But here we're likely using this for 2 levels deep max: section -> subsection -> field 
        // OR section -> field if subsection is empty
        return {
          ...prev,
          [section]: {
            ...parent,
            [subsection]: {
              ...parent[subsection],
              [field]: value
            }
          }
        };
      } else {
        // Direct child of section (e.g. outsourceInfo.partnerName)
        return {
          ...prev,
          [section]: {
            ...parent,
            [field]: value
          }
        };
      }
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', quantity: 1, price: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = formData.receiptType === 'delivery_reservation' ? editableDeliveryFee : 0;

    // 기존 주문의 할인 정보 사용
    const discountAmount = order?.summary?.discountAmount || 0;
    const discountRate = order?.summary?.discountRate || 0;
    const pointsUsed = order?.summary?.pointsUsed || 0;
    const pointsEarned = order?.summary?.pointsEarned || 0;

    // 할인 적용된 금액 계산
    const discountedSubtotal = subtotal - discountAmount;
    const finalSubtotal = discountedSubtotal - pointsUsed;
    const total = finalSubtotal + deliveryFee;

    return {
      subtotal,
      discountAmount,
      discountRate,
      deliveryFee,
      pointsUsed,
      pointsEarned,
      discountedSubtotal,
      finalSubtotal,
      total
    };
  };

  // 외부 발주 지출 관리 함수
  const manageOutsourceExpense = async (orderId: string, branchId: string, branchName: string, info: typeof formData.outsourceInfo) => {
    try {
      if (info.isOutsourced && info.partnerPrice > 0) {
        // 지출 날짜는 주문의 배송일/픽업일 기준, 없으면 오늘
        const targetDate = formData.pickupDate ? new Date(formData.pickupDate) : new Date();

        // 지출 등록/업데이트 시도
        const expenseData = {
          date: targetDate,
          amount: info.partnerPrice,
          category: 'material' as any, // SimpleExpenseCategory.MATERIAL
          subCategory: 'outsource', // MaterialSubCategory.OUTSOURCE
          description: `자재비-외부발주 (${info.partnerName})`,
          supplier: info.partnerName,
          quantity: 1,
          unitPrice: info.partnerPrice,
          paymentMethod: 'transfer' as any, // 기본값 계좌이체
          relatedOrderId: orderId
        };

        // 기존 지출 업데이트 시도
        const updated = await updateExpenseByOrderId(orderId, expenseData, 'outsource');

        // 없으면 새로 생성
        if (!updated) {
          await addExpense({
            ...expenseData,
            inventoryUpdates: [], // 필수 항목
          }, branchId, branchName);
        }
      } else {
        // 외부 발주가 아니거나 금액이 0이면 관련 지출 삭제 (또는 업데이트 안함)
        // 여기서는 명시적으로 취소된 경우 삭제하도록 함
        if (!info.isOutsourced) {
          await deleteExpenseByOrderId(orderId, 'outsource');
        }
      }
    } catch (e) {
      console.error("외부 발주 지출 동기화 실패", e);
    }
  };

  const handleSave = async () => {
    if (!order) return;

    setIsLoading(true);
    try {
      if (formData.items.length === 0) {
        toast({
          title: "오류",
          description: "최소 하나의 상품을 추가해야 합니다.",
          variant: "destructive"
        });
        return;
      }

      const updatedOrder = {
        orderer: {
          ...order.orderer,
          name: formData.orderer.name,
          contact: formData.orderer.contact,
          company: formData.orderer.companyName, // Fixed: align with interface
          email: formData.orderer.email
        },
        receiptType: formData.receiptType,
        items: formData.items.map((item, idx) => ({
          ...item,
          id: order.items[idx]?.id || crypto.randomUUID(), // Preserve ID or generate
          source: (order.items[idx]?.source || 'manual') as 'manual' | 'excel_upload'
        })),
        message: formData.message.type !== 'none' ? {
          type: formData.message.type as any,
          content: formData.message.content
        } : null,
        outsourceInfo: formData.outsourceInfo.isOutsourced ? {
          isOutsourced: true,
          partnerId: '', // Optional or lookup
          partnerName: formData.outsourceInfo.partnerName,
          partnerPrice: formData.outsourceInfo.partnerPrice,
          profit: calculateTotal().total - formData.outsourceInfo.partnerPrice,
          status: order.outsourceInfo?.status || 'pending',
          outsourcedAt: order.outsourceInfo?.outsourcedAt || new Date(),
          updatedAt: new Date()
        } : {
          isOutsourced: false,
          partnerId: '', partnerName: '', partnerPrice: 0, profit: 0, status: 'canceled' as const, outsourcedAt: null
        },
        request: formData.specialRequests,
        status: formData.status,
        payment: {
          ...order.payment,
          method: formData.paymentMethod,
          status: formData.paymentStatus
        },
        summary: {
          ...order.summary,
          subtotal: calculateTotal().subtotal,
          discountAmount: calculateTotal().discountAmount,
          discountRate: calculateTotal().discountRate,
          deliveryFee: calculateTotal().deliveryFee,
          pointsUsed: calculateTotal().pointsUsed,
          pointsEarned: calculateTotal().pointsEarned,
          total: calculateTotal().total
        },
        pickupInfo: (formData.receiptType === 'store_pickup' || formData.receiptType === 'pickup_reservation') ? {
          date: formData.pickupDate,
          time: formData.pickupTime,
          pickerName: formData.recipient.name,
          pickerContact: formData.recipient.contact
        } : null,
        deliveryInfo: formData.receiptType === 'delivery_reservation' ? {
          date: formData.pickupDate,
          time: formData.pickupTime,
          recipientName: formData.recipient.name,
          recipientContact: formData.recipient.contact,
          address: formData.address,
          district: '',
          driverAffiliation: driverAffiliation
        } : null,
        actualDeliveryCost: (formData.receiptType === 'delivery_reservation' && actualDeliveryCost > 0) ? actualDeliveryCost : order.actualDeliveryCost,
        actualDeliveryCostCash: (formData.receiptType === 'delivery_reservation' && actualDeliveryCostCash > 0) ? actualDeliveryCostCash : order.actualDeliveryCostCash,
        deliveryCostStatus: (formData.receiptType === 'delivery_reservation' && (actualDeliveryCost > 0 || actualDeliveryCostCash > 0)) ? 'completed' : order.deliveryCostStatus,
        deliveryCostUpdatedAt: (actualDeliveryCost !== order.actualDeliveryCost || actualDeliveryCostCash !== order.actualDeliveryCostCash) ? new Date() : order.deliveryCostUpdatedAt,
        deliveryCostUpdatedBy: (actualDeliveryCost !== order.actualDeliveryCost || actualDeliveryCostCash !== order.actualDeliveryCostCash) ? (user?.email || 'unknown') : order.deliveryCostUpdatedBy,
        deliveryProfit: (formData.receiptType === 'delivery_reservation') ? (calculateTotal().deliveryFee - actualDeliveryCost) : order.deliveryProfit
      };

      // 실제 배송비 정보가 입력되었으면 지출 내역 생성/업데이트 (무조건 실행하여 싱크 맞춤)
      if (formData.receiptType === 'delivery_reservation' && (actualDeliveryCost > 0 || actualDeliveryCostCash > 0)) {
        await createDeliveryExpense(order, actualDeliveryCost, actualDeliveryCostCash);
      }

      // 외부 발주 지출 동기화
      const orderBranch = branches.find(branch => branch.name === order.branchName) || branches[0];
      if (orderBranch) {
        await manageOutsourceExpense(order.id, orderBranch.id, orderBranch.name, formData.outsourceInfo);
      }

      await updateOrder(order.id, updatedOrder);

      toast({
        title: "성공",
        description: "주문이 성공적으로 수정되었습니다.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast({
        title: "오류",
        description: "주문 수정 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!order) return null;

  const totals = calculateTotal();



  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            주문 수정
            <span className="text-sm font-normal text-muted-foreground">
              ({order.id})
            </span>
          </DialogTitle>
          <DialogDescription>
            주문 정보를 수정합니다. 변경사항은 즉시 저장됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 주문자 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                주문자 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderer-name">주문자명 *</Label>
                  <Input
                    id="orderer-name"
                    value={formData.orderer.name}
                    onChange={(e) => handleInputChange('orderer', 'name', e.target.value)}
                    placeholder="주문자명을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderer-contact">연락처 *</Label>
                  <Input
                    id="orderer-contact"
                    value={formData.orderer.contact}
                    onChange={(e) => handleInputChange('orderer', 'contact', e.target.value)}
                    placeholder="연락처를 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderer-company">회사명</Label>
                  <Input
                    id="orderer-company"
                    value={formData.orderer.company}
                    onChange={(e) => handleInputChange('orderer', 'company', e.target.value)}
                    placeholder="회사명을 입력하세요"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderer-email">이메일</Label>
                  <Input
                    id="orderer-email"
                    type="email"
                    value={formData.orderer.email}
                    onChange={(e) => handleInputChange('orderer', 'email', e.target.value)}
                    placeholder="이메일을 입력하세요"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 수령 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                수령 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>수령 방법</Label>
                <div className="flex flex-row gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="receipt-store-pickup"
                      name="receiptType"
                      value="store_pickup"
                      checked={formData.receiptType === 'store_pickup'}
                      onChange={(e) => handleInputChange('receiptType', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="receipt-store-pickup">매장픽업 (즉시)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="receipt-pickup-reservation"
                      name="receiptType"
                      value="pickup_reservation"
                      checked={formData.receiptType === 'pickup_reservation'}
                      onChange={(e) => handleInputChange('receiptType', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="receipt-pickup-reservation">픽업예약</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="receipt-delivery-reservation"
                      name="receiptType"
                      value="delivery_reservation"
                      checked={formData.receiptType === 'delivery_reservation'}
                      onChange={(e) => handleInputChange('receiptType', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="receipt-delivery-reservation">배송예약</Label>
                  </div>
                </div>
              </div>

              {(formData.receiptType === 'pickup_reservation' || formData.receiptType === 'delivery_reservation') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pickup-date">예약 날짜</Label>
                    <Input
                      id="pickup-date"
                      type="date"
                      value={formData.pickupDate}
                      onChange={(e) => handleInputChange('pickupDate', '', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pickup-time">예약 시간</Label>
                    <Input
                      id="pickup-time"
                      type="time"
                      value={formData.pickupTime}
                      onChange={(e) => handleInputChange('pickupTime', '', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {(formData.receiptType === 'store_pickup' || formData.receiptType === 'pickup_reservation') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="picker-name">픽업자명</Label>
                    <Input
                      id="picker-name"
                      value={formData.recipient.name}
                      onChange={(e) => handleInputChange('recipient', 'name', e.target.value)}
                      placeholder="픽업자명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="picker-contact">픽업자 연락처</Label>
                    <Input
                      id="picker-contact"
                      value={formData.recipient.contact}
                      onChange={(e) => handleInputChange('recipient', 'contact', e.target.value)}
                      placeholder="픽업자 연락처를 입력하세요"
                    />
                  </div>
                </div>
              )}

              {formData.receiptType === 'delivery_reservation' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-name">수령인명</Label>
                    <Input
                      id="recipient-name"
                      value={formData.recipient.name}
                      onChange={(e) => handleInputChange('recipient', 'name', e.target.value)}
                      placeholder="수령인명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient-contact">수령인 연락처</Label>
                    <Input
                      id="recipient-contact"
                      value={formData.recipient.contact}
                      onChange={(e) => handleInputChange('recipient', 'contact', e.target.value)}
                      placeholder="수령인 연락처를 입력하세요"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="delivery-address">배송 주소</Label>
                    <Textarea
                      id="delivery-address"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', '', e.target.value)}
                      placeholder="배송 주소를 입력하세요"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery-fee">배송비</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">₩</span>
                      <Input
                        id="delivery-fee"
                        type="number"
                        value={editableDeliveryFee}
                        onChange={(e) => setEditableDeliveryFee(Number(e.target.value))}
                        placeholder="배송비 입력"
                        className="w-32"
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="actual-delivery-cost">실제 배송비</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">₩</span>
                        <Input
                          id="actual-delivery-cost"
                          type="number"
                          value={actualDeliveryCost}
                          onChange={(e) => setActualDeliveryCost(Number(e.target.value))}
                          placeholder="실제 배송비 입력"
                          className="w-32"
                          min="0"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        입력 시 간편지출에 '배송비'로 자동 등록됩니다.
                      </p>
                    </div>
                    <div className="space-y-3 mt-2 p-3 bg-gray-50 rounded-lg border border-dashed">
                      <div className="space-y-1.5">
                        <Label htmlFor="driver-affiliation" className="text-blue-700 font-bold">배송 업체</Label>
                        <div className="flex flex-col gap-2">
                          <Input
                            id="driver-affiliation"
                            value={driverAffiliation}
                            onChange={(e) => setDriverAffiliation(e.target.value)}
                            placeholder="업체명 직접 입력"
                            className="h-8 text-sm"
                          />
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] px-2 bg-yellow-50 hover:bg-yellow-100 border-yellow-200"
                              onClick={() => setDriverAffiliation('카카오T')}
                            >
                              카카오T
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] px-2 bg-blue-50 hover:bg-blue-100 border-blue-200"
                              onClick={() => setDriverAffiliation('지역업체1')}
                            >
                              지역업체1
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] px-2 bg-purple-50 hover:bg-purple-100 border-purple-200"
                              onClick={() => setDriverAffiliation('지역업체2')}
                            >
                              지역업체2
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="actual-delivery-cost-cash" className="text-red-700 font-bold">기사 현금 결제액 (일일정산 차감)</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-600">₩</span>
                          <Input
                            id="actual-delivery-cost-cash"
                            type="number"
                            value={actualDeliveryCostCash}
                            onChange={(e) => setActualDeliveryCostCash(Number(e.target.value))}
                            placeholder="현금 지급액"
                            className="h-9 font-bold text-red-600 border-red-200 focus-visible:ring-red-500"
                            min="0"
                          />
                        </div>
                        <p className="text-[10px] text-red-500">
                          이 금액은 일일 마감 정산시 현금 시재에서 자동으로 차감됩니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 외부 발주 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                외부 발주 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is-outsourced"
                  checked={formData.outsourceInfo.isOutsourced}
                  onChange={(e) => handleNestedInputChange('outsourceInfo', '', 'isOutsourced', e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="is-outsourced">외부 발주 여부</Label>
              </div>

              {formData.outsourceInfo.isOutsourced && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="outsource-partner">발주 업체명</Label>
                    <Input
                      id="outsource-partner"
                      value={formData.outsourceInfo.partnerName}
                      onChange={(e) => handleNestedInputChange('outsourceInfo', '', 'partnerName', e.target.value)}
                      placeholder="업체명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="outsource-price">발주 금액 (비용)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">₩</span>
                      <Input
                        id="outsource-price"
                        type="number"
                        value={formData.outsourceInfo.partnerPrice}
                        onChange={(e) => handleNestedInputChange('outsourceInfo', '', 'partnerPrice', Number(e.target.value))}
                        placeholder="금액 입력"
                        min="0"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      입력 시 간편지출에 '자재비-외부발주'로 자동 등록/수정됩니다.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 주문 상품 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                주문 상품
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border p-4 rounded-lg">
                  <div className="space-y-2">
                    <Label>상품명</Label>
                    <Input
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      placeholder="상품명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>수량</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>단가</Label>
                    <Input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 text-right">
                      <p className="text-sm font-medium">₩{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                상품 추가
              </Button>
            </CardContent>
          </Card>

          {/* 메시지 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                메시지 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="message-type">메시지 타입</Label>
                  <Select
                    value={formData.message.type}
                    onValueChange={(value) => handleInputChange('message', 'type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">없음</SelectItem>
                      <SelectItem value="card">카드</SelectItem>
                      <SelectItem value="ribbon">리본</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.message.type !== 'none' && (
                  <div className="space-y-2">
                    <Label htmlFor="message-sender">보내는 분</Label>
                    <Input
                      id="message-sender"
                      value={formData.message.sender}
                      onChange={(e) => handleInputChange('message', 'sender', e.target.value)}
                      placeholder="보내는 분을 입력하세요"
                    />
                  </div>
                )}
              </div>
              {formData.message.type !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="message-content">메시지 내용</Label>
                  <Textarea
                    id="message-content"
                    value={formData.message.content}
                    onChange={(e) => handleInputChange('message', 'content', e.target.value)}
                    placeholder="메시지 내용을 입력하세요"
                    rows={4}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 특별 요청사항 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                특별 요청사항
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.specialRequests}
                onChange={(e) => handleInputChange('specialRequests', '', e.target.value)}
                placeholder="특별 요청사항을 입력하세요"
                rows={3}
              />
            </CardContent>
          </Card>

          {/* 주문 상태 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                주문 상태
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order-status">주문 상태</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', '', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="processing">처리중</SelectItem>
                      <SelectItem value="completed">완료</SelectItem>
                      <SelectItem value="canceled">취소</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-status">결제 상태</Label>
                  <Select
                    value={formData.paymentStatus}
                    onValueChange={(value) => handleInputChange('paymentStatus', '', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">미결</SelectItem>
                      <SelectItem value="paid">완결</SelectItem>
                      <SelectItem value="completed">완결</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 결제 방법 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                결제 방법
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>결제 수단</Label>
                <div className="flex flex-row gap-4 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="payment-card"
                      name="paymentMethod"
                      value="card"
                      checked={formData.paymentMethod === 'card'}
                      onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="payment-card">카드</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="payment-cash"
                      name="paymentMethod"
                      value="cash"
                      checked={formData.paymentMethod === 'cash'}
                      onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="payment-cash">현금</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="payment-transfer"
                      name="paymentMethod"
                      value="transfer"
                      checked={formData.paymentMethod === 'transfer'}
                      onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="payment-transfer">계좌이체</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="payment-mainpay"
                      name="paymentMethod"
                      value="mainpay"
                      checked={formData.paymentMethod === 'mainpay'}
                      onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="payment-mainpay">메인페이</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="payment-shopping-mall"
                      name="paymentMethod"
                      value="shopping_mall"
                      checked={formData.paymentMethod === 'shopping_mall'}
                      onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="payment-shopping-mall">쇼핑몰</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="payment-epay"
                      name="paymentMethod"
                      value="epay"
                      checked={formData.paymentMethod === 'epay'}
                      onChange={(e) => handleInputChange('paymentMethod', '', e.target.value)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="payment-epay">이페이</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 주문 요약 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                주문 요약
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">상품 금액</span>
                  <span className="text-sm">₩{totals.subtotal.toLocaleString()}</span>
                </div>

                {/* 할인율 적용 */}
                {totals.discountRate > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span className="text-sm">할인 ({totals.discountRate}%)</span>
                    <span className="text-sm">-₩{totals.discountAmount.toLocaleString()}</span>
                  </div>
                )}

                {/* 포인트 사용 */}
                {totals.pointsUsed > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span className="text-sm">포인트 사용</span>
                    <span className="text-sm">-₩{totals.pointsUsed.toLocaleString()}</span>
                  </div>
                )}

                {/* 배송비 */}
                {totals.deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">배송비</span>
                    <span className="text-sm">₩{totals.deliveryFee.toLocaleString()}</span>
                  </div>
                )}

                <Separator />

                {/* 총 결제금액 */}
                <div className="flex justify-between font-medium">
                  <span>총 결제금액</span>
                  <span>₩{totals.total.toLocaleString()}</span>
                </div>

                {/* 포인트 적립 */}
                {totals.pointsEarned > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span className="text-sm">적립 포인트</span>
                    <span className="text-sm">+{totals.pointsEarned.toLocaleString()} P</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? '저장 중...' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
