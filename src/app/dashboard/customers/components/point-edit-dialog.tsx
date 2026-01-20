"use client"
import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Customer } from "@/hooks/use-customers"
import { Coins, TrendingUp, TrendingDown, AlertCircle } from "lucide-react"

interface PointEditDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  customer: Customer | null
  onPointUpdate: (customerId: string, newPoints: number, reason: string, modifier: string) => Promise<void>
}

interface PointHistory {
  timestamp: Date
  previousPoints: number
  newPoints: number
  difference: number
  reason: string
  modifier: string
}

export function PointEditDialog({ isOpen, onOpenChange, customer, onPointUpdate }: PointEditDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [newPoints, setNewPoints] = useState<number>(customer?.points || 0)
  const [reason, setReason] = useState("")
  const [reasonType, setReasonType] = useState<string>("")

  // 포인트 수정 이유 옵션
  const reasonOptions = [
    { value: "manual_adjustment", label: "수동 조정", description: "관리자가 직접 포인트를 조정" },
    { value: "correction", label: "오류 수정", description: "포인트 계산 오류나 시스템 오류로 인한 수정" },
    { value: "compensation", label: "보상", description: "고객 불만이나 서비스 문제에 대한 보상" },
    { value: "promotion", label: "프로모션", description: "이벤트나 프로모션으로 인한 포인트 지급" },
    { value: "refund", label: "환불", description: "주문 취소나 환불로 인한 포인트 회수" },
    { value: "expiration", label: "만료", description: "포인트 만료로 인한 차감" },
    { value: "other", label: "기타", description: "기타 사유" }
  ]

  // 다이얼로그가 열릴 때 포인트 초기화
  React.useEffect(() => {
    if (isOpen && customer) {
      setNewPoints(customer.points || 0)
      setReason("")
      setReasonType("")
    }
  }, [isOpen, customer])

  const handleSubmit = async () => {
    if (!customer || !user) return

    if (!reasonType) {
      toast({
        title: "오류",
        description: "포인트 수정 사유를 선택해주세요.",
        variant: "destructive"
      })
      return
    }

    if (!reason.trim()) {
      toast({
        title: "오류",
        description: "포인트 수정 사유를 입력해주세요.",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    try {
      await onPointUpdate(
        customer.id,
        newPoints,
        reason,
        user.displayName || user.email || "관리자"
      )

      toast({
        title: "성공",
        description: "포인트가 성공적으로 수정되었습니다.",
      })

      onOpenChange(false)
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("포인트 수정 오류:", error);
      }
      toast({
        title: "오류",
        description: "포인트 수정 중 오류가 발생했습니다.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const currentPoints = customer?.points || 0
  const difference = newPoints - currentPoints
  const isIncrease = difference > 0
  const isDecrease = difference < 0

  if (!customer) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            포인트 수정
          </DialogTitle>
          <DialogDescription>
            고객의 포인트를 수정합니다. 수정 사유와 함께 이력이 기록됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-6 pr-4">
            {/* 고객 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">고객 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">고객명</Label>
                    <p className="font-medium">{customer.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">현재 포인트</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-lg">
                        {currentPoints.toLocaleString()} P
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 포인트 수정 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">포인트 수정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="new-points">새로운 포인트</Label>
                  <Input
                    id="new-points"
                    type="number"
                    value={newPoints}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || value === '-') {
                        setNewPoints(0);
                      } else {
                        const numValue = parseInt(value, 10);
                        if (!isNaN(numValue)) {
                          setNewPoints(numValue);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // 포인트 입력 필드에서 포커스가 벗어날 때 값 정규화
                      const value = parseInt(e.target.value, 10);
                      if (isNaN(value) || value < 0) {
                        setNewPoints(0);
                      } else {
                        setNewPoints(value);
                      }
                    }}
                    placeholder="0"
                    className="mt-1"
                    autoComplete="off"
                  />
                </div>

                {/* 포인트 변화 표시 */}
                {difference !== 0 && (
                  <div className={`p-3 rounded-lg border ${isIncrease ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-center gap-2">
                      {isIncrease ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`font-medium ${isIncrease ? 'text-green-700' : 'text-red-700'
                        }`}>
                        {isIncrease ? '+' : ''}{difference.toLocaleString()} P
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({isIncrease ? '증가' : '감소'})
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 수정 사유 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">수정 사유</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="reason-type">수정 사유 유형</Label>
                  <Select value={reasonType} onValueChange={setReasonType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="수정 사유를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasonOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div>
                            <div className="font-medium">{option.label}</div>
                            <div className="text-sm text-muted-foreground">{option.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="reason">상세 사유</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="포인트 수정 사유를 상세히 입력하세요..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 수정자 정보 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">수정자 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">수정자</Label>
                    <p className="font-medium">{user?.displayName || user?.email || "관리자"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">수정 일시</Label>
                    <p className="font-medium">{new Date().toLocaleString('ko-KR')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 주의사항 */}
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">주의사항</p>
                <p>포인트 수정은 고객에게 직접적인 영향을 미치므로 신중하게 진행해주세요. 모든 수정 내역은 이력으로 기록됩니다.</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 flex-shrink-0 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || difference === 0}
          >
            {isLoading ? "수정 중..." : "포인트 수정"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
