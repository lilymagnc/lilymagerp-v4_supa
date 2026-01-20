"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePartners } from "@/hooks/use-partners";
import { useToast } from "@/hooks/use-toast";
import { Order } from "@/hooks/use-orders";
import { db } from "@/lib/firebase";
import { useSimpleExpenses } from "@/hooks/use-simple-expenses";
import { SimpleExpenseCategory } from "@/types/simple-expense";
import { Timestamp, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Package, Calculator, Info, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderOutsourceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
    onSuccess?: () => void;
}

export function OrderOutsourceDialog({
    isOpen,
    onClose,
    order,
    onSuccess,
}: OrderOutsourceDialogProps) {
    const [partnerId, setPartnerId] = useState("");
    const [partnerPrice, setPartnerPrice] = useState<number>(0);
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openCombobox, setOpenCombobox] = useState(false);
    const [autoCalc, setAutoCalc] = useState(true);

    const { addExpense, updateExpenseByOrderId } = useSimpleExpenses();

    // 자주 찾는 파트너 (기본값 설정)
    const [popularPartnerIds, setPopularPartnerIds] = useState<string[]>([]);
    const DEFAULT_POPULAR_NAMES = ["노플라워", "채아네", "한성난원", "양지난원", "흑송분재"];

    const { partners } = usePartners();
    const { toast } = useToast();

    // 초기 로딩 시 파트너 데이터에서 ID 매핑
    useEffect(() => {
        if (partners.length > 0) {
            // 로컬 스토리지에서 저장된 인기 파트너 확인
            const saved = localStorage.getItem("popularPartners");
            if (saved) {
                setPopularPartnerIds(JSON.parse(saved));
            } else {
                // 저장된게 없으면 기본 이름으로 ID 찾기
                const defaultIds = DEFAULT_POPULAR_NAMES
                    .map(name => partners.find(p => p.name.includes(name))?.id)
                    .filter(id => id !== undefined) as string[];
                setPopularPartnerIds(defaultIds);
            }
        }
    }, [partners]);

    const handlePartnerSelect = (id: string) => {
        setPartnerId(id);
        setAutoCalc(true);
        setOpenCombobox(false);

        // 자주 찾는 업체 리스트 업데이트 (최근 선택한 순서로, 최대 5개)
        if (id) {
            setPopularPartnerIds(prev => {
                const newList = [id, ...prev.filter(pid => pid !== id)].slice(0, 5);
                localStorage.setItem("popularPartners", JSON.stringify(newList));
                return newList;
            });
        }
    };

    const selectedPartner = useMemo(() =>
        partners.find(p => p.id === partnerId),
        [partners, partnerId]);

    const orderTotal = order?.summary?.total || 0;
    const isEditMode = !!order?.outsourceInfo?.isOutsourced;

    // Load existing data
    useEffect(() => {
        if (isOpen && order) {
            if (order.outsourceInfo?.isOutsourced) {
                setPartnerId(order.outsourceInfo.partnerId);
                setPartnerPrice(order.outsourceInfo.partnerPrice);
                setNotes(order.outsourceInfo.notes || "");
                setAutoCalc(false); // Disable auto-calc for initial load
            } else {
                setPartnerId("");
                setPartnerPrice(0);
                setNotes("");
                setAutoCalc(true);
            }
        }
    }, [isOpen, order]);

    // Calculate suggested price
    useEffect(() => {
        if (selectedPartner && orderTotal > 0 && autoCalc) {
            const margin = selectedPartner.defaultMarginPercent || 20;
            const suggestedPrice = Math.round(orderTotal * (1 - margin / 100));
            setPartnerPrice(suggestedPrice);
        }
    }, [selectedPartner, orderTotal, autoCalc]);

    // 수익 계산
    const profit = orderTotal - partnerPrice;
    const profitMargin = orderTotal > 0 ? (profit / orderTotal) * 100 : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!order || !partnerId || partnerPrice <= 0) {
            toast({
                variant: "destructive",
                title: "입력 오류",
                description: "파트너와 가격을 정확히 입력해주세요.",
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const orderRef = doc(db, "orders", order.id);
            const currentStatus = order.outsourceInfo?.status || 'pending';

            await updateDoc(orderRef, {
                outsourceInfo: {
                    isOutsourced: true,
                    partnerId,
                    partnerName: selectedPartner?.name || "",
                    partnerPrice,
                    profit,
                    status: currentStatus,
                    notes,
                    outsourcedAt: order.outsourceInfo?.outsourcedAt || serverTimestamp(),
                    updatedAt: serverTimestamp(),
                },
                status: 'processing' // Ensure order status is processing
            });

            // 자동으로 간편지출 관리에 자재비로 등록/수정
            const itemsDescription = order.items.map(item => `${item.name}(${item.quantity})`).join(', ');
            const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

            const expenseData = {
                date: order.orderDate,
                amount: partnerPrice,
                category: SimpleExpenseCategory.MATERIAL,
                subCategory: 'outsource',
                description: isEditMode ? `외부발주(수정): ${itemsDescription}` : `외부발주: ${itemsDescription}`,
                supplier: selectedPartner?.name || "미지정 파트너",
                quantity: totalQuantity,
                unitPrice: partnerPrice / (totalQuantity || 1),
                relatedOrderId: order.id,
            };

            if (!isEditMode) {
                await addExpense(expenseData, order.branchId, order.branchName);
            } else {
                // 수정 모드일 때 기존 지출 내역 업데이트 시도
                const wasUpdated = await updateExpenseByOrderId(order.id, expenseData);

                // 만약 취소 후 재발주 등의 사유로 지출 내역이 삭제되어 업데이트 실패 시 새로 등록
                if (!wasUpdated) {
                    await addExpense(expenseData, order.branchId, order.branchName);
                }
            }

            toast({
                title: isEditMode ? "외부 발주 수정 완료" : "외부 발주 완료 및 지출 등록",
                description: `${selectedPartner?.name}으로 발주 정보가 ${isEditMode ? "수정" : "등록"}되었으며, 간편지출에 자재비로 자동 기록되었습니다.`,
            });

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error("외부 발주 처리 오류:", error);
            toast({
                variant: "destructive",
                title: "처리 실패",
                description: "외부 발주 처리 중 오류가 발생했습니다.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {isEditMode ? "외부 발주 수정" : "외부 발주 (재주문) 처리"}
                    </DialogTitle>
                    <DialogDescription>
                        다른 화원이나 도매점에 주문을 위탁하고 수익을 관리합니다.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="bg-muted p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">주문 번호:</span>
                            <span className="font-medium text-xs">{order.id}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">고객 결제 금액:</span>
                            <span className="font-bold text-blue-600">₩{orderTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="partner">수주처 (파트너) 선택 *</Label>

                        {/* 자주 찾는 업체 버튼 */}
                        {popularPartnerIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                                {popularPartnerIds.map(id => {
                                    const partner = partners.find(p => p.id === id);
                                    if (!partner) return null;
                                    return (
                                        <Button
                                            key={id}
                                            type="button"
                                            variant={partnerId === id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handlePartnerSelect(id)}
                                            className="text-xs h-7"
                                        >
                                            {partner.name}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCombobox}
                                    className="w-full justify-between"
                                >
                                    {partnerId
                                        ? partners.find((partner) => partner.id === partnerId)?.name
                                        : "발주할 파트너를 검색하세요..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[460px] p-0">
                                <Command>
                                    <CommandInput placeholder="파트너 이름 검색..." />
                                    <CommandList>
                                        <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
                                        <CommandGroup>
                                            {partners.map((partner) => (
                                                <CommandItem
                                                    key={partner.id}
                                                    value={partner.name}
                                                    onSelect={() => handlePartnerSelect(partner.id)}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            partnerId === partner.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {partner.name} ({partner.defaultMarginPercent}%)
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="partnerPrice">가격 (발주가) *</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₩</span>
                            <Input
                                id="partnerPrice"
                                type="number"
                                className="pl-8"
                                placeholder="지불할 금액 입력"
                                value={partnerPrice}
                                onChange={(e) => setPartnerPrice(Number(e.target.value))}
                            />
                        </div>
                        {selectedPartner && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" />
                                파트너 기본 마진({selectedPartner.defaultMarginPercent}%) 적용 시 가이드: ₩{Math.round(orderTotal * (1 - selectedPartner.defaultMarginPercent / 100)).toLocaleString()}
                            </p>
                        )}
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
                            <Calculator className="h-4 w-4" />
                            수익 시뮬레이션
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-blue-600 mb-1">예상 수익액</p>
                                <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    ₩{profit.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-600 mb-1">수익률</p>
                                <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {profitMargin.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">비고 (파트너 전달 사항)</Label>
                        <Textarea
                            id="notes"
                            placeholder="배송 요청이나 특이사항을 입력하세요"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            취소
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !partnerId || partnerPrice <= 0}
                        >
                            {isSubmitting ? "처리 중..." : (isEditMode ? "외부 발주 수정" : "외부 발주 등록")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
