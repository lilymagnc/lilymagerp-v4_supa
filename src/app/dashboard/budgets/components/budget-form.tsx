"use client";
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { 
  Target, 
  DollarSign,
  Calendar,
  Building,
  Users,
  Save,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useBudgets } from '@/hooks/use-budgets';
import { useToast } from '@/hooks/use-toast';
import { 
  ExpenseCategory, 
  EXPENSE_CATEGORY_LABELS,
  ApprovalLevel 
} from '@/types/expense';
// 폼 스키마 정의
const budgetFormSchema = z.object({
  name: z.string().min(1, '예산명을 입력해주세요'),
  category: z.nativeEnum(ExpenseCategory),
  fiscalYear: z.number().min(2020).max(2030),
  fiscalMonth: z.number().min(1).max(12).optional(),
  allocatedAmount: z.number().min(1, '예산 금액은 1원 이상이어야 합니다'),
  branchId: z.string().optional(),
  branchName: z.string().optional(),
  departmentId: z.string().optional(),
  departmentName: z.string().optional(),
  isMonthlyBudget: z.boolean(),
  managerLimit: z.number().min(0).optional(),
  directorLimit: z.number().min(0).optional(),
  executiveLimit: z.number().min(0).optional(),
});
type BudgetFormData = z.infer<typeof budgetFormSchema>;
interface BudgetFormProps {
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
export function BudgetForm({ onSuccess, onCancel }: BudgetFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createBudget } = useBudgets();
  const { toast } = useToast();
  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      name: '',
      category: ExpenseCategory.OTHER,
      fiscalYear: new Date().getFullYear(),
      fiscalMonth: undefined,
      allocatedAmount: 0,
      branchId: '',
      branchName: '',
      departmentId: '',
      departmentName: '',
      isMonthlyBudget: false,
      managerLimit: 100000,
      directorLimit: 500000,
      executiveLimit: 2000000,
    },
  });
  const isMonthlyBudget = form.watch('isMonthlyBudget');
  const allocatedAmount = form.watch('allocatedAmount');
  // 지점 선택 처리
  const handleBranchChange = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      form.setValue('branchId', branchId);
      form.setValue('branchName', branch.name);
    } else {
      form.setValue('branchId', '');
      form.setValue('branchName', '');
    }
  };
  // 부서 선택 처리
  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find(d => d.id === departmentId);
    if (department) {
      form.setValue('departmentId', departmentId);
      form.setValue('departmentName', department.name);
    } else {
      form.setValue('departmentId', '');
      form.setValue('departmentName', '');
    }
  };
  // 폼 제출
  const onSubmit = async (data: BudgetFormData) => {
    setIsSubmitting(true);
    try {
      const budgetData = {
        name: data.name,
        category: data.category,
        fiscalYear: data.fiscalYear,
        fiscalMonth: data.isMonthlyBudget ? data.fiscalMonth : undefined,
        allocatedAmount: data.allocatedAmount,
        branchId: data.branchId || undefined,
        branchName: data.branchName || undefined,
        departmentId: data.departmentId || undefined,
        departmentName: data.departmentName || undefined,
        approvalLimits: {
          manager: data.managerLimit,
          director: data.directorLimit,
          executive: data.executiveLimit,
        }
      };
      await createBudget(budgetData);
      onSuccess();
    } catch (error) {
      console.error('Budget creation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };
  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 기본 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>예산명</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 2024년 마케팅 예산" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="카테고리 선택" />
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="fiscalYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>회계연도</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="2020"
                          max="2030"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isMonthlyBudget"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">월간 예산</FormLabel>
                        <FormDescription>
                          월별로 예산을 관리합니다
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {isMonthlyBudget && (
                  <FormField
                    control={form.control}
                    name="fiscalMonth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>대상 월</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="월 선택" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                              <SelectItem key={month} value={month.toString()}>
                                {month}월
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              <FormField
                control={form.control}
                name="allocatedAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>예산 금액</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="예산 금액을 입력하세요"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>
                      {allocatedAmount > 0 && `입력된 금액: ${formatCurrency(allocatedAmount)}`}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          {/* 조직 정보 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                조직 정보 (선택사항)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>지점</FormLabel>
                      <Select onValueChange={handleBranchChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="지점 선택 (전체)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">전체 지점</SelectItem>
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
                      <FormLabel>부서</FormLabel>
                      <Select onValueChange={handleDepartmentChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="부서 선택 (전체)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">전체 부서</SelectItem>
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
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  지점이나 부서를 선택하지 않으면 전사 공통 예산으로 설정됩니다.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          {/* 승인 한도 설정 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                승인 한도 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="managerLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>팀장 승인 한도</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value && formatCurrency(field.value)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="directorLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>부서장 승인 한도</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value && formatCurrency(field.value)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="executiveLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>임원 승인 한도</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value && formatCurrency(field.value)}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  승인 한도는 해당 직급이 단독으로 승인할 수 있는 최대 금액입니다.
                  한도를 초과하는 경우 상위 승인이 필요합니다.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          {/* 예산 요약 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h4 className="font-medium">예산 요약</h4>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>카테고리: {EXPENSE_CATEGORY_LABELS[form.watch('category')]}</p>
                    <p>기간: {form.watch('fiscalYear')}년 {isMonthlyBudget && form.watch('fiscalMonth') ? `${form.watch('fiscalMonth')}월` : '연간'}</p>
                    <p>범위: {form.watch('branchName') || '전사'} {form.watch('departmentName') && `- ${form.watch('departmentName')}`}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">총 예산</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatCurrency(allocatedAmount)}
                  </p>
                </div>
              </div>
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
            <Button
              type="submit"
              disabled={isSubmitting || allocatedAmount <= 0}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? '생성 중...' : '예산 생성'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
