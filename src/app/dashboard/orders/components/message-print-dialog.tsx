
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Printer, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Order } from "@/hooks/use-orders";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/use-settings";
import { useSearchParams } from "next/navigation";
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
  
  // 시스템 설정에서 폰트 목록 가져오기
  const fontOptions = (settings.availableFonts || [
    'Noto Sans KR',
    'Malgun Gothic',
    'Nanum Gothic',
    'Arial',
    'Helvetica',
    'Times New Roman'
  ]).map(font => ({
    value: font,
    label: font
  }));

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
  const [messageFont, setMessageFont] = useState(getInitialValue('messageFont', fontOptions[0].value));
  const [messageFontSize, setMessageFontSize] = useState(getInitialNumberValue('messageFontSize', 14));
  const [senderFont, setSenderFont] = useState(getInitialValue('senderFont', fontOptions[0].value));
  const [senderFontSize, setSenderFontSize] = useState(getInitialNumberValue('senderFontSize', 12));
  // 메시지 내용에서 보내는 사람 분리
  const messageParts = (order.message?.content || "").split('\n---\n');
  const defaultMessageContent = messageParts.length > 1 ? messageParts[0] : (order.message?.content || "");
  const defaultSenderName = messageParts.length > 1 ? messageParts[1] : "";
  const [messageContent, setMessageContent] = useState(getInitialValue('messageContent', defaultMessageContent));
  const [senderName, setSenderName] = useState(getInitialValue('senderName', defaultSenderName));
  const [isEditing, setIsEditing] = useState(false);
  const selectedLabel = labelTypes.find(lt => lt.value === labelType) || labelTypes[0];
  const handleFormSubmit = () => {
    onSubmit({
        orderId: order.id,
        labelType,
        startPosition,
        messageFont,
        messageFontSize,
        senderFont,
        senderFontSize,
        messageContent,
        senderName,
        selectedPositions,
    });
  };
  const messagePreviewStyle: React.CSSProperties = {
    fontFamily: messageFont,
    fontSize: `${messageFontSize}pt`,
  };
  const senderPreviewStyle: React.CSSProperties = {
    fontFamily: senderFont,
    fontSize: `${senderFontSize}pt`,
  };
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>메시지 인쇄 옵션</DialogTitle>
          <DialogDescription>
            &apos;{order.orderer.name}&apos;님의 메시지를 인쇄합니다. 메시지 편집과 폰트 설정이 가능합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 설정 영역 */}
          <div className="space-y-4">
            {/* 메시지 편집 */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm font-medium">메시지 편집</Label>
                                 <Button
                   type="button"
                   variant="outline"
                   size="sm"
                   onClick={() => setIsEditing(!isEditing)}
                   aria-label={isEditing ? "미리보기 모드로 전환" : "편집 모드로 전환"}
                 >
                   <Edit3 className="mr-2 h-4 w-4" />
                   {isEditing ? "미리보기" : "편집"}
                 </Button>
              </div>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="message-content">메시지 내용</Label>
                                         <Textarea
                       id="message-content"
                       name="message-content"
                       value={messageContent}
                       onChange={(e) => setMessageContent(e.target.value)}
                       placeholder="메시지 내용을 입력하세요"
                       className="mt-1"
                       rows={4}
                       autoComplete="off"
                     />
                  </div>
                  <div>
                    <Label htmlFor="sender-name">보내는 사람</Label>
                                                               <Input
                        id="sender-name"
                        name="sender-name"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="보내는 사람 이름 (예: - 홍길동 -)"
                        className="mt-1"
                        autoComplete="off"
                      />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  편집 버튼을 클릭하여 메시지를 수정할 수 있습니다.
                </div>
              )}
            </div>
            {/* 폰트 설정 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">메시지 폰트 설정</Label>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="message-font">폰트</Label>
                      <Select value={messageFont} onValueChange={setMessageFont}>
                        <SelectTrigger id="message-font" name="message-font">
                          <SelectValue placeholder="폰트 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map(fo => (
                            <SelectItem key={fo.value} value={fo.value} style={{fontFamily: fo.value}}>{fo.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="message-font-size">글자 크기 (pt)</Label>
                      <Input 
                        id="message-font-size" 
                        name="message-font-size"
                        type="number" 
                        value={messageFontSize} 
                        onChange={(e) => setMessageFontSize(Number(e.target.value) || 14)} 
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">보내는 사람 폰트 설정</Label>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="sender-font">폰트</Label>
                      <Select value={senderFont} onValueChange={setSenderFont}>
                        <SelectTrigger id="sender-font" name="sender-font">
                          <SelectValue placeholder="폰트 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map(fo => (
                            <SelectItem key={fo.value} value={fo.value} style={{fontFamily: fo.value}}>{fo.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sender-font-size">글자 크기 (pt)</Label>
                      <Input 
                        id="sender-font-size" 
                        name="sender-font-size"
                        type="number" 
                        value={senderFontSize} 
                        onChange={(e) => setSenderFontSize(Number(e.target.value) || 12)} 
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* 라벨지 설정 */}
            <div>
              <Label htmlFor="label-type">라벨지 종류</Label>
              <Select value={labelType} onValueChange={(value) => { 
                setLabelType(value); 
                setStartPosition(1); 
                setSelectedPositions([1]); 
              }}>
                <SelectTrigger id="label-type" name="label-type">
                  <SelectValue placeholder="라벨지 선택" />
                </SelectTrigger>
                <SelectContent>
                  {labelTypes.map(lt => (
                    <SelectItem key={lt.value} value={lt.value}>{lt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label id="start-position" htmlFor="start-position">출력 위치 선택 (1-{selectedLabel.cells})</Label>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPositions([1])}
                  className="text-xs"
                >
                  첫 번째만
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPositions(Array.from({ length: selectedLabel.cells }, (_, i) => i + 1))}
                  className="text-xs"
                >
                  전체 선택
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPositions([])}
                  className="text-xs"
                >
                  전체 해제
                </Button>
              </div>
              <div className={cn("grid gap-1 mt-2 border p-2 rounded-md", selectedLabel.gridCols)} role="group" aria-labelledby="start-position">
                {Array.from({ length: selectedLabel.cells }).map((_, i) => {
                  const position = i + 1;
                  const isSelected = selectedPositions.includes(position);
                  return (
                    <Button
                      key={position}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("h-8", isSelected && "bg-primary text-primary-foreground")}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPositions(prev => prev.filter(p => p !== position));
                        } else {
                          setSelectedPositions(prev => [...prev, position]);
                        }
                      }}
                      aria-pressed={isSelected}
                      aria-label={`위치 ${position} ${isSelected ? '해제' : '선택'}`}
                    >
                      {position}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                선택된 위치: {selectedPositions.length > 0 ? selectedPositions.join(', ') : '없음'} 
                ({selectedPositions.length}개)
              </p>
            </div>
          </div>
          {/* 미리보기 영역 */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <Label className="text-sm font-medium mb-3 block">실시간 미리보기 ({selectedLabel.label})</Label>
            {/* 단일 라벨 미리보기 */}
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-2 block">선택된 라벨 미리보기</Label>
              <div 
                className="p-4 border rounded-md bg-white text-center relative overflow-hidden"
                style={{ 
                  minHeight: "200px",
                  maxHeight: "400px",
                  height: selectedLabel.height 
                }}
              >
                <div 
                  className="whitespace-pre-wrap mb-4 flex items-center justify-center h-full"
                  style={messagePreviewStyle}
                >
                  {messageContent || "메시지 내용이 없습니다."}
                </div>
                {senderName && (
                  <div 
                    className="absolute bottom-2 left-1/2 transform -translate-x-1/2"
                    style={senderPreviewStyle}
                  >
                    {senderName}
                  </div>
                )}
              </div>
            </div>
            {/* 전체 라벨 그리드 미리보기 */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                전체 라벨 레이아웃 (선택된 위치: {selectedPositions.length > 0 ? selectedPositions.join(', ') : '없음'})
              </Label>
              <div className={cn("grid gap-1 border p-2 rounded-md bg-white", selectedLabel.gridCols)}>
                {Array.from({ length: selectedLabel.cells }).map((_, i) => {
                  const position = i + 1;
                  const isSelected = selectedPositions.includes(position);
                  return (
                    <div
                      key={position}
                      className={cn(
                        "border rounded p-2 text-center text-xs min-h-[60px] flex items-center justify-center",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-gray-50"
                      )}
                    >
                      {isSelected ? (
                        <div className="text-center">
                          <div className="font-medium">메시지</div>
                          <div className="text-xs opacity-75">위치 {position}</div>
                        </div>
                      ) : (
                        <div className="text-gray-400">빈 라벨</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              라벨 크기: {selectedLabel.height} / 총 {selectedLabel.cells}칸
            </div>
          </div>
        </div>
        <DialogFooter className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">취소</Button>
          </DialogClose>
          <Button type="button" onClick={handleFormSubmit} disabled={!messageContent || selectedPositions.length === 0}>
            <Printer className="mr-2 h-4 w-4"/> 인쇄 미리보기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
