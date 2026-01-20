"use client"
import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { collection, query, where, orderBy, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Coins, TrendingUp, TrendingDown, History } from "lucide-react"

interface PointHistory {
  id: string
  customerId: string
  customerName: string
  customerContact: string
  previousPoints: number
  newPoints: number
  difference: number
  reason: string
  modifier: string
  timestamp: any
}

interface PointHistoryDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  customerId: string
  customerName: string
}

export function PointHistoryDialog({ isOpen, onOpenChange, customerId, customerName }: PointHistoryDialogProps) {
  const [pointHistory, setPointHistory] = useState<PointHistory[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && customerId) {
      fetchPointHistory()
    }
  }, [isOpen, customerId])

  const fetchPointHistory = async () => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'pointHistory'),
        where('customerId', '==', customerId),
        orderBy('timestamp', 'desc')
      )
      const querySnapshot = await getDocs(q)
      const history = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PointHistory[]
      setPointHistory(history)
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('포인트 이력 조회 오류:', error);
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: any) => {
    try {
      if (timestamp?.toDate) {
        return format(timestamp.toDate(), 'yyyy년 MM월 dd일 HH:mm', { locale: ko })
      }
      if (timestamp instanceof Date) {
        return format(timestamp, 'yyyy년 MM월 dd일 HH:mm', { locale: ko })
      }
      return '-'
    } catch (error) {
      return '-'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            포인트 수정 이력
          </DialogTitle>
          <DialogDescription>
            {customerName} 고객의 포인트 수정 이력을 확인합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">이력을 불러오는 중...</p>
            </div>
          ) : pointHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>포인트 수정 이력이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 요약 정보 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">요약 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {pointHistory.filter(h => h.difference > 0).length}
                      </p>
                      <p className="text-sm text-muted-foreground">증가 횟수</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {pointHistory.filter(h => h.difference < 0).length}
                      </p>
                      <p className="text-sm text-muted-foreground">감소 횟수</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {pointHistory.length}
                      </p>
                      <p className="text-sm text-muted-foreground">총 수정 횟수</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 이력 테이블 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">상세 이력</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>수정일시</TableHead>
                          <TableHead>변화</TableHead>
                          <TableHead>이전 포인트</TableHead>
                          <TableHead>새 포인트</TableHead>
                          <TableHead>수정자</TableHead>
                          <TableHead>사유</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pointHistory.map((history) => (
                          <TableRow key={history.id}>
                            <TableCell className="text-sm">
                              {formatDate(history.timestamp)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {history.difference > 0 ? (
                                  <TrendingUp className="h-4 w-4 text-green-600" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-600" />
                                )}
                                <Badge variant={history.difference > 0 ? "default" : "destructive"}>
                                  {history.difference > 0 ? '+' : ''}{history.difference.toLocaleString()} P
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {history.previousPoints.toLocaleString()} P
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {history.newPoints.toLocaleString()} P
                            </TableCell>
                            <TableCell className="text-sm">
                              {history.modifier}
                            </TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate" title={history.reason}>
                              {history.reason}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
