"use client"

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from 'next/navigation';
import type { SerializableOrder } from '../page';
import { cn } from "@/lib/utils";
import { GOOGLE_FONTS } from "@/lib/fonts";

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

const labelConfigs: Record<string, {
  cells: number;
  cols: number; // gridCols 대신 cols 사용
  height: string;
  width: string; // 너비 추가
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  hGap: string;
  vGap: string;
}> = {
  'formtec-3107': {
    cells: 6, cols: 2,
    width: '99.1mm', height: '93.1mm',
    marginTop: '8.5mm', marginBottom: '8.5mm', marginLeft: '5mm', marginRight: '5mm',
    hGap: '2mm', vGap: '0mm'
  },
  'formtec-3108': {
    cells: 8, cols: 2,
    width: '99.1mm', height: '67.7mm',
    marginTop: '13mm', marginBottom: '14mm', marginLeft: '5mm', marginRight: '5mm',
    hGap: '2mm', vGap: '0mm'
  },
  'formtec-3109': {
    cells: 12, cols: 2,
    width: '99.1mm', height: '45mm',
    marginTop: '11mm', marginBottom: '16mm', marginLeft: '5mm', marginRight: '5mm',
    hGap: '2mm', vGap: '0mm'
  },
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
  let finalSenderName = senderName || order.message?.sender || "";

  // 원본 메시지에서 보내는 사람 분리 (--- 구분자 사용) - 하위 호환성
  if (!messageContent && !senderName && order.message?.content && !order.message?.sender) {
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
    fontFamily: `'${messageFont}'`,
    fontSize: `${messageFontSize}pt`,
  };

  const senderFontStyle: React.CSSProperties = {
    fontFamily: `'${senderFont}'`,
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
      {/* Load Fonts for Print */}
      <style jsx global>{`
          ${GOOGLE_FONTS.map(font => `@import url('${font.url}');`).join('\n')}
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
              <ArrowLeft className="mr-2 h-4 w-4" />
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
          className="h-full"
          style={{
            paddingTop: config.marginTop, // Use specific margins from config
            paddingBottom: config.marginBottom,
            paddingLeft: config.marginLeft,
            paddingRight: config.marginRight,
            display: 'grid',
            gridTemplateColumns: `repeat(${config.cols}, 1fr)`,
            columnGap: config.hGap,
            rowGap: config.vGap,
          }}
          role="grid"
          aria-label={`${labelType} 라벨 그리드 (${config.cells}칸)`}
        >
          {labels.map((labelData, index) => (
            <div
              key={index}
              className="flex flex-col items-center justify-center text-center relative overflow-hidden"
              style={{
                height: config.height,
                width: config.width,
                // border: '1px dashed #ccc' // 디버깅용 보더 (실제 출력시 제거)
              }}
              role="gridcell"
              aria-label={labelData ? `라벨 ${index + 1}: ${labelData.content.substring(0, 50)}${labelData.content.length > 50 ? '...' : ''}` : `빈 라벨 ${index + 1}`}
            >
              {labelData ? (
                <div className="w-full h-full p-2 flex flex-col items-center justify-center relative">
                  <div
                    className="whitespace-pre-wrap flex-1 flex items-center justify-center w-full"
                    style={{
                      ...messageFontStyle,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                    aria-label={`메시지 내용: ${labelData.content}`}
                  >
                    {labelData.content}
                  </div>
                  {labelData.senderName && (
                    <div
                      className="mt-1"
                      style={senderFontStyle}
                      aria-label={`보내는 사람: ${labelData.senderName}`}
                    >
                      {labelData.senderName}
                    </div>
                  )}
                </div>
              ) : (
                null
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
