
"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GOOGLE_FONTS } from "@/lib/fonts";

interface LabelGridSelectorProps {
    labelType: string;
    selectedPositions: number[];
    onPositionToggle: (position: number) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
    onSelectFirst: () => void;
    messageContent: string;
    senderName: string;
    messageFont: string;
    messageFontSize: number;
    senderFont: string;
    senderFontSize: number;
}

// 폼텍 라벨 규격 (단위: mm)
const LABEL_SPECS: Record<string, {
    rows: number;
    cols: number;
    width: number;
    height: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    hGap: number;
    vGap: number;
}> = {
    // Formtec 3107 (2x3, 6칸) - A4 기준
    'formtec-3107': {
        rows: 3, cols: 2,
        width: 99.1, height: 93.1,
        marginTop: 8.5, marginBottom: 8.5, marginLeft: 5.0, marginRight: 5.0,
        hGap: 2.0, vGap: 0
    },
    // Formtec 3108 (2x4, 8칸)
    'formtec-3108': {
        rows: 4, cols: 2,
        width: 99.1, height: 67.7,
        marginTop: 13.0, marginBottom: 14.0, marginLeft: 5.0, marginRight: 5.0,
        hGap: 2.0, vGap: 0
    },
    // Formtec 3109 (2x6, 12칸)
    'formtec-3109': {
        rows: 6, cols: 2,
        width: 99.1, height: 45.0,
        marginTop: 11.0, marginBottom: 16.0, marginLeft: 5.0, marginRight: 5.0,
        hGap: 2.0, vGap: 0
    },
    // Formtec 3105 (3x5, 15칸) - 예시 추가
    'formtec-3105': {
        rows: 5, cols: 3,
        width: 63.5, height: 38.1,
        marginTop: 14.5, marginBottom: 14.5, marginLeft: 7.2, marginRight: 7.2,
        hGap: 0, vGap: 0
    },
};

export function LabelGridSelector({
    labelType,
    selectedPositions,
    onPositionToggle,
    onSelectAll,
    onClearAll,
    onSelectFirst,
    messageContent,
    senderName,
    messageFont,
    messageFontSize,
    senderFont,
    senderFontSize
}: LabelGridSelectorProps) {

    const spec = LABEL_SPECS[labelType] || LABEL_SPECS['formtec-3108'];

    // A4 size in mm: 210 x 297
    // Scale factor to fit in UI
    const SCALE = 0.6;
    const displayWidth = 210 * SCALE;
    const displayHeight = 297 * SCALE;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">

                {/* Dynamic Font Loading for Preview */}
                <style jsx global>{`
                    ${GOOGLE_FONTS.map(font => `@import url('${font.url}');`).join('\n')}
                `}</style>

                <Label>라벨 미리보기 (A4 용지)</Label>
                <div className="flex gap-2 text-xs">
                    <Button variant="outline" size="sm" onClick={onSelectFirst}>첫장만</Button>
                    <Button variant="outline" size="sm" onClick={onSelectAll}>전체</Button>
                    <Button variant="outline" size="sm" onClick={onClearAll}>해제</Button>
                </div>
            </div>

            <div className="border rounded-md bg-gray-100 p-4 flex justify-center overflow-auto">
                {/* Paper Container */}
                <div
                    className="bg-white shadow-lg relative transition-all duration-300 ease-in-out"
                    style={{
                        width: `${displayWidth}mm`,
                        height: `${displayHeight}mm`,
                        paddingTop: `${spec.marginTop * SCALE}mm`,
                        paddingBottom: `${spec.marginBottom * SCALE}mm`,
                        paddingLeft: `${spec.marginLeft * SCALE}mm`,
                        paddingRight: `${spec.marginRight * SCALE}mm`,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${spec.cols}, 1fr)`,
                        gridTemplateRows: `repeat(${spec.rows}, 1fr)`,
                        columnGap: `${spec.hGap * SCALE}mm`,
                        rowGap: `${spec.vGap * SCALE}mm`,
                    }}
                >
                    {/* Grid Cells */}
                    {Array.from({ length: spec.rows * spec.cols }).map((_, idx) => {
                        const position = idx + 1;
                        const isSelected = selectedPositions.includes(position);

                        return (
                            <div
                                key={position}
                                onClick={() => onPositionToggle(position)}
                                className={cn(
                                    "relative border cursor-pointer hover:border-primary transition-colors flex flex-col justify-center items-center text-center overflow-hidden select-none",
                                    isSelected ? "border-blue-500 bg-white" : "border-gray-200 bg-gray-50 opacity-40 hover:opacity-70"
                                )}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                }}
                            >
                                {isSelected ? (
                                    <div className="w-full h-full p-2 flex flex-col items-center justify-center relative">
                                        {/* Message Content Preview */}
                                        <div
                                            className="whitespace-pre-wrap flex-1 flex items-center justify-center w-full"
                                            style={{
                                                fontFamily: `'${messageFont}'`,
                                                fontSize: `${messageFontSize * SCALE}pt`, // Scale font size
                                                lineHeight: 1.4,
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {messageContent || <span className="text-gray-300 italic text-[8px]">내용 없음</span>}
                                        </div>

                                        {/* Sender Name Preview */}
                                        {senderName && (
                                            <div
                                                className="mt-1"
                                                style={{
                                                    fontFamily: `'${senderFont}'`,
                                                    fontSize: `${senderFontSize * SCALE}pt`, // Scale font size
                                                }}
                                            >
                                                {senderName}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-gray-300 font-bold text-xl">{position}</span>
                                )}

                                {/* Selection Indicator */}
                                {isSelected && (
                                    <div className="absolute top-1 left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px]">
                                        ✓
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
                * 화면에 보이는 크기는 실제 A4 용지의 약 {Math.round(SCALE * 100)}% 축소 비율입니다.
            </p>
        </div>
    );
}
