"use client"

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';
import type { SerializableOrder } from '../page';
import { cn } from "@/lib/utils";

interface MessagePrintLayoutProps {
  order: SerializableOrder;
  labelType: string;
  startPosition: number;
  messageFont: string;
  messageFontSize: number;
  senderFont: string;
  senderFontSize: number;
  messageContent: string;
  senderName: string;
  selectedPositions?: number[];
}

const labelConfigs: Record<string, { cells: number; gridCols: string; height: string, className?: string }> = {
    'formtec-3107': { cells: 6, gridCols: 'grid-cols-2', height: '93mm', className: 'gap-x-[2mm]' }, // 2x3
    'formtec-3108': { cells: 8, gridCols: 'grid-cols-2', height: '67.5mm', className: 'gap-x-[2mm]' }, // 2x4
    'formtec-3109': { cells: 12, gridCols: 'grid-cols-2', height: '45mm', className: 'gap-x-[2mm]' }, // 2x6
};

export function MessagePrintLayout({ 
  order, 
  labelType, 
  startPosition, 
  messageFont, 
  messageFontSize, 
  senderFont, 
  senderFontSize, 
  messageContent, 
  senderName,
  selectedPositions = [startPosition]
}: MessagePrintLayoutProps) {
  const router = useRouter();
  const config = labelConfigs[labelType] || labelConfigs['formtec-3108'];
  const labels = Array(config.cells).fill(null);

  // 편집된 메시지 내용 또는 원본 메시지 사용
  let finalMessageContent = messageContent || order.message?.content || "";
  let finalSenderName = senderName || "";

  // 원본 메시지에서 보내는 사람 분리 (--- 구분자 사용)
  if (!messageContent && order.message?.content) {
    const messageParts = order.message.content.split('\n---\n');
    if (messageParts.length > 1) {
      finalMessageContent = messageParts[0];
      finalSenderName = messageParts[1];
    }
  }

  if (finalMessageContent) {
      // 선택된 모든 위치에 메시지 배치
      selectedPositions.forEach(position => {
          if (position - 1 < config.cells && position > 0) {
              labels[position - 1] = { content: finalMessageContent, senderName: finalSenderName };
          }
      });
  }

  const messageFontStyle: React.CSSProperties = {
    fontFamily: messageFont,
    fontSize: `${messageFontSize}pt`,
  };

  const senderFontStyle: React.CSSProperties = {
    fontFamily: senderFont,
    fontSize: `${senderFontSize}pt`,
  };

  return (
    <div className="max-w-4xl mx-auto">
       <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
            /* 사이드바와 네비게이션 완전히 숨기기 */
            .sidebar, nav, header, .no-print, aside, [data-sidebar] {
              display: none !important;
            }
            /* 메인 콘텐츠만 표시 */
            main {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
            }
            /* 전체 페이지 레이아웃 재설정 */
            * {
              visibility: hidden;
            }
            #printable-area-wrapper, #printable-area-wrapper * {
              visibility: visible;
            }
            #printable-area-wrapper {
              position: absolute;
              left: 0;
              top: 0;
              width: 210mm;
              height: 297mm;
              box-sizing: border-box;
              padding: 14mm 5mm 13mm 5mm; /* 상 좌 하 우 - 폼텍 3108 최적화 */
            }
            /* 6칸 라벨용 여백 설정 */
            #printable-area-wrapper[data-label-type="formtec-3107"] {
              padding: 8mm 5mm 10mm 5mm; /* 상 좌 하 우 - 폼텍 3107 최적화 */
            }
            /* 12칸 라벨용 여백 설정 */
            #printable-area-wrapper[data-label-type="formtec-3109"] {
              padding: 11mm 5mm 16mm 5mm; /* 상 좌 하 우 - 폼텍 3109 최적화 */
            }
          }
        `}</style>
      <div className="no-print">
        <PageHeader
          title="메시지 인쇄 미리보기"
          description={`주문자: ${order.orderer.name} / 라벨지: ${labelType} / 출력 위치: ${selectedPositions.join(', ')}`}
        >
            <div className="flex gap-2">
                                 <Button 
                     variant="outline" 
                     onClick={() => {
                       // URL 파라미터를 유지하면서 주문 페이지로 돌아가기
                       const params = new URLSearchParams();
                       params.set('orderId', order.id);
                       params.set('labelType', labelType);
                       params.set('start', String(startPosition));
                       params.set('messageFont', messageFont);
                       params.set('messageFontSize', String(messageFontSize));
                       params.set('senderFont', senderFont);
                       params.set('senderFontSize', String(senderFontSize));
                       params.set('messageContent', messageContent);
                       params.set('senderName', senderName);
                       params.set('positions', selectedPositions.join(','));
                       params.set('openMessagePrint', 'true');
                       
                       router.push(`/dashboard/orders?${params.toString()}`);
                     }}
                     aria-label="메시지 인쇄 옵션으로 돌아가기"
                 >
                     <ArrowLeft className="mr-2 h-4 w-4"/>
                     옵션 수정
                 </Button>
                <Button 
                    onClick={() => window.print()}
                    aria-label="메시지 라벨 인쇄하기"
                >
                    <Printer className="mr-2 h-4 w-4" />
                    인쇄하기
                </Button>
            </div>
        </PageHeader>
      </div>
      <div id="printable-area-wrapper" className="bg-white">
        <div 
          id="label-grid-container" 
          className={cn(
            "grid gap-y-0 h-full", 
            config.gridCols, 
            config.className
          )}
          role="grid"
          aria-label={`${labelType} 라벨 그리드 (${config.cells}칸)`}
        >
          {labels.map((labelData, index) => (
            <div 
              key={index} 
              className="bg-white p-4 flex flex-col items-center justify-center text-center border border-dashed border-gray-300 print:border-transparent relative"
              style={{ height: config.height }}
              role="gridcell"
              aria-label={labelData ? `라벨 ${index + 1}: ${labelData.content.substring(0, 50)}${labelData.content.length > 50 ? '...' : ''}` : `빈 라벨 ${index + 1}`}
            >
              {labelData ? (
                <>
                  <div 
                    className="whitespace-pre-wrap flex-1 flex items-center justify-center"
                    style={messageFontStyle}
                    aria-label={`메시지 내용: ${labelData.content}`}
                  >
                    {labelData.content}
                  </div>
                                     {labelData.senderName && (
                     <div 
                       className="absolute bottom-2 left-1/2 transform -translate-x-1/2"
                       style={senderFontStyle}
                       aria-label={`보내는 사람: ${labelData.senderName}`}
                     >
                       {labelData.senderName}
                     </div>
                   )}
                </>
              ) : (
                null // 빈 라벨일 경우 아무것도 렌더링하지 않음
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
