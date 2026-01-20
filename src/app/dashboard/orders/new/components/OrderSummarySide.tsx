import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, MinusCircle, PlusCircle, CreditCard, Coins, Smartphone, Globe, Banknote, CheckCircle2, Circle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Product } from "@/hooks/use-products";
// Remove OrderItem import from use-orders as it may not exist there
// import { OrderItem } from "@/hooks/use-orders"; 

interface OrderItem extends Product {
    quantity: number;
    isCustomProduct?: boolean;
}

type PaymentMethod = "card" | "cash" | "transfer" | "mainpay" | "shopping_mall" | "epay" | "kakao" | "apple";
type PaymentStatus = "pending" | "paid" | "completed" | "split_payment";

interface OrderSummarySideProps {
    orderItems: any[]; // Using any to avoid circular deps if types not shared, but better to import OrderItem
    setOrderItems: React.Dispatch<React.SetStateAction<any[]>>;

    // Financials
    orderSummary: {
        subtotal: number;
        discountAmount: number;
        deliveryFee: number;
        pointsUsed: number;
        total: number;
        vat: number;
        supplyPrice: number;
    };

    // Discount & Points
    discountSettings: any; // Type from useDiscountSettings
    activeDiscountRates: any[]; // List of active discount rates
    selectedDiscountRate: number;
    setSelectedDiscountRate: (rate: number) => void;
    customDiscountRate: number;
    setCustomDiscountRate: (rate: number) => void;
    usedPoints: number;
    setUsedPoints: (points: number) => void;
    maxPoints: number; // Customer's available points

    // Delivery Fee Logic
    deliveryFeeType: "auto" | "manual";
    setDeliveryFeeType: (type: "auto" | "manual") => void;
    manualDeliveryFee: number;
    setManualDeliveryFee: (fee: number) => void;

    // Payment
    paymentMethod: PaymentMethod;
    setPaymentMethod: (method: PaymentMethod) => void;
    paymentStatus: PaymentStatus;
    setPaymentStatus: (status: PaymentStatus) => void;

    // Split Payment
    isSplitPaymentEnabled: boolean;
    setIsSplitPaymentEnabled: (enabled: boolean) => void;
    firstPaymentAmount: number;
    setFirstPaymentAmount: (amount: number) => void;
    firstPaymentMethod: PaymentMethod;
    setFirstPaymentMethod: (method: PaymentMethod) => void;
    secondPaymentMethod: PaymentMethod;
    setSecondPaymentMethod: (method: PaymentMethod) => void;

    // Actions
    onSubmit: () => void;
    isSubmitting: boolean;
}

