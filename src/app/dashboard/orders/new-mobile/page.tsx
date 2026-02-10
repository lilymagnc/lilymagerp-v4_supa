"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Minus, Plus, Trash2, Store, Search, Calendar as CalendarIcon, ChevronRight, User, MapPin, CreditCard, ShoppingBag, X, ChevronUp, ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches, Branch } from "@/hooks/use-branches";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useOrders, OrderData } from "@/hooks/use-orders";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useProducts, Product } from "@/hooks/use-products";
import { useCustomers, Customer } from "@/hooks/use-customers";
import { useAuth } from "@/hooks/use-auth";
import { useDiscountSettings } from "@/hooks/use-discount-settings";
import { supabase } from "@/lib/supabase";
import { debounce } from "lodash";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

// --- TYPES ---
interface OrderItem extends Product {
    quantity: number;
    isCustomProduct?: boolean;
}

type ReceiptType = "store_pickup" | "pickup_reservation" | "delivery_reservation";
type PaymentMethod = "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple";
type PaymentStatus = "pending" | "paid" | "completed" | "split_payment";
type MessageType = "card" | "ribbon" | "none";

declare global {
    interface Window {
        daum: any;
    }
}

// --- UTILS ---
const formatPhoneNumber = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    let result = '';

    if (raw.startsWith('02')) {
        if (raw.length < 3) return raw;
        if (raw.length < 6) result = `${raw.slice(0, 2)}-${raw.slice(2)}`;
        else if (raw.length < 10) result = `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5)}`;
        else result = `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}`;
    } else {
        if (raw.length < 4) return raw;
        if (raw.length < 7) result = `${raw.slice(0, 3)}-${raw.slice(3)}`;
        else if (raw.length < 11) result = `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
        else result = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    }
    return result;
};

// --- SUB-COMPONENTS (Memoized) ---

const BranchSelector = memo(({ isAdmin, branches, selectedBranch, onSelect }: { isAdmin: boolean, branches: Branch[], selectedBranch: Branch | null, onSelect: (b: Branch | null) => void }) => {
    return (
        <div className="bg-white p-4 sticky top-0 z-10 shadow-sm border-b">
            <div className="flex items-center justify-between mb-2">
                <h1 className="font-bold text-lg">모바일 주문접수(Beta)</h1>
            </div>
            {!selectedBranch ? (
                <Select onValueChange={(v) => {
                    const b = branches.find(b => b.id === v);
                    if (b) onSelect(b);
                }}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="지점을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                        {branches.filter(b => b.type !== '본사').map(b => (
                            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            ) : (
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium" onClick={() => isAdmin && onSelect(null)}>
                    <Store className="h-4 w-4" />
                    {selectedBranch.name}
                    {isAdmin && <span className="text-xs text-gray-400 ml-auto">(변경)</span>}
                </div>
            )}
        </div>
    );
});
BranchSelector.displayName = "BranchSelector";

const OrdererSection = memo(({
    ordererName, setOrdererName,
    ordererContact, setOrdererContact,
    ordererCompany, setOrdererCompany,
    selectedCustomer, setSelectedCustomer,
    isRegisterCustomer, setIsRegisterCustomer,
    isAnonymous, setIsAnonymous,
    onOpenSearch
}: any) => {
    return (
        <Card>
            <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex justify-between items-center">
                    주문자 정보
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onOpenSearch}>
                        <Search className="h-3 w-3 mr-1" /> 고객검색
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
                <div>
                    <Label className="text-xs text-muted-foreground">회사명</Label>
                    <Input value={ordererCompany} onChange={e => setOrdererCompany(e.target.value)} className="h-9" placeholder="회사명을 입력하세요" />
                </div>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">이름</Label>
                        <Input value={ordererName} onChange={e => setOrdererName(e.target.value)} className="h-9" />
                    </div>
                    <div className="flex-[1.5]">
                        <Label className="text-xs text-muted-foreground">연락처</Label>
                        <Input value={ordererContact} onChange={e => setOrdererContact(formatPhoneNumber(e.target.value))} type="tel" className="h-9" />
                    </div>
                </div>
                {selectedCustomer && (
                    <div className="bg-green-50 p-2 rounded text-xs text-green-700 flex justify-between">
                        <span>보유 포인트: {selectedCustomer.points?.toLocaleString() ?? 0}P</span>
                        <span className="font-bold cursor-pointer" onClick={() => setSelectedCustomer(null)}>x</span>
                    </div>
                )}
                <div className="flex items-start space-x-2 pt-2">
                    <Checkbox id="register-customer" checked={isRegisterCustomer} onCheckedChange={(c) => setIsRegisterCustomer(!!c)} />
                    <Label htmlFor="register-customer" className="text-[11px] leading-tight font-normal text-muted-foreground pt-0.5">
                        이 주문자 정보를 고객으로 등록/업데이트합니다.<br />(마케팅동의 및 포인트적립 사용 동의)
                    </Label>
                </div>
                <div className="flex items-start space-x-2 pt-2 mt-1 border-t border-dashed">
                    <Checkbox id="is-anonymous" checked={isAnonymous} onCheckedChange={(c) => setIsAnonymous(!!c)} />
                    <div className="grid gap-0.5">
                        <Label htmlFor="is-anonymous" className="text-xs font-medium leading-none pt-0.5">익명으로 보내기</Label>
                        <p className="text-[10px] text-muted-foreground">체크 시 인수증 및 리본/카드에 주문자 이름이 노출되지 않습니다.</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
OrdererSection.displayName = "OrdererSection";

const ProductListSection = memo(({ orderItems, updateQuantity, removeProduct, onOpenProductSheet, disabled }: any) => {
    return (
        <Card>
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">주문 상품</CardTitle>
                <Button size="sm" onClick={onOpenProductSheet} disabled={disabled}>+ 상품 추가</Button>
            </CardHeader>
            <CardContent className="p-4 pt-2">
                {orderItems.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm bg-gray-50 rounded-lg border border-dashed">
                        상품을 추가해주세요
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orderItems.map((item: any, idx: number) => (
                            <div key={item.docId || idx} className="flex items-center justify-between bg-white p-2 rounded border shadow-sm">
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate">{item.name}</div>
                                    <div className="text-xs text-muted-foreground">{item.price.toLocaleString()}원</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.docId, -1)}><Minus className="h-3 w-3" /></Button>
                                    <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                                    <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.docId, 1)}><Plus className="h-3 w-3" /></Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeProduct(item.docId)}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
});
ProductListSection.displayName = "ProductListSection";

const FulfillmentSection = memo(({
    receiptType, setReceiptType,
    scheduleDate, setScheduleDate,
    scheduleTime, setScheduleTime,
    recipientName, setRecipientName,
    recipientContact, setRecipientContact,
    isSameAsOrderer, setIsSameAsOrderer,
    deliveryAddress, setDeliveryAddress,
    deliveryAddressDetail, setDeliveryAddressDetail,
    handleAddressSearch,
    deliveryFeeType, setDeliveryFeeType,
    manualDeliveryFee, setManualDeliveryFee,
    orderSummary,
    selectedDistrict
}: any) => {
    return (
        <Card>
            <Tabs value={receiptType} onValueChange={(v) => setReceiptType(v as ReceiptType)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 p-1">
                    <TabsTrigger value="store_pickup" className="text-xs">매장픽업</TabsTrigger>
                    <TabsTrigger value="pickup_reservation" className="text-xs">픽업예약</TabsTrigger>
                    <TabsTrigger value="delivery_reservation" className="text-xs">배송예약</TabsTrigger>
                </TabsList>
                <div className="p-4 space-y-4">
                    {receiptType !== 'store_pickup' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">날짜</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal h-9", !scheduleDate && "text-muted-foreground")}>
                                            {scheduleDate ? format(scheduleDate, "MM-dd") : <span>선택</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div>
                                <Label className="text-xs">시간</Label>
                                <Select value={scheduleTime} onValueChange={setScheduleTime}>
                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 30 }, (_, i) => {
                                            const h = Math.floor(i / 2) + 9;
                                            const m = i % 2 === 0 ? "00" : "30";
                                            return `${h}:${m}`;
                                        }).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <div className="space-y-3 pt-2 border-t">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">{receiptType === 'delivery_reservation' ? '받는 분' : '수령인 정보'}</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox id="same-as-orderer" checked={isSameAsOrderer} onCheckedChange={(c) => setIsSameAsOrderer(!!c)} />
                                <Label htmlFor="same-as-orderer" className="text-xs font-normal">주문자와 동일</Label>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Input value={recipientName} onChange={e => { setRecipientName(e.target.value); setIsSameAsOrderer(false); }} placeholder="이름" className="h-9 flex-1" />
                            <Input value={recipientContact} onChange={e => { setRecipientContact(formatPhoneNumber(e.target.value)); setIsSameAsOrderer(false); }} type="tel" placeholder="연락처" className="h-9 flex-[1.5]" />
                        </div>
                    </div>
                    {receiptType === 'delivery_reservation' && (
                        <div className="space-y-3 pt-2 border-t">
                            <div>
                                <Label className="text-xs">배송지</Label>
                                <div className="flex gap-2">
                                    <Input value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} placeholder="주소 입력 또는 검색" className="h-9 flex-1 text-xs" />
                                    <Button variant="outline" size="sm" onClick={handleAddressSearch} className="h-9 px-3"><Search className="h-4 w-4" /></Button>
                                </div>
                                <Input value={deliveryAddressDetail} onChange={e => setDeliveryAddressDetail(e.target.value)} placeholder="상세주소" className="mt-2 h-9 text-xs" />
                            </div>
                            <div className="bg-orange-50 p-2 rounded text-xs text-orange-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <span>배송비</span>
                                        {deliveryFeeType === 'auto' && selectedDistrict && <span className="text-[10px] text-orange-600/80">({selectedDistrict})</span>}
                                    </span>
                                    <div className="flex items-center space-x-1">
                                        <Label htmlFor="manual-delivery-fee" className="text-[10px] font-normal cursor-pointer text-orange-700">직접 입력</Label>
                                        <Switch id="manual-delivery-fee" className="scale-75 origin-right" checked={deliveryFeeType === 'manual'} onCheckedChange={(c) => setDeliveryFeeType(c ? 'manual' : 'auto')} />
                                    </div>
                                </div>
                                {deliveryFeeType === 'manual' ? (
                                    <div className="flex justify-end items-center gap-1">
                                        <Input type="number" value={manualDeliveryFee} onChange={e => setManualDeliveryFee(Number(e.target.value))} className="h-8 w-24 text-right bg-white text-orange-900 border-orange-200" />
                                        <span className="font-bold">원</span>
                                    </div>
                                ) : (
                                    <div className="flex justify-end"><span className="font-bold">{orderSummary.deliveryFee.toLocaleString()}원</span></div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Tabs>
        </Card>
    );
});
FulfillmentSection.displayName = "FulfillmentSection";

const MessagePaymentSection = memo(({
    messageType, setMessageType,
    messageContent, setMessageContent,
    recentRibbonMessages, // Added prop
    canApplyDiscount, selectedDiscountRate, setSelectedDiscountRate,
    customDiscountRate, setCustomDiscountRate,
    discountRates, discountAmount,
    selectedCustomer, usedPoints, setUsedPoints,
    orderSummary, handleUseAllPoints,
    paymentMethod, setPaymentMethod,
    paymentStatus, setPaymentStatus
}: any) => {
    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div>
                    <Label className="text-xs font-medium mb-2 block">메시지</Label>
                    <RadioGroup value={messageType} onValueChange={(v) => { setMessageType(v as MessageType); setMessageContent(''); }} className="flex gap-4 mb-2">
                        <div className="flex items-center space-x-2"><RadioGroupItem value="card" id="m1" /><Label htmlFor="m1" className="text-xs">카드</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="ribbon" id="m2" /><Label htmlFor="m2" className="text-xs">리본</Label></div>
                    </RadioGroup>

                    {messageType === 'ribbon' ? (
                        <div className="space-y-2">
                            {recentRibbonMessages.length > 0 && (
                                <Select onValueChange={(val) => {
                                    // Only set content, exclude sender
                                    const selectedMsg = recentRibbonMessages.find((m: any) => m.content === val);
                                    if (selectedMsg) setMessageContent(selectedMsg.content);
                                }}>
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="이전 메시지 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {recentRibbonMessages.map((msg: any, idx: number) => (
                                            <SelectItem key={idx} value={msg.content}>
                                                {msg.content} {msg.sender ? `(To. ${msg.sender})` : ''}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Input
                                placeholder="메시지 / 보내는분 (예: 축결혼 / 홍길동)"
                                className="h-9 text-sm"
                                value={messageContent}
                                onChange={e => setMessageContent(e.target.value)}
                            />
                            <p className="text-[10px] text-muted-foreground">* 메시지와 보내는 분을 '/' 로 구분해서 입력하세요.</p>
                        </div>
                    ) : (
                        <Textarea
                            placeholder="카드에 들어갈 내용을 자유롭게 입력하세요."
                            className="h-20 text-sm"
                            value={messageContent}
                            onChange={e => setMessageContent(e.target.value)}
                        />
                    )}
                </div>
                <Separator />
                {canApplyDiscount && (
                    <div>
                        <Label className="text-xs font-medium mb-2 block">할인 적용</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {discountRates.map((rate: any) => (
                                <Button key={rate.rate} variant={selectedDiscountRate === rate.rate ? "default" : "outline"} size="sm" onClick={() => { setSelectedDiscountRate(rate.rate); setCustomDiscountRate(0); }} className="text-xs h-8">
                                    {rate.label}
                                </Button>
                            ))}
                            <div className="flex items-center gap-1 border rounded px-2 bg-white">
                                <Input type="number" placeholder="직접" className="border-0 h-8 w-12 text-center p-0 text-xs focus-visible:ring-0" value={customDiscountRate || ''} onChange={(e) => { const val = Number(e.target.value); setCustomDiscountRate(val); if (val > 0) setSelectedDiscountRate(0); }} />
                                <span className="text-xs text-muted-foreground">%</span>
                            </div>
                        </div>
                        {discountAmount > 0 && <div className="text-right text-xs text-green-600 font-bold mb-2">-{discountAmount.toLocaleString()}원 할인</div>}
                    </div>
                )}
                <Separator />
                {selectedCustomer && (
                    <div>
                        <Label className="text-xs font-medium mb-2 flex justify-between">포인트 사용 <span className="text-muted-foreground font-normal">보유: {selectedCustomer.points?.toLocaleString() ?? 0}P</span></Label>
                        <div className="flex gap-2">
                            <Input type="number" value={usedPoints || ''} onChange={(e) => setUsedPoints(Number(e.target.value))} placeholder="사용 포인트" className="h-9 text-right" />
                            <Button variant="outline" size="sm" onClick={handleUseAllPoints} className="whitespace-nowrap h-9">전액사용</Button>
                        </div>
                        {!orderSummary.canUsePoints && selectedCustomer.points > 0 && <p className="text-[10px] text-amber-600 mt-1">※ 5,000원 이상 결제 시 사용 가능</p>}
                    </div>
                )}
                <Separator />
                <div>
                    <Label className="text-xs font-medium mb-2 block">결제 수단</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {["card", "cash", "transfer", "shopping_mall"].map((m) => (
                            <div key={m} className={cn("border rounded p-2 text-center text-xs font-medium cursor-pointer transition-colors px-1", paymentMethod === m ? "bg-primary text-white border-primary" : "bg-white hover:bg-gray-50")} onClick={() => setPaymentMethod(m as PaymentMethod)}>
                                {m === 'card' ? '카드' : m === 'cash' ? '현금' : m === 'transfer' ? '이체' : '쇼핑몰'}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                        {["mainpay", "epay", "kakao", "apple"].map((m) => (
                            <div key={m} className={cn("border rounded p-2 text-center text-xs font-medium cursor-pointer transition-colors px-1", paymentMethod === m ? "bg-primary text-white border-primary" : "bg-white hover:bg-gray-50")} onClick={() => setPaymentMethod(m as PaymentMethod)}>
                                {m === 'mainpay' ? '메인' : m === 'epay' ? '이페이' : m === 'kakao' ? '카카오' : '애플'}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex justify-between items-center bg-gray-100 p-2 rounded">
                    <span className="text-xs">결제 상태</span>
                    <Switch checked={paymentStatus === 'paid'} onCheckedChange={(c) => setPaymentStatus(c ? 'paid' : 'pending')} />
                    <span className={cn("text-xs font-bold", paymentStatus === 'paid' ? "text-green-600" : "text-gray-500")}>
                        {paymentStatus === 'paid' ? '결제완료' : '미수금'}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
});
MessagePaymentSection.displayName = "MessagePaymentSection";

// --- CUSTOMER SEARCH SHEET ---
const CustomerSearchSheet = memo(({ open, onOpenChange, onSelect, customers }: any) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Customer[]>([]);

    const handleSearch = useCallback(debounce((query: string) => {
        if (query.length < 2) { setSearchResults([]); return; }
        const searchTerm = query.toLowerCase();
        const filtered = customers.filter((c: any) =>
            c.name.toLowerCase().includes(searchTerm) ||
            c.contact.includes(searchTerm) ||
            c.companyName?.toLowerCase().includes(searchTerm)
        );
        setSearchResults(filtered);
    }, 300), [customers]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0 rounded-t-xl">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle>고객 검색</SheetTitle>
                    <SheetDescription>
                        이름, 전화번호 또는 회사명으로 고객을 검색할 수 있습니다.
                    </SheetDescription>
                    <Input
                        placeholder="이름, 전화번호 또는 회사명 검색"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearch(e.target.value);
                        }}
                        className="mt-2"
                    />
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                    {searchResults.map(c => (
                        <div key={c.id} className="py-2 border-b flex justify-between items-center" onClick={() => { onSelect(c); onOpenChange(false); }}>
                            <div>
                                <div className="font-bold text-sm">
                                    {c.name}
                                    {c.companyName && <span className="text-xs text-muted-foreground ml-1">({c.companyName})</span>}
                                </div>
                                <div className="text-xs text-gray-500">{c.contact}</div>
                            </div>
                            <Badge variant="outline" className="text-xs">{c.points?.toLocaleString() ?? 0}P</Badge>
                        </div>
                    ))}
                    {searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-sm">검색 결과가 없습니다</div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
});
CustomerSearchSheet.displayName = "CustomerSearchSheet";

// --- PRODUCT SELECTION SHEET ---
const ProductSelectionSheet = memo(({ open, onOpenChange, categorizedProducts, onAddProduct, orderItems, onOpenCustomProduct }: any) => {
    const [activeTab, setActiveTab] = useState(Object.keys(categorizedProducts)[0] || "");
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const keys = Object.keys(categorizedProducts);
        if (keys.length > 0 && (!activeTab || !keys.includes(activeTab))) {
            setActiveTab(keys[0]);
        }
    }, [categorizedProducts, activeTab]);

    const getProductQuantity = (docId: string) => {
        return orderItems.find((item: any) => item.docId === docId)?.quantity || 0;
    };

    const subtotal = orderItems.reduce((acc: number, i: any) => acc + (i.price * i.quantity), 0);

    const filteredCategorizedProducts = useMemo(() => {
        const result: any = {};
        Object.keys(categorizedProducts).forEach(key => {
            const products = categorizedProducts[key];
            if (!searchTerm.trim()) {
                result[key] = products;
            } else {
                result[key] = products.filter((p: any) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
            }
        });
        return result;
    }, [categorizedProducts, searchTerm]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0 rounded-t-xl">
                <SheetHeader className="p-4 border-b flex flex-row items-center justify-between">
                    <div>
                        <SheetTitle>상품 선택</SheetTitle>
                        <SheetDescription className="text-xs text-muted-foreground">
                            카테고리별 상품을 선택하여 주문에 추가할 수 있습니다.
                        </SheetDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={onOpenCustomProduct}>직접 입력</Button>
                </SheetHeader>
                <div className="px-4 pt-2">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="상품 검색..."
                            className="pl-8 h-9 text-sm bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="mx-4 mt-2 overflow-x-auto no-scrollbar">
                        <TabsList className="inline-flex w-max min-w-full p-1 h-10">
                            {Object.keys(categorizedProducts).map(cat => (
                                <TabsTrigger key={cat} value={cat} className="px-4 text-xs whitespace-nowrap">
                                    {cat}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {Object.entries(filteredCategorizedProducts).map(([key, products]) => (
                            <TabsContent key={key} value={key} className="mt-0 grid grid-cols-2 gap-2">
                                {(products as any[]).map(p => {
                                    const qty = getProductQuantity(p.docId);
                                    return (
                                        <div key={p.docId} className={cn("p-2 border rounded-lg relative cursor-pointer", qty > 0 ? "border-blue-500 bg-blue-50" : "bg-white")} onClick={() => onAddProduct(p)}>
                                            {qty > 0 && <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center">{qty}</Badge>}
                                            <div className="text-sm font-semibold truncate">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.price.toLocaleString()}원</div>
                                        </div>
                                    );
                                })}
                            </TabsContent>
                        ))}
                    </div>
                </Tabs>
                <div className="p-4 border-t bg-white safe-area-bottom">
                    <Button className="w-full" onClick={() => onOpenChange(false)}>
                        선택 완료 (합계: {subtotal.toLocaleString()}원)
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
});
ProductSelectionSheet.displayName = "ProductSelectionSheet";

// --- MAIN PAGE ---

export default function NewOrderMobilePage() {
    const { user } = useAuth();
    const { branches, loading: branchesLoading } = useBranches();
    const { products: allProducts, loading: productsLoading, fetchProducts } = useProducts();
    const { addOrder } = useOrders();
    const { findCustomersByContact, customers } = useCustomers();
    const { discountSettings, canApplyDiscount, getActiveDiscountRates } = useDiscountSettings();
    const { toast } = useToast();
    const router = useRouter();

    // 지점이 선택되면 해당 지점의 상품 목록을 가져옴


    // --- STATE ---
    const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

    // 지점이 선택되면 해당 지점의 상품 목록을 가져옴
    useEffect(() => {
        if (selectedBranch) {
            fetchProducts({ branch: selectedBranch.name, pageSize: 1000 });
        }
    }, [selectedBranch, fetchProducts]);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

    // Orderer
    const [ordererName, setOrdererName] = useState("");
    const [ordererContact, setOrdererContact] = useState("");
    const [ordererCompany, setOrdererCompany] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isRegisterCustomer, setIsRegisterCustomer] = useState(true);

    const applyLastOrderPreferences = useCallback(async (contact: string, company?: string) => {
        try {
            if (!contact && (!company || !company.trim())) return;

            let query = supabase
                .from('orders')
                .select('payment')
                .order('order_date', { ascending: false })
                .limit(1);

            if (company && company.trim()) {
                query = query.eq('orderer->>company', company.trim());
            } else {
                query = query.eq('orderer->>contact', contact);
            }

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const lastOrder = data[0];
                if (lastOrder.payment) {
                    const payment = lastOrder.payment as any;
                    if (payment.method) setPaymentMethod(payment.method as PaymentMethod);
                    if (payment.status) setPaymentStatus(payment.status as PaymentStatus);
                }
            }
        } catch (error) {
            console.error("Error applying last order preferences:", error);
        }
    }, []);

    // Fulfillment
    const [receiptType, setReceiptType] = useState<ReceiptType>("store_pickup");
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(new Date());
    const [scheduleTime, setScheduleTime] = useState("10:00");
    const [recipientName, setRecipientName] = useState("");
    const [recipientContact, setRecipientContact] = useState("");
    const [isSameAsOrderer, setIsSameAsOrderer] = useState(true);
    const [deliveryAddress, setDeliveryAddress] = useState("");
    const [deliveryAddressDetail, setDeliveryAddressDetail] = useState("");
    const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
    const [manualDeliveryFee, setManualDeliveryFee] = useState(0);
    const [deliveryFeeType, setDeliveryFeeType] = useState<"auto" | "manual">("auto");

    // Message & Payment
    const [messageType, setMessageType] = useState<MessageType>("card");
    const [messageContent, setMessageContent] = useState("");
    const [recentRibbonMessages, setRecentRibbonMessages] = useState<{ sender: string; content: string }[]>([]);

    useEffect(() => {
        const fetchRecentRibbonMessages = async () => {
            if (messageType !== 'ribbon' || !selectedCustomer || !selectedCustomer.contact) {
                setRecentRibbonMessages([]);
                return;
            }
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('message, orderer')
                    .eq('orderer->>contact', selectedCustomer.contact)
                    .eq('message->>type', 'ribbon')
                    .order('order_date', { ascending: false })
                    .limit(10);

                if (error) throw error;

                const messages: { sender: string; content: string }[] = [];
                const seen = new Set<string>();
                (data || []).forEach(row => {
                    const msg = row.message as any;
                    const orderer = row.orderer as any;
                    if (msg?.content) {
                        const sender = msg.sender || orderer.name || '';
                        const content = msg.content;
                        const key = `${sender}|${content}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            messages.push({ sender, content });
                        }
                    }
                });
                setRecentRibbonMessages(messages.slice(0, 5));
            } catch (error) {
                console.error("Error fetching ribbon history:", error);
            }
        };
        fetchRecentRibbonMessages();
    }, [messageType, selectedCustomer]);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
    const [selectedDiscountRate, setSelectedDiscountRate] = useState<number>(0);
    const [customDiscountRate, setCustomDiscountRate] = useState<number>(0);
    const [usedPoints, setUsedPoints] = useState(0);

    // UI State
    const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
    const [isCustomerSheetOpen, setIsCustomerSheetOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSummaryOpen, setIsSummaryOpen] = useState(false);

    const [isCustomProductDialogOpen, setIsCustomProductDialogOpen] = useState(false);
    const [customProductName, setCustomProductName] = useState("");
    const [customProductPrice, setCustomProductPrice] = useState("");
    const [customProductQuantity, setCustomProductQuantity] = useState(1);

    // --- LOGIC ---
    const isAdmin = user?.role === '본사 관리자';
    const userBranch = user?.franchise;

    useEffect(() => {
        if (!isAdmin && userBranch && !selectedBranch && branches.length > 0) {
            const b = branches.find(b => b.name === userBranch);
            if (b) setSelectedBranch(b);
        }
    }, [isAdmin, userBranch, selectedBranch, branches]);

    useEffect(() => {
        if (isSameAsOrderer) {
            setRecipientName(ordererName);
            setRecipientContact(ordererContact);
        }
    }, [isSameAsOrderer, ordererName, ordererContact]);

    useEffect(() => {
        if (receiptType === 'delivery_reservation') {
            setIsSameAsOrderer(false);
            setRecipientName("");
            setRecipientContact("");
        }
    }, [receiptType]);

    useEffect(() => {
        if (receiptType === 'delivery_reservation' && deliveryAddress && selectedBranch?.deliveryFees) {
            const matched = selectedBranch.deliveryFees.find(df => df.district !== '기타' && deliveryAddress.includes(df.district));
            if (matched) { setSelectedDistrict(matched.district); setDeliveryFeeType('auto'); }
        }
    }, [deliveryAddress, selectedBranch, receiptType]);

    const orderSummary = useMemo(() => {
        const subtotal = orderItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
        const rate = selectedDiscountRate > 0 ? selectedDiscountRate : customDiscountRate;
        const discountAmount = Math.floor(subtotal * (rate / 100));
        let deliveryFee = 0;
        if (receiptType === 'delivery_reservation') {
            if (deliveryFeeType === 'manual') deliveryFee = manualDeliveryFee;
            else if (selectedBranch && selectedDistrict) {
                const feeInfo = selectedBranch.deliveryFees?.find(df => df.district === selectedDistrict);
                deliveryFee = feeInfo ? feeInfo.fee : (selectedBranch.deliveryFees?.find(df => df.district === "기타")?.fee ?? 0);
            }
        }
        const discountedSubtotal = subtotal - discountAmount;
        const maxUsablePoints = selectedCustomer && discountedSubtotal >= 5000 ? Math.min(selectedCustomer.points || 0, discountedSubtotal) : 0;
        const actualUsedPoints = Math.min(usedPoints, maxUsablePoints);
        const finalTotal = discountedSubtotal + deliveryFee - actualUsedPoints;
        const canApply = selectedBranch ? canApplyDiscount(selectedBranch.id, subtotal) : false;
        return { subtotal, discountAmount, discountRate: rate, deliveryFee, finalTotal, maxUsablePoints, actualUsedPoints, canUsePoints: discountedSubtotal >= 5000, canApply };
    }, [orderItems, selectedDiscountRate, customDiscountRate, receiptType, deliveryFeeType, manualDeliveryFee, selectedBranch, selectedDistrict, usedPoints, selectedCustomer, canApplyDiscount]);

    const branchProducts = useMemo(() => {
        if (!selectedBranch) return [];
        return allProducts.filter(p => p.branch === selectedBranch.name);
    }, [allProducts, selectedBranch]);

    const categorizedProducts = useMemo(() => {
        const priority = ['꽃다발', '꽃바구니', '센터피스', '플랜트', '동서양란', '화환', '자재'];
        const sortedGroups: Record<string, any[]> = {};

        const getMatch = (p: any, cat: string) => {
            const mCat = p.mainCategory || "";
            const midCat = p.midCategory || "";
            const name = p.name || "";

            if (cat === '화환') return mCat.includes('화환') || midCat.includes('화환') || name.includes('화환') || name.includes('근조') || name.includes('축하');
            if (cat === '동서양란') return mCat.includes('란') || midCat.includes('란') || name.includes('란') || mCat.includes('난') || midCat.includes('난') || name.includes('난') || name.includes('동양란') || name.includes('서양란') || name.includes('호접란');
            if (cat === '플랜트') return mCat.includes('플랜트') || mCat.includes('관엽') || mCat.includes('공기정화');

            return mCat.includes(cat) || midCat.includes(cat) || name.includes(cat);
        };

        priority.forEach(cat => {
            const products = branchProducts.filter(p => getMatch(p, cat));
            if (products.length > 0) {
                sortedGroups[cat] = products;
            }
        });

        return sortedGroups;
    }, [branchProducts]);


    // --- HANDLERS ---
    const handleUpdateQuantity = useCallback((docId: string, delta: number) => {
        setOrderItems(prev => prev.map(item => item.docId === docId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
    }, []);

    const handleRemoveProduct = useCallback((docId: string) => {
        setOrderItems(prev => prev.filter(i => i.docId !== docId));
    }, []);

    const handleAddProduct = useCallback((product: Product) => {
        setOrderItems(prev => {
            const existing = prev.find(i => i.docId === product.docId);
            if (existing) return prev.map(i => i.docId === product.docId ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...product, quantity: 1 }];
        });
    }, []);

    const handleAddressSearch = () => {
        if (window.daum && window.daum.Postcode) {
            new window.daum.Postcode({
                oncomplete: (data: any) => {
                    let full = data.address;
                    if (data.addressType === 'R') {
                        let extra = '';
                        if (data.bname !== '') extra += data.bname;
                        if (data.buildingName !== '') extra += (extra !== '' ? `, ${data.buildingName}` : data.buildingName);
                        full += (extra !== '' ? ` (${extra})` : '');
                    }
                    setDeliveryAddress(full); setDeliveryAddressDetail('');
                    const district = data.sigungu;
                    if (selectedBranch?.deliveryFees?.some(df => df.district === district)) { setSelectedDistrict(district); setDeliveryFeeType('auto'); }
                    else setSelectedDistrict("기타");
                }
            }).open();
        }
    };

    const handleSubmit = async () => {
        if (!selectedBranch) return toast({ variant: 'destructive', title: "지점 선택 필요" });
        if (orderItems.length === 0) return toast({ variant: 'destructive', title: "상품을 담아주세요" });
        setIsSubmitting(true);
        try {
            const orderPayload: OrderData = {
                branchId: selectedBranch.id, branchName: selectedBranch.name, orderDate: new Date(), status: 'processing', orderType: 'store', receiptType, items: orderItems,
                summary: { subtotal: orderSummary.subtotal, discountAmount: orderSummary.discountAmount, discountRate: orderSummary.discountRate, deliveryFee: orderSummary.deliveryFee, pointsUsed: orderSummary.actualUsedPoints, pointsEarned: 0, total: orderSummary.finalTotal },
                orderer: { id: selectedCustomer?.id || "", name: ordererName, contact: ordererContact, company: ordererCompany, email: "" },
                isAnonymous, registerCustomer: isRegisterCustomer,
                payment: { method: paymentMethod, status: paymentStatus, completedAt: (paymentStatus === 'paid' || paymentStatus === 'completed') ? new Date().toISOString() : undefined, isSplitPayment: false },
                pickupInfo: (receiptType !== 'delivery_reservation') ? { date: scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : '', time: scheduleTime, pickerName: recipientName || ordererName, pickerContact: recipientContact || ordererContact } : null,
                deliveryInfo: receiptType === 'delivery_reservation' ? { date: scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : '', time: scheduleTime, recipientName, recipientContact, address: `${deliveryAddress} ${deliveryAddressDetail}`, district: selectedDistrict || '' } : null,
                message: messageType !== 'none' ? (
                    messageType === 'ribbon' ? (() => {
                        const parts = messageContent.split('/');
                        const content = parts[0].trim();
                        const sender = parts.length > 1 ? parts.slice(1).join('/').trim() : ""; // Fallback to orderer name in backend? Desktop does: `const sender = parts.length > 1 ? parts.slice(1).join('/').trim() : ordererName;`
                        // Let's match desktop payload construction if possible. 
                        // In desktop `handleCompleteOrder`:
                        /*
                         if (messageType === 'ribbon') {
                            const parts = messageContent.split('/');
                            finalMessageContent = parts[0].trim();
                            // If sender is empty, use orderer name
                            finalMessageSender = parts.length > 1 && parts[1].trim() !== '' 
                                ? parts.slice(1).join('/').trim() 
                                : ordererName;
                        }
                        */
                        const finalSender = sender || ordererName;
                        return { type: messageType, content: content, sender: finalSender };
                    })() : { type: messageType, content: messageContent } // Card: content is full text
                ) : null,
                request: ""
            };
            await addOrder(orderPayload);
            toast({ title: "주문 접수 완료!" });
            router.push('/dashboard/orders');
        } catch (e) {
            toast({ variant: 'destructive', title: "주문 실패" });
        } finally { setIsSubmitting(false); }
    };

    return (
        <div className="pb-32 bg-gray-50 min-h-screen">
            <BranchSelector isAdmin={isAdmin} branches={branches} selectedBranch={selectedBranch} onSelect={setSelectedBranch} />

            <div className="p-4 space-y-4">
                <OrdererSection
                    ordererName={ordererName} setOrdererName={setOrdererName}
                    ordererContact={ordererContact} setOrdererContact={setOrdererContact}
                    ordererCompany={ordererCompany} setOrdererCompany={setOrdererCompany}
                    selectedCustomer={selectedCustomer} setSelectedCustomer={setSelectedCustomer}
                    isRegisterCustomer={isRegisterCustomer} setIsRegisterCustomer={setIsRegisterCustomer}
                    isAnonymous={isAnonymous} setIsAnonymous={setIsAnonymous}
                    onOpenSearch={() => setIsCustomerSheetOpen(true)}
                />

                <ProductListSection
                    orderItems={orderItems}
                    updateQuantity={handleUpdateQuantity}
                    removeProduct={handleRemoveProduct}
                    onOpenProductSheet={() => setIsProductSheetOpen(true)}
                    disabled={!selectedBranch}
                />

                <FulfillmentSection
                    receiptType={receiptType} setReceiptType={setReceiptType}
                    scheduleDate={scheduleDate} setScheduleDate={setScheduleDate}
                    scheduleTime={scheduleTime} setScheduleTime={setScheduleTime}
                    recipientName={recipientName} setRecipientName={setRecipientName}
                    recipientContact={recipientContact} setRecipientContact={setRecipientContact}
                    isSameAsOrderer={isSameAsOrderer} setIsSameAsOrderer={setIsSameAsOrderer}
                    deliveryAddress={deliveryAddress} setDeliveryAddress={setDeliveryAddress}
                    deliveryAddressDetail={deliveryAddressDetail} setDeliveryAddressDetail={setDeliveryAddressDetail}
                    handleAddressSearch={handleAddressSearch}
                    deliveryFeeType={deliveryFeeType} setDeliveryFeeType={setDeliveryFeeType}
                    manualDeliveryFee={manualDeliveryFee} setManualDeliveryFee={setManualDeliveryFee}
                    orderSummary={orderSummary}
                    selectedDistrict={selectedDistrict}
                />

                <MessagePaymentSection
                    messageType={messageType} setMessageType={setMessageType}
                    messageContent={messageContent} setMessageContent={setMessageContent}
                    recentRibbonMessages={recentRibbonMessages}
                    canApplyDiscount={orderSummary.canApply}
                    selectedDiscountRate={selectedDiscountRate} setSelectedDiscountRate={setSelectedDiscountRate}
                    customDiscountRate={customDiscountRate} setCustomDiscountRate={setCustomDiscountRate}
                    discountRates={selectedBranch ? getActiveDiscountRates(selectedBranch.id) : []}
                    discountAmount={orderSummary.discountAmount}
                    selectedCustomer={selectedCustomer}
                    usedPoints={usedPoints} setUsedPoints={setUsedPoints}
                    orderSummary={orderSummary}
                    handleUseAllPoints={() => setUsedPoints(orderSummary.maxUsablePoints)}
                    paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                    paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus}
                />
            </div>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-20 safe-area-bottom shadow-lg">
                <div className="flex justify-center items-center py-1 cursor-pointer" onClick={() => setIsSummaryOpen(!isSummaryOpen)}>
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>
                <div className={cn("overflow-hidden transition-all duration-300 px-4", isSummaryOpen ? "max-h-[50vh] overflow-y-auto py-2" : "max-h-0")}>
                    <div className="space-y-1 text-xs text-gray-600 pb-2">
                        {orderItems.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                                <span>{item.name} x{item.quantity}</span>
                                <span>{(item.price * item.quantity).toLocaleString()}원</span>
                            </div>
                        ))}
                        <Separator className="my-1" />
                        <div className="flex justify-between"><span>합계</span><span>{orderSummary.subtotal.toLocaleString()}원</span></div>
                        {orderSummary.deliveryFee > 0 && <div className="flex justify-between"><span>배송비</span><span>+{orderSummary.deliveryFee.toLocaleString()}원</span></div>}
                        {orderSummary.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>할인</span><span>-{orderSummary.discountAmount.toLocaleString()}원</span></div>}
                        {orderSummary.actualUsedPoints > 0 && <div className="flex justify-between text-blue-600"><span>포인트</span><span>-{orderSummary.actualUsedPoints.toLocaleString()}원</span></div>}
                    </div>
                </div>
                <div className="p-4 pt-0 bg-white">
                    <div className="flex justify-between items-center mb-2" onClick={() => setIsSummaryOpen(!isSummaryOpen)}>
                        <div className="flex items-center gap-1 text-xs font-medium text-gray-500">
                            총 결제금액 {isSummaryOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                        </div>
                        <span className="text-lg font-bold text-primary">{orderSummary.finalTotal.toLocaleString()}원</span>
                    </div>
                    <Button className="w-full h-11 font-bold" onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "처리중..." : "주문 접수하기"}</Button>
                </div>
            </div>

            {/* Customer Search Sheet */}
            <CustomerSearchSheet
                open={isCustomerSheetOpen}
                onOpenChange={setIsCustomerSheetOpen}
                onSelect={(c: Customer) => {
                    setSelectedCustomer(c);
                    setOrdererName(c.name);
                    setOrdererContact(c.contact);
                    setOrdererCompany(c.companyName || "");
                    applyLastOrderPreferences(c.contact, c.companyName);
                }}
                customers={customers}
            />

            {/* Product Selection Sheet */}
            <ProductSelectionSheet
                open={isProductSheetOpen}
                onOpenChange={setIsProductSheetOpen}
                categorizedProducts={categorizedProducts}
                onAddProduct={handleAddProduct}
                orderItems={orderItems}
                onOpenCustomProduct={() => setIsCustomProductDialogOpen(true)}
            />

            {/* Custom Product Dialog */}
            <Dialog open={isCustomProductDialogOpen} onOpenChange={setIsCustomProductDialogOpen}>
                <DialogContent className="max-w-xs">
                    <DialogHeader>
                        <DialogTitle>수동 상품 추가</DialogTitle>
                        <DialogDescription>
                            등록되지 않은 상품을 직접 입력하여 추가합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Label className="text-xs">상품명</Label>
                        <Input value={customProductName} onChange={e => setCustomProductName(e.target.value)} />
                        <Label className="text-xs">가격</Label>
                        <Input type="number" value={customProductPrice} onChange={e => setCustomProductPrice(e.target.value)} />
                        <Label className="text-xs">수량</Label>
                        <Input type="number" value={customProductQuantity} onChange={e => setCustomProductQuantity(Number(e.target.value))} />
                    </div>
                    <DialogFooter><Button onClick={() => {
                        const price = parseInt(customProductPrice) || 0;
                        const newItem = { docId: `custom-${Date.now()}`, name: customProductName, price, quantity: customProductQuantity, isCustomProduct: true } as any;
                        setOrderItems(prev => [...prev, newItem]);
                        setCustomProductName(""); setCustomProductPrice(""); setCustomProductQuantity(1); setIsCustomProductDialogOpen(false);
                    }}>추가하기</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
