import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface DuplicateCheckDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    duplicates: {
        type: 'supplier' | 'material' | 'product';
        inputName: string;
        similarItems: { id: string; name: string }[];
    } | null;
    onConfirm: (selectedName: string) => void;
    onCancel: () => void;
}

export function DuplicateCheckDialog({
    open,
    onOpenChange,
    duplicates,
    onConfirm,
    onCancel,
}: DuplicateCheckDialogProps) {
    const [selectedOption, setSelectedOption] = React.useState<string>('new');
    const [selectedExistingName, setSelectedExistingName] = React.useState<string>('');

    React.useEffect(() => {
        if (open) {
            setSelectedOption('new');
            setSelectedExistingName('');
        }
    }, [open]);

    if (!duplicates) return null;

    const handleConfirm = () => {
        if (selectedOption === 'new') {
            onConfirm(duplicates.inputName);
        } else {
            onConfirm(selectedExistingName);
        }
    };

    const typeLabel = {
        supplier: '거래처',
        material: '자재',
        product: '제품',
    }[duplicates.type];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>유사한 {typeLabel} 이름 확인</DialogTitle>
                    <DialogDescription>
                        입력하신 "{duplicates.inputName}"와(과) 유사한 이름이 이미 존재합니다.
                        어떻게 저장하시겠습니까?
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="option-new" />
                            <Label htmlFor="option-new" className="font-medium">
                                그대로 저장 ("{duplicates.inputName}")
                            </Label>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="existing" id="option-existing" disabled={duplicates.similarItems.length === 0} />
                                <Label htmlFor="option-existing">기존 이름으로 선택하여 저장</Label>
                            </div>

                            <div className="pl-6 space-y-1">
                                {duplicates.similarItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`p-2 rounded border cursor-pointer hover:bg-muted ${selectedExistingName === item.name && selectedOption === 'existing'
                                                ? 'bg-accent border-primary ring-1 ring-primary'
                                                : 'border-transparent'
                                            }`}
                                        onClick={() => {
                                            setSelectedOption('existing');
                                            setSelectedExistingName(item.name);
                                        }}
                                    >
                                        <span className="text-sm">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </RadioGroup>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        취소
                    </Button>
                    <Button onClick={handleConfirm} disabled={selectedOption === 'existing' && !selectedExistingName}>
                        확인
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
