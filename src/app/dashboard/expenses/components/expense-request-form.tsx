"use client";
import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { 
  Plus, 
  Trash2, 
  Calculator,
  Save,
  X,
  Upload,
  AlertTriangle,
  DollarSign,
  Receipt,
  Calendar
} from 'lucide-react';
import { useExpenses } from '@/hooks/use-expenses';
import { useToast } from '@/hooks/use-toast';
import { 
  ExpenseCategory, 
  EXPENSE_CATEGORY_LABELS 
} from '@/types/expense';
import type { 
  CreateExpenseRequestData
} from '@/types/expense';
// 폼 스키마 정의
const expenseItemSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  subcategory: z.string().optional(),
  description: z.string().min(1, '설명을 입력해주세요'),
  amount: z.number().min(1, '금액은 1원 이상이어야 합니다'),
  quantity: z.number().min(1, '수량은 1 이상이어야 합니다'),
  unitPrice: z.number().min(0, '단가는 0 이상이어야 합니다'),
  taxAmount: z.number().min(0, '세액은 0 이상이어야 합니다').optional(),
  memo: z.string().optional(),
  supplier: z.string().optional(),
  purchaseDate: z.date(),
});
const expenseRequestSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  purpose: z.string().min(1, '사용 목적을 입력해주세요'),
  urgency: z.enum(['normal', 'urgent']),
  branchId: z.string().min(1, '지점을 선택해주세요'),
  branchName: z.string().min(1, '지점명이 필요합니다'),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  items: z.array(expenseItemSchema).min(1, '최소 1개 이상의 비용 항목을 추가해주세요'),
  tags: z.array(z.string()).optional(),
});
type ExpenseRequestFormData = z.infer<typeof expenseRequestSchema>;
interface ExpenseRequestFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}
// 지점 목록 (실제로는 API에서 가져와야 함)
const branches = [
  { id: 'branch-001', name: '릴리맥광화문점' },
  { id: 'branch-002', name: '릴리맥여의도점' },
  { id: 'branch-003', name: '릴리맥NC이스트폴점' },
];
// 부서 목록
const departments = [
  { id: 'dept-001', name: '영업팀' },
  { id: 'dept-002', name: '마케팅팀' },
  { id: 'dept-003', name: '관리팀' },
  { id: 'dept-004', name: '운영팀' },
];
export function ExpenseRequestForm({ onSuccess, onCancel }: ExpenseRequestFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const { createExpenseRequest, submitExpenseRequest } = useExpenses();
  const { toast } = useToast();
  const form = useForm<ExpenseRequestFormData>({
    resolver: zodResolver(expenseRequestSchema),
    defaultValues: {
      title: '',
      purpose: '',
      urgency: 'normal',
      branchId: '',
      branchName: '',
      departmentId: '',
      departmentName: '',
      items: [{
        category: ExpenseCategory.OTHER,
        description: '',
        amount: 0,
        quantity: 1,
        unitPrice: 0,
        taxAmount: 0,
        purchaseDate: new Date(),
        memo: '',
        supplier: ''
      }],
      tags: [],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });
  // 지점 선택 처리
  const handleBranchChange = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      form.setValue('branchId', branchId);
      form.setValue('branchName', branch.name);
    }
  };
  // 부서 선택 처리
  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    if (department) {
      form.setValue('departmentId', departmentId);
      form.setValue('departmentName', department.name);
    }
  };
  // 새 비용 항목 추가
  const addExpenseItem = () => {
    append({
      category: ExpenseCategory.OTHER,
      description: '',
      amount: 0,
      quantity: 1,
      unitPrice: 0,
      taxAmount: 0,
      purchaseDate: new Date(),
      memo: '',
      supplier: ''
    });
  };
  // 금액 자동 계산
  const calculateAmount = (index: number) => {
    const quantity = form.watch(`items.${index}.quantity`) || 0;
    const unitPrice = form.watch(`items.${index}.unitPrice`) || 0;
    const amount = quantity * unitPrice;
    form.setValue(`items.${index}.amount`, amount);
  };
  // 총 금액 계산
  const calculateTotalAmount = () => {
    return fields.reduce((total, field, index) => {
      const amount = form.watch(`items.${index}.amount`) || 0;
      return total + amount;
    }, 0);
  };
  // 총 세액 계산
  const calculateTotalTaxAmount = () => {
    return fields.reduce((total, field, index) => {
      const taxAmount = form.watch(`items.${index}.taxAmount`) || 0;
      return total + taxAmount;
    }, 0);
  };
  // 폼 제출 (임시저장)
  const onSaveDraft = async (data: ExpenseRequestFormData) => {
    setIsSubmitting(true);
    setIsDraft(true);
    try {
      const requestData: CreateExpenseRequestData = {
        requesterId: 'current-user-id', // 실제로는 현재 사용자 ID
        requesterName: '현재 사용자', // 실제로는 현재 사용자 이름
        requesterRole: '직원', // 실제로는 현재 사용자 역할
        ...data,
        items: data.items.map(item => ({
          ...item,
          purchaseDate: new Date(item.purchaseDate) as any
        }))
      };
      await createExpenseRequest(requestData);
      toast({
        title: '임시저장 완료',
        description: '비용 신청이 임시저장되었습니다.',
      });
      onSuccess();
    } catch (error) {
      console.error('Draft save error:', error);
    } finally {
      setIsSubmitting(false);
      setIsDraft(false);
    }
  };
  // 폼 제출 (신청)
  const onSubmit = async (data: ExpenseRequestFormData) => {
    setIsSubmitting(true);
    try {
      const requestData: CreateExpenseRequestData = {
        requesterId: 'current-user-id', // 실제로는 현재 사용자 ID
        requesterName: '현재 사용자', // 실제로는 현재 사용자 이름
        requesterRole: '직원', // 실제로는 현재 사용자 역할
        ...data,
        items: data.items.map(item => ({
          ...item,
          purchaseDate: new Date(item.purchaseDate) as any
        }))
      };
      const requestId = await createExpenseRequest(requestData);
      // 바로 제출
      if (requestId) {
        await submitExpenseRequest(requestId);
      }
      onSuccess();
    } catch (error) {
      console.error('Expense request submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const totalAmount = calculateTotalAmount();
  const totalTaxAmount = calculateTotalTaxAmount();
  const grandTotal = totalAmount + totalTaxAmount;
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  return (
    <div className="space-y-6">
      <Form {...form}>
        <form className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>신청 제목</FormLabel>
                      <FormControl>
                        <Input placeholder="비용 신청 제목을 입력하세요" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>긴급도</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="긴급도 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="normal">일반</SelectItem>
                          <SelectItem value="urgent">긴급</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사용 목적</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="비용 사용 목적을 상세히 입력하세요"
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>소속 지점</FormLabel>
                      <Select onValueChange={handleBranchChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="지점을 선택하세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>소속 부서</FormLabel>
                      <Select onValueChange={handleDepartmentChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="부서를 선택하세요 (선택사항)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
          {/* 비용 항목 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  비용 항목 ({fields.length}개)
                </span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1">
                    <Calculator className="h-4 w-4" />
                    총 금액: {formatCurrency(grandTotal)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addExpenseItem}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    항목 추가
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">비용 항목 {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.category`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>카테고리</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.supplier`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>공급업체</FormLabel>
                            <FormControl>
                              <Input placeholder="공급업체명" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.purchaseDate`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>구매일</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                value={field.value instanceof Date ? 
                                  field.value.toISOString().split('T')[0] : 
                                  field.value
                                }
                                onChange={(e) => field.onChange(new Date(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="mb-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>상세 설명</FormLabel>
                            <FormControl>
                              <Input placeholder="비용 항목에 대한 상세 설명" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>수량</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseInt(e.target.value) || 1);
                                  setTimeout(() => calculateAmount(index), 0);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>단가</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                {...field}
                                onChange={(e) => {
                                  field.onChange(parseFloat(e.target.value) || 0);
                                  setTimeout(() => calculateAmount(index), 0);
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`items.${index}.taxAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>세액</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div>
                        <Label>합계</Label>
                        <div className="text-lg font-bold text-blue-600 mt-2">
                          {formatCurrency(
                            (form.watch(`items.${index}.amount`) || 0) +
                            (form.watch(`items.${index}.taxAmount`) || 0)
                          )}
                        </div>
                      </div>
                    </div>
                    <FormField
                      control={form.control}
                      name={`items.${index}.memo`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>메모</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="추가 메모나 특이사항을 입력하세요"
                              rows={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {/* 총액 요약 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">항목 수:</span>
                    <span className="font-medium">{fields.length}개</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">총 금액:</span>
                    <span className="font-medium">{formatCurrency(totalAmount)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">총 세액:</span>
                    <span className="font-medium">{formatCurrency(totalTaxAmount)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">최종 금액</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(grandTotal)}
                  </p>
                </div>
              </div>
              {grandTotal >= 500000 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    50만원 이상의 비용은 상위 승인이 필요합니다.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          {/* 액션 버튼 */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              취소
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={form.handleSubmit(onSaveDraft)}
                disabled={isSubmitting || fields.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                {isDraft ? '저장 중...' : '임시저장'}
              </Button>
              <Button
                type="button"
                onClick={form.handleSubmit(onSubmit)}
                disabled={isSubmitting || fields.length === 0}
                className="flex items-center gap-2"
              >
                <Calendar className="h-4 w-4" />
                {isSubmitting && !isDraft ? '신청 중...' : '비용 신청'}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
