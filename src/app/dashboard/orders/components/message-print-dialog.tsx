
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Order } from "@/hooks/use-orders";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/use-settings";
import { useSearchParams } from "next/navigation";
import { FontSelector } from "./font-selector";
import { LabelGridSelector } from "./label-grid-selector";
import { GOOGLE_FONTS } from "@/lib/fonts";
interface MessagePrintDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: {
    orderId: string,
    labelType: string,
    startPosition: number,
    messageFont: string,
    messageFontSize: number,
    senderFont: string,
    senderFontSize: number,
    messageContent: string,
    senderName: string,
    selectedPositions: number[]
  }) => void;
  order: Order;
}
const labelTypes = [
  { value: 'formtec-3107', label: '폼텍 3107 (6칸)', cells: 6, gridCols: 'grid-cols-2', height: '93mm', className: 'gap-x-[2mm]' },
  { value: 'formtec-3108', label: '폼텍 3108 (8칸)', cells: 8, gridCols: 'grid-cols-2', height: '67.5mm', className: 'gap-x-[2mm]' },
  { value: 'formtec-3109', label: '폼텍 3109 (12칸)', cells: 12, gridCols: 'grid-cols-2', height: '45mm', className: 'gap-x-[2mm]' },
];
export function MessagePrintDialog({ isOpen, onOpenChange, onSubmit, order }: MessagePrintDialogProps) {
  const { settings } = useSettings();
  const searchParams = useSearchParams();

  // 설정 저장용 키
  const STORAGE_KEY_MSG_FONT = 'msg_print_msg_font';
  const STORAGE_KEY_MSG_SIZE = 'msg_print_msg_size';
  const STORAGE_KEY_SENDER_FONT = 'msg_print_sender_font';
  const STORAGE_KEY_SENDER_SIZE = 'msg_print_sender_size';

  // 로컬 스토리지에서 설정 불러오기
  const getStoredSetting = (key: string, defaultVal: any) => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key);
      if (stored) return stored;
    }
    return defaultVal;
  };
  // 시스템 설정 + 구글 폰트 통합 (이제 FontSelector에서 처리하므로 여기서는 간단히 유지 또는 제거 가능)
  // FontSelector는 GOOGLE_FONTS를 직접 사용함.

  // URL 파라미터에서 초기값 가져오기
  const getInitialValue = (paramName: string, defaultValue: string) => {
    return searchParams.get(paramName) || defaultValue;
  };

  const getInitialNumberValue = (paramName: string, defaultValue: number) => {
    const value = searchParams.get(paramName);
    return value ? parseInt(value) : defaultValue;
  };

  const getInitialPositions = () => {
    const positionsParam = searchParams.get('positions');
    if (positionsParam) {
      return positionsParam.split(',').map(p => parseInt(p)).filter(p => !isNaN(p));
    }
    return [1];
  };

  const [labelType, setLabelType] = useState(getInitialValue('labelType', 'formtec-3108'));
  const [startPosition, setStartPosition] = useState(getInitialNumberValue('start', 1));
  const [selectedPositions, setSelectedPositions] = useState<number[]>(getInitialPositions());

  // Font State with persistence
  const [messageFont, setMessageFont] = useState(getInitialValue('messageFont', 'Noto Sans KR'));
  const [messageFontSize, setMessageFontSize] = useState(getInitialNumberValue('messageFontSize', 14));
  const [senderFont, setSenderFont] = useState(getInitialValue('senderFont', 'Noto Sans KR'));
  const [senderFontSize, setSenderFontSize] = useState(getInitialNumberValue('senderFontSize', 12));

  // Load persisted settings on mount
  useEffect(() => {
    const savedMsgFont = getStoredSetting(STORAGE_KEY_MSG_FONT, 'Noto Sans KR');
    const savedMsgSize = parseInt(getStoredSetting(STORAGE_KEY_MSG_SIZE, '14'));
    const savedSenderFont = getStoredSetting(STORAGE_KEY_SENDER_FONT, 'Noto Sans KR');
    const savedSenderSize = parseInt(getStoredSetting(STORAGE_KEY_SENDER_SIZE, '12'));

    // Only override if URL params are not present (priority: URL > Storage > Default)
    if (!searchParams.get('messageFont')) setMessageFont(savedMsgFont);
    if (!searchParams.get('messageFontSize')) setMessageFontSize(savedMsgSize);
    if (!searchParams.get('senderFont')) setSenderFont(savedSenderFont);
    if (!searchParams.get('senderFontSize')) setSenderFontSize(savedSenderSize);
  }, []);

  // Save settings when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MSG_FONT, messageFont);
      localStorage.setItem(STORAGE_KEY_MSG_SIZE, String(messageFontSize));
      localStorage.setItem(STORAGE_KEY_SENDER_FONT, senderFont);
      localStorage.setItem(STORAGE_KEY_SENDER_SIZE, String(senderFontSize));
    }
  }, [messageFont, messageFontSize, senderFont, senderFontSize]);
  // 메시지 내용에서 보내는 사람 분리
  const messageParts = (order.message?.content || "").split('\n---\n');
  const defaultMessageContent = messageParts.length > 1 ? messageParts[0] : (order.message?.content || "");
  const defaultSenderName = messageParts.length > 1 ? messageParts[1] : "";
  const [messageContent, setMessageContent] = useState(getInitialValue('messageContent', defaultMessageContent));
  const [senderName, setSenderName] = useState(getInitialValue('senderName', defaultSenderName));
  // isEditing state removed as we rely on split view
  const handleFormSubmit = () => {
    onSubmit({
      orderId: order.id,
      labelType,
      startPosition, // Keep for compatibility, though selectedPositions is main
      messageFont,
      messageFontSize,
      senderFont,
      senderFontSize,
      messageContent,
      senderName,
      selectedPositions,
    });
  };

  const selectedLabel = labelTypes.find(lt => lt.value === labelType) || labelTypes[0];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>메시지 인쇄 옵션</DialogTitle>
          <DialogDescription>
            좌측에서 내용을 입력하고 우측에서 인쇄될 위치를 클릭하여 선택하세요. (자동 저장됨)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden min-h-0">
          {/* Left Panel: Controls (Scrollable) */}
          <div className="lg:col-span-4 space-y-4 overflow-y-auto pr-2">

            {/* 1. 라벨지 선택 */}
            <div className="space-y-2 border p-4 rounded-md">
              <Label htmlFor="label-type" className="font-bold">1. 라벨지 규격 선택</Label>
              <Select value={labelType} onValueChange={(value) => {
                setLabelType(value);
                // Reset selections when type changes to avoid out of bounds
                setSelectedPositions([]);
              }}>
                <SelectTrigger id="label-type">
                  <SelectValue placeholder="라벨지 선택" />
                </SelectTrigger>
                <SelectContent>
                  {labelTypes.map(lt => (
                    <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. 메시지 내용 입력 */}
            <div className="space-y-4 border p-4 rounded-md bg-muted/30">
              <Label className="font-bold">2. 내용 입력</Label>
              <div>
                <Label htmlFor="message-content" className="text-xs text-muted-foreground">메시지 본문</Label>
                <Textarea
                  id="message-content"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="메시지 입력"
                  className="mt-1 min-h-[100px]"
                />
              </div>
              <div>
                <Label htmlFor="sender-name" className="text-xs text-muted-foreground">보내는 분</Label>
                <Input
                  id="sender-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="이름 입력"
                  className="mt-1"
                />
              </div>
            </div>

            {/* 3. 폰트 스타일 설정 */}
            <div className="space-y-4 border p-4 rounded-md">
              <Label className="font-bold">3. 폰트 스타일</Label>

              {/* 메시지 폰트 */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">메시지 폰트</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <FontSelector value={messageFont} onValueChange={setMessageFont} />
                  </div>
                  <Input
                    type="number"
                    value={messageFontSize}
                    onChange={(e) => setMessageFontSize(Number(e.target.value))}
                    className="text-center"
                    placeholder="크기"
                  />
                </div>
              </div>

              {/* 보내는 사람 폰트 */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">보내는 분 폰트</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <FontSelector value={senderFont} onValueChange={setSenderFont} />
                  </div>
                  <Input
                    type="number"
                    value={senderFontSize}
                    onChange={(e) => setSenderFontSize(Number(e.target.value))}
                    className="text-center"
                    placeholder="크기"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: WYSIWYG Preview (Scrollable) */}
          <div className="lg:col-span-8 bg-gray-50 border rounded-lg p-4 flex flex-col items-center overflow-y-auto">
            <LabelGridSelector
              labelType={labelType}
              selectedPositions={selectedPositions}
              onPositionToggle={(pos) => {
                if (selectedPositions.includes(pos)) {
                  setSelectedPositions(prev => prev.filter(p => p !== pos));
                } else {
                  setSelectedPositions(prev => [...prev, pos]);
                }
              }}
              onSelectAll={() => setSelectedPositions(Array.from({ length: selectedLabel.cells }, (_, i) => i + 1))}
              onClearAll={() => setSelectedPositions([])}
              onSelectFirst={() => setSelectedPositions([1])}
              messageContent={messageContent}
              senderName={senderName}
              messageFont={messageFont}
              messageFontSize={messageFontSize}
              senderFont={senderFont}
              senderFontSize={senderFontSize}
            />
          </div>
        </div>
        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">취소</Button>
          </DialogClose>
          <Button type="button" onClick={handleFormSubmit} disabled={!messageContent || selectedPositions.length === 0}>
            <Printer className="mr-2 h-4 w-4" /> 인쇄 미리보기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
