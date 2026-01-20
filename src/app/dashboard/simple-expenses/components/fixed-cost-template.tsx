"use client";
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  RotateCcw, 
  Save, 
  Plus,
  Trash2,
  Calendar
} from 'lucide-react';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { 
  FixedCostItem,
  SimpleExpenseCategory,
  FixedCostSubCategory,
  UtilitySubCategory,
  DEFAULT_FIXED_COST_ITEMS,
  SIMPLE_EXPENSE_CATEGORY_LABELS,
  FIXED_COST_SUB_CATEGORY_LABELS,
  UTILITY_SUB_CATEGORY_LABELS,
  formatCurrency
} from '@/types/simple-expense';
interface FixedCostTemplateProps {
  onSuccess?: () => void;
}
export function FixedCostTemplate({ onSuccess }: FixedCostTemplateProps) {
  const [items, setItems] = useState<FixedCostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { 
    fetchFixedCostTemplate, 
    saveFixedCostTemplate, 
    addFixedCosts 
  } = useSimpleExpenses();
  const { user } = useAuth();
  const { toast } = useToast();
  // 템플릿 로드
  useEffect(() => {
    const loadTemplate = async () => {
      if (!user?.branchId) return;
      setLoading(true);
      try {
        const template = await fetchFixedCostTemplate(user.branchId);
        if (template) {
          setItems(template.items);
        } else {
          // 기본 템플릿 생성
          const defaultItems: FixedCostItem[] = DEFAULT_FIXED_COST_ITEMS.map((item, index) => ({
            ...item,
            id: `default-${index}`
          }));
          setItems(defaultItems);
        }
      } catch (error) {
        console.error('템플릿 로드 오류:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTemplate();
  }, [user?.branchId, fetchFixedCostTemplate]);
  // 항목 수정
  const updateItem = (id: string, field: keyof FixedCostItem, value: any) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  // 항목 추가
  const addItem = () => {
    const newItem: FixedCostItem = {
      id: `new-${Date.now()}`,
      name: '',
      category: SimpleExpenseCategory.FIXED_COST,
      subCategory: FixedCostSubCategory.RENT,
      amount: 0,
      supplier: '',
      isActive: true,
      dueDay: 1
    };
    setItems(prev => [...prev, newItem]);
  };
  // 항목 삭제
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };
  // 템플릿 저장
  const handleSaveTemplate = async () => {
    if (!user?.branchId || !user?.branchName) return;
    setLoading(true);
    try {
      const success = await saveFixedCostTemplate(
        user.branchId,
        user.branchName,
        items
      );
      if (success) {
        toast({
          title: "템플릿 저장 완료",
          description: "고정비 템플릿이 저장되었습니다."
        });
      }
    } catch (error) {
      console.error('템플릿 저장 오류:', error);
    } finally {
      setLoading(false);
    }
  };
  // 고정비 일괄 입력
  const handleBulkInput = async () => {
    if (!user?.branchId || !user?.branchName) return;
    const activeItems = items.filter(item => item.isActive && item.amount > 0);
    if (activeItems.length === 0) {
      toast({
        variant: "destructive",
        title: "입력할 항목이 없습니다",
        description: "활성화된 고정비 항목을 확인해주세요."
      });
      return;
    }
    setLoading(true);
    try {
      const success = await addFixedCosts(
        user.branchId,
        user.branchName,
        activeItems,
        new Date(selectedDate)
      );
      if (success) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('고정비 일괄 입력 오류:', error);
    } finally {
      setLoading(false);
    }
  };
  // 기본 템플릿으로 초기화
  const resetToDefault = () => {
    const defaultItems: FixedCostItem[] = DEFAULT_FIXED_COST_ITEMS.map((item, index) => ({
      ...item,
      id: `default-${index}`
    }));
    setItems(defaultItems);
  };
  // 총 금액 계산
  const totalAmount = items
    .filter(item => item.isActive)
    .reduce((sum, item) => sum + item.amount, 0);
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">템플릿을 불러오는 중...</div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          월 고정비 입력
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 날짜 선택 */}
        <div className="flex items-center gap-4">
          <Label htmlFor="date">입력 날짜:</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-auto"
          />
        </div>
        {/* 고정비 목록 */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">활성</TableHead>
                <TableHead>항목명</TableHead>
                <TableHead>분류</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>구매처</TableHead>
                <TableHead>결제일</TableHead>
                <TableHead className="w-12">삭제</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Switch
                      checked={item.isActive}
                      onCheckedChange={(checked) => updateItem(item.id, 'isActive', checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                      placeholder="항목명"
                      className="min-w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {item.category === SimpleExpenseCategory.FIXED_COST 
                        ? FIXED_COST_SUB_CATEGORY_LABELS[item.subCategory as FixedCostSubCategory]
                        : UTILITY_SUB_CATEGORY_LABELS[item.subCategory as UtilitySubCategory]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateItem(item.id, 'amount', Number(e.target.value))}
                      placeholder="0"
                      className="min-w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.supplier}
                      onChange={(e) => updateItem(item.id, 'supplier', e.target.value)}
                      placeholder="구매처"
                      className="min-w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={item.dueDay || ''}
                      onChange={(e) => updateItem(item.id, 'dueDay', Number(e.target.value))}
                      placeholder="일"
                      className="w-16"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* 요약 정보 */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">
              활성 항목: {items.filter(item => item.isActive).length}개
            </div>
            <div className="text-lg font-semibold">
              총 금액: {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>
        {/* 버튼 그룹 */}
        <div className="flex gap-2">
          <Button onClick={addItem} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            항목 추가
          </Button>
          <Button onClick={handleSaveTemplate} variant="outline" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            템플릿 저장
          </Button>
          <Button onClick={resetToDefault} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            기본값으로 초기화
          </Button>
          <Button 
            onClick={handleBulkInput} 
            disabled={loading || totalAmount === 0}
            className="ml-auto"
          >
            <Calendar className="mr-2 h-4 w-4" />
            {loading ? '입력 중...' : '일괄 입력'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
