"use client";
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, AlertTriangle, Package } from 'lucide-react';
import type { ConsolidatedItem } from '@/types/material-request';
interface ConsolidatedItemsViewProps {
  items: ConsolidatedItem[];
  selectedRequests: string[];
  onToggleRequest: (requestId: string) => void;
}
export function ConsolidatedItemsView({ 
  items, 
  selectedRequests, 
  onToggleRequest 
}: ConsolidatedItemsViewProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const toggleExpanded = (materialId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(materialId)) {
      newExpanded.delete(materialId);
    } else {
      newExpanded.add(materialId);
    }
    setExpandedItems(newExpanded);
  };
  const expandAll = () => {
    setExpandedItems(new Set(items.map(item => item.materialId)));
  };
  const collapseAll = () => {
    setExpandedItems(new Set());
  };
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">처리할 요청이 없습니다</h3>
          <p className="text-muted-foreground text-center">
            현재 제출되거나 검토 중인 자재 요청이 없습니다.
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
      {/* 자재별 취합 목록 */}
      <div className="space-y-3">
        {items.map((item) => {
          const isExpanded = expandedItems.has(item.materialId);
          const hasUrgent = item.requestingBranches.some(branch => branch.urgency === 'urgent');
          const selectedBranchCount = item.requestingBranches.filter(branch => 
            selectedRequests.includes(branch.requestId)
          ).length;
          return (
            <Card key={item.materialId} className={hasUrgent ? 'border-red-200' : ''}>
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(item.materialId)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">{item.materialName}</CardTitle>
                            {hasUrgent && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                긴급
                              </Badge>
                            )}
                            {selectedBranchCount > 0 && (
                              <Badge variant="secondary">
                                {selectedBranchCount}/{item.requestingBranches.length} 선택됨
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>총 필요량: <strong>{item.totalQuantity.toLocaleString()}개</strong></span>
                            <span>요청 지점: <strong>{item.requestingBranches.length}곳</strong></span>
                            <span>예상 비용: <strong>₩{item.estimatedTotalCost.toLocaleString()}</strong></span>
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
                        요청 지점별 상세 내역
                      </div>
                      {item.requestingBranches.map((branch, index) => {
                        const isSelected = selectedRequests.includes(branch.requestId);
                        return (
                          <div 
                            key={`${branch.requestId}-${index}`}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isSelected ? 'bg-blue-50 border-blue-200' : 'bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => onToggleRequest(branch.requestId)}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{branch.branchName}</span>
                                  {branch.urgency === 'urgent' && (
                                    <Badge variant="destructive">긴급</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  요청 수량: {branch.quantity.toLocaleString()}개
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                ₩{(branch.quantity * (item.estimatedTotalCost / item.totalQuantity)).toLocaleString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                예상 비용
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {/* 자재별 요약 */}
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">총 필요량</div>
                            <div className="font-semibold">{item.totalQuantity.toLocaleString()}개</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">평균 단가</div>
                            <div className="font-semibold">
                              ₩{Math.round(item.estimatedTotalCost / item.totalQuantity).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">예상 총 비용</div>
                            <div className="font-semibold">₩{item.estimatedTotalCost.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
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
              <div className="text-2xl font-bold text-blue-600">{items.length}</div>
              <div className="text-sm text-muted-foreground">총 자재 종류</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {items.reduce((sum, item) => sum + item.totalQuantity, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">총 필요량</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {items.reduce((sum, item) => sum + item.requestingBranches.length, 0)}
              </div>
              <div className="text-sm text-muted-foreground">총 요청 건수</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                ₩{items.reduce((sum, item) => sum + item.estimatedTotalCost, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">예상 총 비용</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