export function OrderSummarySide({
    orderItems,
    setOrderItems,
    orderSummary,
    discountSettings,
    activeDiscountRates,
    selectedDiscountRate,
    setSelectedDiscountRate,
    customDiscountRate,
    setCustomDiscountRate,
    usedPoints,
    setUsedPoints,
    maxPoints,
    deliveryFeeType,
    setDeliveryFeeType,
    manualDeliveryFee,
    setManualDeliveryFee,
    paymentMethod,
    setPaymentMethod,
    paymentStatus,
    setPaymentStatus,
    isSplitPaymentEnabled,
    setIsSplitPaymentEnabled,
    firstPaymentAmount,
    setFirstPaymentAmount,
    firstPaymentMethod,
    setFirstPaymentMethod,
    secondPaymentMethod,
    setSecondPaymentMethod,
    onSubmit,
    isSubmitting
}: OrderSummarySideProps) {

    const updateQuantity = (index: number, delta: number) => {
        const newItems = [...orderItems];
        newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
        setOrderItems(newItems);
    };

    const removeItem = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: any }[] = [
        { value: "card", label: "카드", icon: CreditCard },
        { value: "cash", label: "현금", icon: Banknote },
        { value: "transfer", label: "계좌이체", icon: Coins },
        { value: "mainpay", label: "메인페이", icon: Smartphone },
        { value: "shopping_mall", label: "쇼핑몰", icon: Globe },
        { value: "epay", label: "e-Pay", icon: Smartphone },
        { value: "kakao", label: "카카오페이", icon: Smartphone },
        { value: "apple", label: "애플페이", icon: Smartphone },
    ];

    return (
        <Card className="h-[calc(100vh-2rem)] flex flex-col sticky top-4">
            <CardHeader className="pb-2 bg-muted/30">
                <CardTitle>결제 금액</CardTitle>
            </CardHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* 1. Order Items List */}
                <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">주문 상품</h4>
                    {orderItems.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                            선택된 상품이 없습니다.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {orderItems.map((item, index) => (
                                <div key={`${item.id}-${index}`} className="flex items-start justify-between bg-white p-3 rounded-md border shadow-sm">
                                    <div className="flex-1 min-w-0 mr-2">
                                        <div className="font-medium text-sm truncate">{item.name}</div>
                                        <div className="text-xs text-muted-foreground">{item.price.toLocaleString()}원</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center border rounded-md">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(index, -1)}>
                                                <MinusCircle className="h-3 w-3" />
                                            </Button>
                                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(index, 1)}>
                                                <PlusCircle className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeItem(index)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Separator />

                {/* 2. Discount & Points */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>할인 적용</Label>
                        <Select
                            value={selectedDiscountRate === -1 ? "custom" : selectedDiscountRate.toString()}
                            onValueChange={(val) => {
                                if (val === 'custom') setSelectedDiscountRate(-1); // -1 for custom
                                else setSelectedDiscountRate(Number(val));
                            }}
                        >
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue placeholder="할인 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">적용 안함</SelectItem>
                                {(activeDiscountRates || []).map((rate: any) => (
                                    <SelectItem key={rate.rate} value={rate.rate.toString()}>
                                        {rate.label || `${rate.rate}%`}
                                    </SelectItem>
                                ))}
                                {/* Use rate.label if available, or just rate% */}
                                <SelectItem value="custom">직접 입력</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedDiscountRate === -1 && (
                        <Input
                            type="number"
                            placeholder="할인율(%)"
                            value={customDiscountRate}
                            onChange={(e) => setCustomDiscountRate(Number(e.target.value))}
                            className="mt-2 text-right"
                        />
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>배송비 설정</Label>
                            <div className="flex items-center space-x-2">
                                <span className={cn("text-xs", deliveryFeeType === 'auto' ? "font-bold" : "text-muted-foreground")}>자동</span>
                                <Switch
                                    checked={deliveryFeeType === 'manual'}
                                    onCheckedChange={(checked) => setDeliveryFeeType(checked ? 'manual' : 'auto')}
                                />
                                <span className={cn("text-xs", deliveryFeeType === 'manual' ? "font-bold" : "text-muted-foreground")}>수동</span>
                            </div>
                        </div>
                        {deliveryFeeType === 'manual' && (
                            <Input
                                type="number"
                                placeholder="배송비 입력"
                                value={manualDeliveryFee}
                                onChange={(e) => setManualDeliveryFee(Number(e.target.value))}
                                className="text-right"
                            />
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            <span>포인트 사용</span>
                            <span className="text-xs text-muted-foreground font-normal">보유: {maxPoints?.toLocaleString()} P</span>
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                value={usedPoints}
                                onChange={(e) => setUsedPoints(Math.min(maxPoints, Number(e.target.value)))}
                                className="text-right"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setUsedPoints(maxPoints)}
                            >전액</Button>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* 3. Payment Method */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <Label>결제 수단</Label>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="splitPay"
                                checked={isSplitPaymentEnabled}
                                onCheckedChange={(c) => setIsSplitPaymentEnabled(c as boolean)}
                            />
                            <Label htmlFor="splitPay" className="text-xs font-normal cursor-pointer">복합 결제</Label>
                        </div>
                    </div>

                    {!isSplitPaymentEnabled ? (
                        <div className="grid grid-cols-4 gap-2">
                            {PAYMENT_METHODS.map((method) => (
                                <Button
                                    key={method.value}
                                    variant={paymentMethod === method.value ? "default" : "outline"}
                                    className={cn("h-16 flex flex-col p-1", paymentMethod === method.value ? "border-primary" : "")}
                                    onClick={() => setPaymentMethod(method.value)}
                                >
                                    <method.icon className="w-5 h-5 mb-1" />
                                    <span className="text-[10px]">{method.label}</span>
                                </Button>
                            ))}
                        </div>
                    ) : (
                        // Split Payment UI
                        <div className="space-y-3 bg-muted/20 p-3 rounded-md">
                            <div className="space-y-1">
                                <Label className="text-xs">1차 결제</Label>
                                <div className="flex gap-2">
                                    <Select value={firstPaymentMethod} onValueChange={(v) => setFirstPaymentMethod(v as PaymentMethod)}>
                                        <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Input
                                        type="number"
                                        value={firstPaymentAmount}
                                        onChange={(e) => setFirstPaymentAmount(Number(e.target.value))}
                                        className="h-8 text-right text-xs"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">2차 결제 (잔액)</Label>
                                <div className="flex gap-2">
                                    <Select value={secondPaymentMethod} onValueChange={(v) => setSecondPaymentMethod(v as PaymentMethod)}>
                                        <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex-1 h-8 flex items-center justify-end px-3 border rounded bg-muted text-xs font-medium">
                                        {(orderSummary.total - firstPaymentAmount).toLocaleString()}원
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        <Button
                            variant={paymentStatus === 'paid' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1 mr-2"
                            onClick={() => setPaymentStatus('paid')}
                        >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> 결제 완료
                        </Button>
                        <Button
                            variant={paymentStatus === 'pending' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => setPaymentStatus('pending')}
                        >
                            <Circle className="w-4 h-4 mr-1" /> 미수금(외상)
                        </Button>
                    </div>
                </div>
            </div>

            {/* 4. Footer Totals */}
            <CardFooter className="flex-col bg-muted/50 p-4 border-t">
                <div className="w-full space-y-2 text-sm mb-4">
                    <div className="flex justify-between text-muted-foreground">
                        <span>상품 합계</span>
                        <span>{orderSummary.subtotal.toLocaleString()}원</span>
                    </div>
                    {orderSummary.discountAmount > 0 && (
                        <div className="flex justify-between text-red-500">
                            <span>할인</span>
                            <span>- {orderSummary.discountAmount.toLocaleString()}원</span>
                        </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                        <span>배송비</span>
                        <span>+ {orderSummary.deliveryFee.toLocaleString()}원</span>
                    </div>
                    {orderSummary.pointsUsed > 0 && (
                        <div className="flex justify-between text-blue-500">
                            <span>포인트 사용</span>
                            <span>- {orderSummary.pointsUsed.toLocaleString()}원</span>
                        </div>
                    )}
                    <Separator className="my-2" />
                    <div className="flex justify-between font-bold text-lg">
                        <span>최종 결제 금액</span>
                        <span className="text-primary">{orderSummary.total.toLocaleString()}원</span>
                    </div>
                </div>

                <Button
                    className="w-full py-6 text-lg"
                    size="lg"
                    onClick={onSubmit}
                    disabled={isSubmitting || orderItems.length === 0}
                >
                    {isSubmitting ? "처리 중..." : `${orderSummary.total.toLocaleString()}원 결제하기`}
                </Button>
            </CardFooter>
        </Card>
    );
}
