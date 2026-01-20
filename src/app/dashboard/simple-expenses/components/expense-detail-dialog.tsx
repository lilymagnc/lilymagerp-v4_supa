"use client";

import React, { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CalendarIcon, Edit, Eye, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import { useAuth } from '@/hooks/use-auth';
import {
  SimpleExpenseCategory,
  SIMPLE_EXPENSE_CATEGORY_LABELS,
  formatCurrency,
  getCategoryColor
} from '@/types/simple-expense';
import { Timestamp } from 'firebase/firestore';

// 폼 스키마
const expenseFormSchema = z.object({
  date: z.date({
    required_error: "날짜를 선택해주세요",
  }),
  category: z.nativeEnum(SimpleExpenseCategory, {
    required_error: "카테고리를 선택해주세요",
  }),
  subCategory: z.string().optional(),
  description: z.string().min(1, '품목명을 입력해주세요'),
  amount: z.number().min(1, '금액을 입력해주세요'),
  supplier: z.string().min(1, '구매처를 입력해주세요'),
  quantity: z.number().min(1, '수량을 입력해주세요'),
  unitPrice: z.number().min(0, '단가를 입력해주세요'),
  memo: z.string().optional(),
});

type ExpenseFormData = z.infer<typeof expenseFormSchema>;

interface ExpenseDetailDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  expense: any | null;
  onSave?: (expenseId: string, data: ExpenseFormData) => void;
}

export function ExpenseDetailDialog({
  isOpen,
  onOpenChange,
  expense,
  onSave
}: ExpenseDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { updateExpense } = useSimpleExpenses();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      date: new Date(),
      category: SimpleExpenseCategory.MATERIAL,
      subCategory: '',
      description: '',
      amount: 0,
      supplier: '',
      quantity: 1,
      unitPrice: 0,
      memo: '',
    },
  });

  // 지출 데이터가 변경될 때 폼 초기화
  useEffect(() => {
    if (expense) {
      const expenseDate = expense.date?.toDate?.() || new Date(expense.date);
      
      form.reset({
        date: expenseDate,
        category: expense.category,
        subCategory: expense.subCategory || '',
        description: expense.description,
        amount: expense.amount,
        supplier: expense.supplier,
        quantity: expense.quantity || 1,
        unitPrice: expense.unitPrice || 0,
        memo: expense.memo || '',
      });
    }
  }, [expense, form]);

  // 수량이나 단가가 변경될 때 금액 자동 계산
  const quantity = form.watch('quantity');
  const unitPrice = form.watch('unitPrice');

  useEffect(() => {
    const calculatedAmount = quantity * unitPrice;
    form.setValue('amount', calculatedAmount);
  }, [quantity, unitPrice, form]);

  // 수정 모드 토글
  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // 저장 처리
  const handleSave = async (data: ExpenseFormData) => {
    if (!expense) return;

    try {
      setIsLoading(true);
      
      const updatedData = {
        ...data,
        date: Timestamp.fromDate(data.date),
        updatedAt: Timestamp.now(),
        updatedBy: user?.uid || 'unknown',
      };

      await updateExpense(expense.id, updatedData);
      
      toast({
        title: "성공",
        description: "지출이 수정되었습니다.",
      });
      
      setIsEditing(false);
      onOpenChange(false);
      
      // 부모 컴포넌트에 저장 완료 알림
      if (onSave) {
        onSave(expense.id, data);
      }
    } catch (error) {
      console.error('지출 수정 오류:', error);
      toast({
        title: "오류",
        description: "지출 수정에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 취소 처리
  const handleCancel = () => {
    if (isEditing) {
      // 수정 모드에서 취소 시 원래 데이터로 복원
      if (expense) {
        const expenseDate = expense.date?.toDate?.() || new Date(expense.date);
        form.reset({
          date: expenseDate,
          category: expense.category,
          subCategory: expense.subCategory || '',
          description: expense.description,
          amount: expense.amount,
          supplier: expense.supplier,
          quantity: expense.quantity || 1,
          unitPrice: expense.unitPrice || 0,
          memo: expense.memo || '',
        });
      }
      setIsEditing(false);
    } else {
      onOpenChange(false);
    }
  };

  if (!expense) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>
                {isEditing ? '지출 수정' : '지출 상세보기'}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? '지출 정보를 수정하세요.' : '지출 상세 정보를 확인하세요.'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleEdit}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  수정
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
          {/* 날짜 */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>날짜</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        disabled={!isEditing}
                      >
                        {field.value ? (
                          format(field.value, "PPP", { locale: ko })
                        ) : (
                          <span>날짜를 선택하세요</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  {isEditing && (
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  )}
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 카테고리 */}
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>카테고리</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="카테고리를 선택하세요" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(SIMPLE_EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full bg-${getCategoryColor(value as SimpleExpenseCategory)}-500`}></div>
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 구매처 */}
          <FormField
            control={form.control}
            name="supplier"
            render={({ field }) => (
              <FormItem>
                <FormLabel>구매처</FormLabel>
                <FormControl>
                  <Input
                    placeholder="구매처를 입력하세요"
                    {...field}
                    disabled={!isEditing}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 품목명 */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>품목명</FormLabel>
                <FormControl>
                  <Input
                    placeholder="품목명을 입력하세요"
                    {...field}
                    disabled={!isEditing}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 수량과 단가 */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>수량</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="수량"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      disabled={!isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unitPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>단가</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="단가"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      disabled={!isEditing}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 금액 (자동 계산) */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>총 금액</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="금액"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    disabled={!isEditing}
                    className="font-semibold text-lg"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 메모 */}
          <FormField
            control={form.control}
            name="memo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>메모</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="메모를 입력하세요"
                    {...field}
                    disabled={!isEditing}
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 자동 생성 표시 */}
          {expense.isAutoGenerated && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">자동 생성</Badge>
                <span className="text-sm text-blue-600">
                  이 지출은 시스템에서 자동으로 생성되었습니다.
                </span>
              </div>
            </div>
          )}

          {/* 생성 정보 */}
          <div className="text-xs text-gray-500 space-y-1">
            <div>생성일: {expense.createdAt?.toDate?.() ? format(expense.createdAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}</div>
            {expense.updatedAt && (
              <div>수정일: {expense.updatedAt?.toDate?.() ? format(expense.updatedAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'}</div>
            )}
          </div>

          <DialogFooter>
            {isEditing ? (
              <>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  취소
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      저장 중...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      저장
                    </div>
                  )}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={handleCancel}>
                닫기
              </Button>
            )}
                      </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
