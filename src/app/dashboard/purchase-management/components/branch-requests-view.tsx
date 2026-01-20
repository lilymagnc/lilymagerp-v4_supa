"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, AlertTriangle, Building2, Clock } from 'lucide-react';
import type { MaterialRequest } from '@/types/material-request';
interface BranchRequestsViewProps {
  requests: MaterialRequest[];
  branchStats: Array<{
    branchId: string;
    branchName: string;
    requestCount: number;
    totalCost: number;
    itemCount: number;
    urgentCount: number;
  }>;
  selectedRequests: string[];
  onToggleRequest: (requestId: string) => void;
}
export function BranchRequestsView({ 
  requests, 
  branchStats, 
  selectedRequests, 
  onToggleRequest 
}: BranchRequestsViewProps) {
  const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
  const toggleExpanded = (branchId: string) => {
    const newExpanded = new Set(expandedBranches);
    if (newExpanded.has(branchId)) {
      newExpanded.delete(branchId);
    } else {
      newExpanded.add(branchId);
    }
    setExpandedBranches(newExpanded);
  };
  const expandAll = () => {
    setExpandedBranches(new Set(branchStats.map(stat => stat.branchId)));
  };
  const collapseAll = () => {
    setExpandedBranches(new Set());
  };
  // 지점별로 요청 그룹화
  const requestsByBranch = requests.reduce((acc, request) => {
    if (!acc[request.branchId]) {
      acc[request.branchId] = [];
    }
    acc[request.branchId].push(request);
    return acc;
  }, {} as Record<string, MaterialRequest[]>);
  const formatDate = (timestamp: any) => {
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleDateString('ko-KR');
    }
    if (timestamp instanceof Date) {
      return timestamp.toLocaleDateString('ko-KR');
    }
    return '-';
  };
  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      submitted: '제출됨',
      reviewing: '검토중',
      purchasing: '구매중',
      purchased: '구매완료',
      shipping: '배송중',
      delivered: '배송완료',
      completed: '완료'
    };
    return labels[status] || status;
  };
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-800',
      reviewing: 'bg-yellow-100 text-yellow-800',
      purchasing: 'bg-orange-100 text-orange-800',
      purchased: 'bg-green-100 text-green-800',
      shipping: 'bg-purple-100 text-purple-800',
      delivered: 'bg-indigo-100 text-indigo-800',
      completed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };
  if (branchStats.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">처리할 요청이 없습니다</h3>
          <p className="text-muted-foreground text-center">
            현재 제출되거나 검토 중인 지점 요청이 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {/* 컨트롤 버튼 */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>
          모두 펼치기
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          모두 접기
        </Button>
      </div>
      {/* 지점별 요청 목록 */}
      <div className="space-y-3">
        {branchStats
          .sort((a, b) => b.urgentCount - a.urgentCount || b.totalCost - a.totalCost)
          .map((stat) => {
            const isExpanded = expandedBranches.has(stat.branchId);
            const branchRequests = requestsByBranch[stat.branchId] || [];
            const selectedCount = branchRequests.filter(req => 
              selectedRequests.includes(req.id)
            ).length;
            return (
              <Card key={stat.branchId} className={stat.urgentCount > 0 ? 'border-red-200' : ''}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(stat.branchId)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-lg">{stat.branchName}</CardTitle>
                              {stat.urgentCount > 0 && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  긴급 {stat.urgentCount}건
                                </Badge>
                              )}
                              {selectedCount > 0 && (
                                <Badge variant="secondary">
                                  {selectedCount}/{stat.requestCount} 선택됨
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>요청: <strong>{stat.requestCount}건</strong></span>
                              <span>품목: <strong>{stat.itemCount}개</strong></span>
                              <span>예상 비용: <strong>₩{stat.totalCost.toLocaleString()}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-muted-foreground mb-2">
                          요청 상세 내역
                        </div>
                        {branchRequests
                          .sort((a, b) => {
                            // 긴급 요청 우선 정렬
                            const aUrgent = a.requestedItems.some(item => item.urgency === 'urgent');
                            const bUrgent = b.requestedItems.some(item => item.urgency === 'urgent');
                            if (aUrgent && !bUrgent) return -1;
                            if (!aUrgent && bUrgent) return 1;
                            // 그 다음 생성일 기준 정렬
                            const aTime = a.createdAt?.seconds || 0;
                            const bTime = b.createdAt?.seconds || 0;
                            return bTime - aTime;
                          })
                          .map((request) => {
                            const isSelected = selectedRequests.includes(request.id);
                            const hasUrgent = request.requestedItems.some(item => item.urgency === 'urgent');
                            const totalCost = request.requestedItems.reduce((sum, item) => 
                              sum + (item.requestedQuantity * item.estimatedPrice), 0
                            );
                            return (
                              <div 
                                key={request.id}
                                className={`p-4 rounded-lg border ${
                                  isSelected ? 'bg-blue-50 border-blue-200' : 'bg-muted/30'
                                } ${hasUrgent ? 'border-l-4 border-l-red-500' : ''}`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-start gap-3">
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => onToggleRequest(request.id)}
                                      className="mt-1"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold">{request.requestNumber}</span>
                                        <Badge className={getStatusColor(request.status)}>
                                          {getStatusLabel(request.status)}
                                        </Badge>
                                        {hasUrgent && (
                                          <Badge variant="destructive">긴급</Badge>
                                        )}
                                      </div>
                                      <div className="text-sm text-muted-foreground mb-2">
                                        요청자: {request.requesterName} • 
                                        요청일: {formatDate(request.createdAt)}
                                      </div>
                                      <div className="text-sm">
                                        <span className="text-muted-foreground">품목: </span>
                                        <span className="font-medium">{request.requestedItems.length}개</span>
                                        <span className="text-muted-foreground ml-3">예상 비용: </span>
                                        <span className="font-medium">₩{totalCost.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {/* 요청 품목 목록 */}
                                <div className="ml-8 space-y-2">
                                  {request.requestedItems.map((item, index) => (
                                    <div 
                                      key={index}
                                      className="flex items-center justify-between text-sm p-2 bg-white/50 rounded"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{item.materialName}</span>
                                        {item.urgency === 'urgent' && (
                                          <Badge variant="destructive">긴급</Badge>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <div>{item.requestedQuantity.toLocaleString()}개</div>
                                        <div className="text-xs text-muted-foreground">
                                          ₩{(item.requestedQuantity * item.estimatedPrice).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {/* 메모가 있는 경우 */}
                                {request.requestedItems.some(item => item.memo) && (
                                  <div className="ml-8 mt-2 text-xs text-muted-foreground">
                                    <div className="font-medium mb-1">메모:</div>
                                    {request.requestedItems
                                      .filter(item => item.memo)
                                      .map((item, index) => (
                                        <div key={index}>• {item.materialName}: {item.memo}</div>
                                      ))
                                    }
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
      </div>
      {/* 하단 요약 */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{branchStats.length}</div>
              <div className="text-sm text-muted-foreground">요청 지점 수</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {branchStats.reduce((sum, stat) => sum + stat.requestCount, 0)}
              </div>
              <div className="text-sm text-muted-foreground">총 요청 건수</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {branchStats.reduce((sum, stat) => sum + stat.itemCount, 0)}
              </div>
              <div className="text-sm text-muted-foreground">총 품목 수</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                ₩{branchStats.reduce((sum, stat) => sum + stat.totalCost, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">예상 총 비용</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
