"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Clock, X } from "lucide-react";
import { useDisplayBoard } from "@/hooks/use-display-board";
import { DisplayBoardItem } from "@/types/order-transfer";

export function DisplayBoard() {
  const { displayItems, deactivateDisplayItem } = useDisplayBoard();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

           const getStatusColor = (status: string) => {
           switch (status) {
             case 'pending':
               return 'bg-yellow-100 text-yellow-800';
             case 'accepted':
               return 'bg-green-100 text-green-800';
             case 'rejected':
               return 'bg-red-100 text-red-800';
             case 'completed':
               return 'bg-blue-100 text-blue-800';
             case 'cancelled':
               return 'bg-gray-100 text-gray-800';
             default:
               return 'bg-gray-100 text-gray-800';
           }
         };

           const getStatusText = (status: string) => {
           switch (status) {
             case 'pending':
               return '대기중';
             case 'accepted':
               return '수락됨';
             case 'rejected':
               return '거절됨';
             case 'completed':
               return '완료됨';
             case 'cancelled':
               return '취소됨';
             default:
               return '알 수 없음';
           }
         };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">주문 이관 전광판</h1>
                <p className="text-gray-600">실시간 주문 이관 현황</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-gray-900">
                {formatTime(currentTime)}
              </div>
              <div className="text-lg text-gray-600">
                {formatDate(currentTime)}
              </div>
            </div>
          </div>
        </div>

        {/* 전광판 내용 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayItems.length === 0 ? (
            <div className="col-span-full">
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <Monitor className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">현재 표시할 이관 주문이 없습니다</p>
                    <p className="text-sm">새로운 주문 이관이 발생하면 여기에 표시됩니다</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            displayItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <span className="text-blue-600">#{item.transferId}</span>
                      <Badge className={getStatusColor(item.status)}>
                        {getStatusText(item.status)}
                      </Badge>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deactivateDisplayItem(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 주문 정보 표시 */}
                  {item.orderNumber && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-600 font-semibold">주문번호</span>
                        <span className="font-mono text-sm">{item.orderNumber}</span>
                      </div>
                      
                      {/* 배송 정보 */}
                      {(item.deliveryDate || item.deliveryTime) && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">배송일:</span>
                            <span className="ml-1 font-medium">{item.deliveryDate || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">배송시간:</span>
                            <span className="ml-1 font-medium">{item.deliveryTime || '-'}</span>
                          </div>
                        </div>
                      )}
                      
                      {/* 수령인 정보 */}
                      {item.recipientName && (
                        <div className="mt-2">
                          <span className="text-gray-600 text-sm">수령인:</span>
                          <span className="ml-1 font-medium">{item.recipientName}</span>
                          {item.recipientContact && (
                            <span className="ml-2 text-gray-500">({item.recipientContact})</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">발주지점</p>
                      <p className="font-semibold">{item.orderBranchName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">수주지점</p>
                      <p className="font-semibold">{item.processBranchName}</p>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 text-sm">주문 금액</p>
                    <p className="font-bold text-lg text-green-600">
                      {item.orderAmount.toLocaleString()}원
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-500 text-sm">이관 사유</p>
                    <p className="text-sm">{item.transferReason}</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>
                      {new Date(item.createdAt.toDate()).toLocaleString('ko-KR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 하단 정보 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              총 {displayItems.length}개의 이관 주문이 표시 중
            </div>
            <div>
              자동 새로고침: 30초마다
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
