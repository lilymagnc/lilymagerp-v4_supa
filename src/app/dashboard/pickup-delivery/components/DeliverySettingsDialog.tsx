"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Branch } from "@/hooks/use-branches";

interface DeliverySettingsDialogProps {
    branch: Branch | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (branchId: string, updatedBranch: Partial<Branch>) => Promise<void>;
}

export function DeliverySettingsDialog({ branch, isOpen, onOpenChange, onSave }: DeliverySettingsDialogProps) {
    const { toast } = useToast();
    const [editingFees, setEditingFees] = useState<Array<{ district: string, fee: number }>>([]);
    const [surcharges, setSurcharges] = useState({ mediumItem: 0, largeItem: 0, express: 0 });

    const [newDistrict, setNewDistrict] = useState('');
    const [newFee, setNewFee] = useState('');

    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingDistrict, setEditingDistrict] = useState('');
    const [editingFee, setEditingFee] = useState('');

    useEffect(() => {
        if (branch) {
            setEditingFees(branch.deliveryFees || []);
            setSurcharges(branch.surcharges || { mediumItem: 0, largeItem: 0, express: 0 });
        }
    }, [branch]);

    const handleAddFee = () => {
        if (!newDistrict.trim() || !newFee.trim()) return;
        const fee = parseInt(newFee);
        if (isNaN(fee)) return;
        setEditingFees(prev => [...prev, { district: newDistrict.trim(), fee }]);
        setNewDistrict('');
        setNewFee('');
    };

    const handleRemoveFee = (index: number) => {
        setEditingFees(prev => prev.filter((_, i) => i !== index));
    };

    const handleStartEdit = (index: number, district: string, fee: number) => {
        setEditingIndex(index);
        setEditingDistrict(district);
        setEditingFee(fee.toString());
    };

    const handleSaveEdit = () => {
        if (editingIndex === null || !editingDistrict.trim() || !editingFee.trim()) return;
        const fee = parseInt(editingFee);
        if (isNaN(fee)) return;

        setEditingFees(prev => prev.map((item, index) =>
            index === editingIndex ? { district: editingDistrict.trim(), fee } : item
        ));
        setEditingIndex(null);
    };

    const handleSaveAll = async () => {
        if (!branch) return;
        try {
            await onSave(branch.id, {
                deliveryFees: editingFees,
                surcharges: surcharges
            });
            onOpenChange(false);
        } catch (error) {
            toast({ variant: 'destructive', title: '오류', description: '설정 저장 중 오류가 발생했습니다.' });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{branch?.name} 배송비 설정</DialogTitle>
                    <DialogDescription>지역별 기본 배송비와 품목별 추가 요금을 관리합니다.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* 품목별 추가 요금 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold border-b pb-2">기본 추가 요금</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>중품 추가 요금</Label>
                                <Input
                                    type="number"
                                    value={surcharges.mediumItem}
                                    onChange={(e) => setSurcharges({ ...surcharges, mediumItem: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>대품 추가 요금</Label>
                                <Input
                                    type="number"
                                    value={surcharges.largeItem}
                                    onChange={(e) => setSurcharges({ ...surcharges, largeItem: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>급행 추가 요금</Label>
                                <Input
                                    type="number"
                                    value={surcharges.express}
                                    onChange={(e) => setSurcharges({ ...surcharges, express: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 지역별 배송비 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold border-b pb-2">지역별 배송비 리스트</h3>

                        <div className="flex gap-2">
                            <Input
                                placeholder="지역명 (예: 강남구)"
                                value={newDistrict}
                                onChange={(e) => setNewDistrict(e.target.value)}
                                className="flex-1"
                            />
                            <Input
                                type="number"
                                placeholder="금액"
                                value={newFee}
                                onChange={(e) => setNewFee(e.target.value)}
                                className="w-32"
                            />
                            <Button onClick={handleAddFee} size="icon"><Plus className="w-4 h-4" /></Button>
                        </div>

                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>지역구/동</TableHead>
                                        <TableHead>배송비</TableHead>
                                        <TableHead className="w-[100px] text-right">관리</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {editingFees.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-4">등록된 지역이 없습니다.</TableCell>
                                        </TableRow>
                                    ) : (
                                        editingFees.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>
                                                    {editingIndex === index ? (
                                                        <Input value={editingDistrict} onChange={(e) => setEditingDistrict(e.target.value)} />
                                                    ) : (
                                                        item.district
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {editingIndex === index ? (
                                                        <Input type="number" value={editingFee} onChange={(e) => setEditingFee(e.target.value)} />
                                                    ) : (
                                                        `₩${item.fee.toLocaleString()}`
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {editingIndex === index ? (
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={handleSaveEdit}><Check className="w-4 h-4 text-green-600" /></Button>
                                                            <Button variant="ghost" size="icon" onClick={() => setEditingIndex(null)}><X className="w-4 h-4 text-red-600" /></Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="icon" onClick={() => handleStartEdit(index, item.district, item.fee)}><Edit2 className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveFee(index)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                    <Button onClick={handleSaveAll}>설정 저장</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
