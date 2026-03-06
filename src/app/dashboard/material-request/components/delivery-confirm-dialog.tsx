'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MaterialRequest, RequestItem } from '@/types/material-request';
import { useMaterials } from '@/hooks/use-materials';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import { useAuth } from '@/hooks/use-auth';
import { useMaterialRequests } from '@/hooks/use-material-requests';
import { useToast } from '@/hooks/use-toast';
import { usePartners } from '@/hooks/use-partners';
import { useFlowerBatches } from '@/hooks/use-flower-batches';
import { PackageCheck, Receipt, Package, DollarSign, Store, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryConfirmDialogProps {
    request: MaterialRequest | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface EditableItem extends RequestItem {
    actualQuantity: number;
    actualPrice: number;
    category: string;
    midCategory: string;
    supplier: string;
    isExtra?: boolean;
    isUnavailable?: boolean;
}

export function DeliveryConfirmDialog({ request, isOpen, onClose, onSuccess }: DeliveryConfirmDialogProps) {
    const { user } = useAuth();
    const { updateStock, materials, fetchMaterials } = useMaterials();
    const { addMaterialRequestExpense } = useSimpleExpenses({ enableRealtime: false });
    const { updateRequestStatus } = useMaterialRequests();
    const { partners } = usePartners();
    const { createBatch } = useFlowerBatches();
    const { toast } = useToast();

    const [items, setItems] = useState<EditableItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (materials.length === 0) {
            fetchMaterials();
        }
    }, [fetchMaterials, materials.length]);

    useEffect(() => {
        if (request && isOpen) {
            const mappedItems = request.requestedItems.map(item => {
                const matInfo = materials.find(m => m.id === item.materialId || m.name === item.materialName);
                return {
                    ...item,
                    actualQuantity: item.requestedQuantity,
                    actualPrice: item.estimatedPrice || matInfo?.price || 0,
                    category: matInfo?.mainCategory || '기타',
                    midCategory: matInfo?.midCategory || '',
                    supplier: matInfo?.supplier || '',
                };
            });

            // 1차카테고리 -> 업체명 -> 품목명 오름차순 정렬
            mappedItems.sort((a, b) => {
                if (a.category !== b.category) return a.category.localeCompare(b.category);
                if (a.supplier !== b.supplier) return a.supplier.localeCompare(b.supplier);
                return a.materialName.localeCompare(b.materialName);
            });

            setItems(mappedItems);
        }
    }, [request, isOpen, materials]);

    if (!request) return null;

    const totalCost = items.reduce((sum, item) => sum + (item.isUnavailable ? 0 : item.actualQuantity * item.actualPrice), 0);

    const handleItemChange = (index: number, field: keyof EditableItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: typeof value === 'number' && value < 0 ? 0 : value };
        setItems(newItems);
    };

    const handleMaterialChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index].materialName = value;
        const matInfo = materials.find(m => m.name === value);
        if (matInfo) {
            // 자재 DB에서 찾으면 ID도 갱신 → 정확한 재고 반영
            newItems[index].materialId = matInfo.id;
            if (!newItems[index].actualPrice) newItems[index].actualPrice = matInfo.price || 0;
            newItems[index].category = matInfo.mainCategory || '기타';
            newItems[index].midCategory = matInfo.midCategory || '';
            if (!newItems[index].supplier) newItems[index].supplier = matInfo.supplier || '';
        }
        setItems(newItems);
    };

    // 구매처 변경 시 자재 카탈로그에서 카테고리 자동 업데이트 (선택적)
    const handleSupplierChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index].supplier = value;
        setItems(newItems);
    };

    // 1차 카테고리 변경
    const handleCategoryChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index].category = value;
        setItems(newItems);
    };

    // 2차 카테고리 변경
    const handleMidCategoryChange = (index: number, value: string) => {
        const newItems = [...items];
        newItems[index].midCategory = value;
        setItems(newItems);
    };

    // 고유 카테고리 목록
    const mainCategories = [...new Set(materials.map(m => m.mainCategory).filter(Boolean))];
    const midCategories = [...new Set(materials.map(m => m.midCategory).filter(Boolean))];

    const toggleUnavailable = (index: number) => {
        const newItems = [...items];
        newItems[index].isUnavailable = !newItems[index].isUnavailable;
        setItems(newItems);
    };

    const handleAddExtraItem = () => {
        const newItem: EditableItem = {
            materialId: `EXTRA-${Date.now()}`,
            materialName: '',
            requestedQuantity: 0,
            estimatedPrice: 0,
            urgency: 'normal',
            actualQuantity: 1,
            actualPrice: 0,
            category: '기타',
            midCategory: '',
            supplier: '',
            isExtra: true
        };
        setItems([...items, newItem]);
    };

    const handleRemoveExtraItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleConfirm = async () => {
        try {
            setIsSubmitting(true);

            // 1. 상태 업데이트 (입고완료 처리 - completed)
            await updateRequestStatus(request.id, 'completed', {
                delivery: {
                    ...request.delivery,
                    deliveryDate: new Date().toISOString(),
                    deliveryStatus: 'delivered',
                },
            });

            // 2. 재고 업데이트 (입력된 수량/단가 기준)
            const stockItems = items
                .filter(item => !item.isUnavailable && item.actualQuantity > 0)
                .map(item => {
                    const actualMaterialId = item.materialId.includes('-')
                        ? item.materialId.split('-')[0]
                        : item.materialId;
                    return {
                        id: actualMaterialId,
                        name: item.materialName,
                        quantity: item.actualQuantity,
                        price: item.actualPrice,
                        supplier: item.supplier,
                    };
                });
            if (stockItems.length > 0) {
                await updateStock(stockItems, 'in', request.branchName, user?.email || '시스템');
            }

            // 3. 간편지출 등록 (업체별로 그룹핑)
            if (totalCost > 0) {
                const itemsBySupplier = items
                    .filter(item => !item.isUnavailable && item.actualQuantity > 0)
                    .reduce((acc, item) => {
                        const sup = item.supplier.trim() || '미지정업체';
                        if (!acc[sup]) acc[sup] = [];
                        acc[sup].push(item);
                        return acc;
                    }, {} as Record<string, EditableItem[]>);

                for (const [sup, groupItems] of Object.entries(itemsBySupplier)) {
                    const groupCost = groupItems.reduce((sum, item) => sum + item.actualQuantity * item.actualPrice, 0);
                    if (groupCost > 0) {
                        const purchaseInfo = {
                            purchaseDate: new Date().toISOString(),
                            totalCost: groupCost,
                            items: groupItems.map(item => ({
                                name: item.materialName,
                                quantity: item.actualQuantity,
                                unitPrice: item.actualPrice,
                                supplier: sup
                            }))
                        };
                        await addMaterialRequestExpense(request, purchaseInfo);
                    }
                }
            }

            toast({
                title: "배송 및 입고 완료",
                description: "입고 처리, 재고 반영 및 지출 내역 등록이 완료되었습니다.",
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('배송 완료 처리 오류:', error);
            toast({
                variant: 'destructive',
                title: "오류 발생",
                description: "배송 완료 처리 중 문제가 발생했습니다.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] lg:max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-indigo-500" />
                        배송 완료 및 입고/지출 등록
                    </DialogTitle>
                    <DialogDescription>
                        도착한 영수증(거래명세서)을 확인하여 실제 입고된 수량과 단가를 수정해주세요.
                        <br />작성을 완료하면 <b>실시간 재고 입고</b> 처리와 <b>간편지출 내역</b>이 자동으로 등록됩니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-4 p-3 bg-muted rounded-md text-sm">
                        <div><span className="text-muted-foreground mr-1">요청번호:</span> <span className="font-mono">{request.requestNumber}</span></div>
                        <div><span className="text-muted-foreground mr-1">지점:</span> <span className="font-semibold">{request.branchName}</span></div>
                        <div><span className="text-muted-foreground mr-1">요청자:</span> <span>{request.requesterName}</span></div>
                    </div>

                    <datalist id="suppliers-list">
                        {partners.map(p => (
                            <option key={p.id} value={p.name} />
                        ))}
                    </datalist>

                    <datalist id="materials-list">
                        {materials.map(m => (
                            <option key={m.id} value={m.name} />
                        ))}
                    </datalist>

                    <datalist id="main-category-list">
                        {mainCategories.map(c => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>

                    <datalist id="mid-category-list">
                        {midCategories.map(c => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>

                    <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" onClick={handleAddExtraItem} className="flex items-center gap-1">
                            <Plus className="w-4 h-4" /> 구매자가 추가한 항목 등록
                        </Button>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">1차 카테고리</TableHead>
                                    <TableHead className="w-[100px]">2차 카테고리</TableHead>
                                    <TableHead className="min-w-[130px]">구매처(업체명)</TableHead>
                                    <TableHead className="min-w-[180px]">품목명</TableHead>
                                    <TableHead className="w-16 text-center">요청수량</TableHead>
                                    <TableHead className="w-20">실제수량 <span className="text-red-500">*</span></TableHead>
                                    <TableHead className="w-24">실제단가 <span className="text-red-500">*</span></TableHead>
                                    <TableHead className="text-right w-24">합계액</TableHead>
                                    <TableHead className="w-20 text-center">제외</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={index} className={cn("hover:bg-transparent", item.isUnavailable && "opacity-50 bg-muted/50")}>
                                        <TableCell>
                                            <Input
                                                list="main-category-list"
                                                placeholder="대분류"
                                                value={item.category}
                                                onChange={(e) => handleCategoryChange(index, e.target.value)}
                                                className="h-8 text-xs w-[90px]"
                                                disabled={item.isUnavailable}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                list="mid-category-list"
                                                placeholder="중분류"
                                                value={item.midCategory}
                                                onChange={(e) => handleMidCategoryChange(index, e.target.value)}
                                                className="h-8 text-xs w-[90px]"
                                                disabled={item.isUnavailable}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                list="suppliers-list"
                                                placeholder="업체명"
                                                value={item.supplier}
                                                onChange={(e) => handleSupplierChange(index, e.target.value)}
                                                className="h-8 text-sm"
                                                disabled={item.isUnavailable}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <Input
                                                list="materials-list"
                                                placeholder="자재 검색/입력"
                                                value={item.materialName}
                                                onChange={(e) => handleMaterialChange(index, e.target.value)}
                                                className="h-8 text-sm min-w-[160px]"
                                                disabled={item.isUnavailable}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground">{item.requestedQuantity}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={item.actualQuantity}
                                                    onChange={(e) => handleItemChange(index, 'actualQuantity', parseInt(e.target.value) || 0)}
                                                    className="h-8 w-16 px-2"
                                                    disabled={item.isUnavailable}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={item.actualPrice}
                                                    onChange={(e) => handleItemChange(index, 'actualPrice', parseInt(e.target.value) || 0)}
                                                    className="h-8 w-24 px-2"
                                                    disabled={item.isUnavailable}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            {item.isUnavailable ? '구매불가' : `${(item.actualQuantity * item.actualPrice).toLocaleString()}원`}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {item.isExtra ? (
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveExtraItem(index)}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant={item.isUnavailable ? "outline" : "ghost"}
                                                    size="sm"
                                                    onClick={() => toggleUnavailable(index)}
                                                    className={item.isUnavailable ? "text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 h-8 px-2" : "text-muted-foreground hover:text-destructive h-8 px-2"}
                                                >
                                                    {item.isUnavailable ? '복구' : '구매불가'}
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex items-center gap-2 text-primary font-semibold">
                            <Receipt className="h-5 w-5" />
                            총 지출 등록 예정액
                        </div>
                        <div className="text-2xl font-bold text-primary">
                            {totalCost.toLocaleString()}원
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                        취소
                    </Button>
                    <Button onClick={handleConfirm} disabled={isSubmitting} className="min-w-[140px]">
                        {isSubmitting ? '처리 중...' : '배송 완료 및 입고 반영'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
