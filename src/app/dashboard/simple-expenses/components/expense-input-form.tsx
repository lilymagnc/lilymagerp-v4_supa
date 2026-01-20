"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus,
  Save,
  RotateCcw,
  Upload,
  Check,
  ChevronsUpDown,
  Trash2,
  Building2,
  FileSpreadsheet,
  Tag,
  DollarSign,
  Flower2,
  Package,
  Utensils,
  Truck,
  Coffee,
  Search,
  CheckCircle2,
  AlertCircle,
  Link,
  Info
} from 'lucide-react';
import { DuplicateCheckDialog } from './duplicate-check-dialog';
import { useSimpleExpenses } from '@/hooks/use-simple-expenses';
import { usePartners } from '@/hooks/use-partners';
import { useAuth } from '@/hooks/use-auth';
import { useMaterials } from '@/hooks/use-materials';
import { useProducts } from '@/hooks/use-products';
import { useBranches } from '@/hooks/use-branches';
import { useUserRole } from '@/hooks/use-user-role';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  SimpleExpenseCategory,
  MaterialSubCategory,
  FixedCostSubCategory,
  UtilitySubCategory,
  MealSubCategory,
  TransportSubCategory,
  OfficeSubCategory,
  MarketingSubCategory,
  MaintenanceSubCategory,
  InsuranceSubCategory,
  SIMPLE_EXPENSE_CATEGORY_LABELS,
  MATERIAL_SUB_CATEGORY_LABELS,
  FIXED_COST_SUB_CATEGORY_LABELS,
  UTILITY_SUB_CATEGORY_LABELS,
  MEAL_SUB_CATEGORY_LABELS,
  TRANSPORT_SUB_CATEGORY_LABELS,
  OFFICE_SUB_CATEGORY_LABELS,
  MARKETING_SUB_CATEGORY_LABELS,
  MAINTENANCE_SUB_CATEGORY_LABELS,
  INSURANCE_SUB_CATEGORY_LABELS,
  SENSITIVE_SUBCATEGORIES,
  canViewSubCategory,
  isSensitiveSubCategory
} from '@/types/simple-expense';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// 폼 스키마 정의
// 품목 스키마 수정 - 단가 필드 추가
const expenseItemSchema = z.object({
  description: z.string().min(1, '품목명을 입력해주세요'),
  quantity: z.number().min(1, '수량을 입력해주세요'),
  unitPrice: z.number().min(0, '단가를 입력해주세요'), // 단가 필드 추가
  amount: z.number().min(1, '금액을 입력해주세요')
});

// 재고 업데이트 아이템 스키마
const inventoryUpdateSchema = z.object({
  type: z.enum(['material', 'product']),
  id: z.string().min(1, 'ID를 선택해주세요'),
  name: z.string().min(1, '이름을 입력해주세요'),
  quantity: z.number().min(1, '수량을 입력해주세요'),
  unitPrice: z.number().min(0, '단가를 입력해주세요').optional()
});

// 전체 폼 스키마 수정 - 전체 분류 추가
const expenseFormSchema = z.object({
  date: z.string().min(1, '날짜를 선택해주세요'),
  supplier: z.string().min(1, '구매처를 입력해주세요'),
  category: z.nativeEnum(SimpleExpenseCategory),
  subCategory: z.string().optional(),
  paymentMethod: z.enum(['card', 'cash', 'transfer', 'other']),
  items: z.array(expenseItemSchema).min(1, '최소 1개의 품목을 입력해주세요'),
  receiptFile: z.any().optional(),
  inventoryUpdates: z.array(inventoryUpdateSchema).optional(),
  relatedRequestId: z.string().optional()
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface ExpenseInputFormProps {
  onSuccess?: () => void;
  initialData?: Partial<ExpenseFormValues>;
  continueMode?: boolean;
  selectedBranchId?: string;
  selectedBranchName?: string;
}

export function ExpenseInputForm({
  onSuccess,
  initialData,
  continueMode = false,
  selectedBranchId,
  selectedBranchName
}: ExpenseInputFormProps) {
  const isMountedRef = useRef(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [supplierSearchValue, setSupplierSearchValue] = useState('');
  const [isDirectInput, setIsDirectInput] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [excelData, setExcelData] = useState<any[]>([]);
  const [duplicateData, setDuplicateData] = useState<any[]>([]);
  const [isExcelUploading, setIsExcelUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'manual' | 'excel'>('manual');

  // 중복 확인 관련 상태
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    type: 'supplier' | 'material' | 'product';
    inputName: string;
    similarItems: { id: string; name: string }[];
    resolve: (value: string | null) => void;
  } | null>(null);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      date: initialData?.date || new Date().toISOString().split('T')[0],
      supplier: initialData?.supplier || '',
      category: initialData?.category || SimpleExpenseCategory.OTHER,
      subCategory: initialData?.subCategory || '',
      paymentMethod: initialData?.paymentMethod || 'card',
      items: initialData?.items || [{
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0
      }],
      receiptFile: undefined,
      inventoryUpdates: initialData?.inventoryUpdates || [],
      relatedRequestId: initialData?.relatedRequestId || ''
    }
  });

  const { addExpense, fetchExpenses } = useSimpleExpenses();
  const { partners, fetchPartners } = usePartners();
  const { user } = useAuth();
  const { toast } = useToast();
  const { materials } = useMaterials();
  const { products } = useProducts();
  const { branches, loading: branchesLoading } = useBranches();

  // 중복 데이터 체크 함수
  const checkDuplicateData = useCallback(async (processedData: any[]) => {
    try {
      // 현재 지점의 기존 지출 데이터를 직접 Firestore에서 가져오기
      const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const q = query(
        collection(db, 'simpleExpenses'),
        where('branchId', '==', selectedBranchId || ''),
        orderBy('date', 'desc')
      );

      const snapshot = await getDocs(q);
      const existingExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const duplicates: any[] = [];
      const uniqueData: any[] = [];

      for (const item of processedData) {
        const purchaseDateStr = item.purchaseDate.toISOString().split('T')[0];

        // 중복 체크: 같은 날짜, 같은 구매처, 같은 품목명
        const isDuplicate = existingExpenses.some((existing: any) => {
          if (!existing.date) return false;
          const existingDateStr = existing.date.toDate().toISOString().split('T')[0];
          return (
            existingDateStr === purchaseDateStr &&
            existing.supplier === item['구매처'] &&
            existing.description === item['품목명']
          );
        });

        if (isDuplicate) {
          duplicates.push({
            ...item,
            reason: '기존 데이터와 중복'
          });
        } else {
          uniqueData.push(item);
        }
      }

      return { duplicates, uniqueData };
    } catch (error) {
      return { duplicates: [], uniqueData: processedData };
    }
  }, [selectedBranchId]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const {
    fields: inventoryFields,
    append: appendInventory,
    remove: removeInventory
  } = useFieldArray({
    control: form.control,
    name: "inventoryUpdates"
  });

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // 모든 상태를 즉시 초기화
      setSupplierOpen(false);
      setSelectedFile(null);
      setSupplierSearchValue('');
      setIsDirectInput(false);
      setExcelData([]);
      setDuplicateData([]);
      setIsExcelUploading(false);
      setUploadMode('manual');
      // 폼 상태도 초기화
      form.reset();
    };
  }, [form]);

  // 유사도 검사 함수
  const checkSimilarity = (str1: string, str2: string) => {
    const s1 = str1.replace(/\s+/g, '').toLowerCase();
    const s2 = str2.replace(/\s+/g, '').toLowerCase();

    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // 간단한 레벤슈타인 거리 기반 유사도
    const track = Array(s2.length + 1).fill(null).map(() =>
      Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) { track[0][i] = i; }
    for (let j = 0; j <= s2.length; j += 1) { track[j][0] = j; }
    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator,
        );
      }
    }
    const distance = track[s2.length][s1.length];
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - distance / maxLength;
  };

  // 중복 확인 실행 함수
  const performDuplicateCheck = async (
    type: 'supplier' | 'material' | 'product',
    name: string
  ): Promise<string | null> => {
    // 2자 미만은 검사 건너뜀
    if (name.length < 2) return name;

    let existingItems: { id: string; name: string }[] = [];

    if (type === 'supplier') {
      existingItems = partners.map(p => ({ id: p.id!, name: p.name }));
    } else if (type === 'material') {
      existingItems = materials
        .filter(m => !selectedBranchName || m.branch === selectedBranchName)
        .map(m => ({ id: m.id, name: m.name }));
    } else { // product
      existingItems = products
        .map(p => ({ id: p.id, name: p.name }));
    }

    // 유사한 항목 찾기 (유사도 0.8 이상이지만 완전 일치는 아닌 경우)
    const similarItems = existingItems.filter(item => {
      const similarity = checkSimilarity(name, item.name);
      return similarity >= 0.7 && item.name !== name; // 0.7 이상으로 완화
    });

    if (similarItems.length === 0) return name;

    // 사용자 확인 필요
    return new Promise((resolve) => {
      setDuplicateInfo({
        type,
        inputName: name,
        similarItems: similarItems.slice(0, 5), // 최대 5개만 표시
        resolve
      });
      setDuplicateDialogOpen(true);
    });
  };

  // 지점 데이터 로딩 상태 확인


  // 안전한 상태 업데이트 함수
  const safeSetState = useCallback((setter: React.Dispatch<React.SetStateAction<any>>, value: any) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  // 품목 추가
  const addItem = useCallback(() => {
    if (isMountedRef.current) {
      append({
        description: '',
        quantity: 1,
        unitPrice: 0,
        amount: 0
      });
    }
  }, [append]);

  // 총 금액 계산
  const totalAmount = form.watch('items').reduce((sum, item) => sum + (item.amount || 0), 0);

  const selectedCategory = form.watch('category');
  const { isHQManager, isHeadOfficeAdmin } = useUserRole();
  const userRole = isHeadOfficeAdmin() ? 'head_office_admin' : isHQManager() ? 'hq_manager' : 'branch_user';

  // 카테고리별 세부 분류 옵션 (민감한 항목 필터링 포함)
  const getSubCategoryOptions = useCallback((category: SimpleExpenseCategory) => {
    let options: [string, string][] = [];

    switch (category) {
      case SimpleExpenseCategory.MATERIAL:
        options = Object.entries(MATERIAL_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.FIXED_COST:
        options = Object.entries(FIXED_COST_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.UTILITY:
        options = Object.entries(UTILITY_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.MEAL:
        options = Object.entries(MEAL_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.TRANSPORT:
        options = Object.entries(TRANSPORT_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.OFFICE:
        options = Object.entries(OFFICE_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.MARKETING:
        options = Object.entries(MARKETING_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.MAINTENANCE:
        options = Object.entries(MAINTENANCE_SUB_CATEGORY_LABELS);
        break;
      case SimpleExpenseCategory.INSURANCE:
        options = Object.entries(INSURANCE_SUB_CATEGORY_LABELS);
        break;
      default:
        options = [];
    }



    // 민감한 세부 분류 필터링 (본사 관리자가 아닌 경우)
    if (!isHeadOfficeAdmin() && !isHQManager()) {
      options = options.filter(([key, label]) => {
        return canViewSubCategory(category, key, userRole);
      });
    }



    return options;
  }, [isHeadOfficeAdmin, isHQManager, userRole]);

  // 구매처 검색 - 거래처관리에서 가져온 데이터 사용
  const handleSupplierSearch = useCallback((searchTerm: string) => {
    if (isMountedRef.current) {
      safeSetState(setSupplierSearchValue, searchTerm);
    }
  }, [safeSetState]);

  // Popover 상태 변경 핸들러 - 더 안전한 방식으로 개선
  const handlePopoverOpenChange = useCallback((open: boolean) => {
    if (!isMountedRef.current) return;

    // 상태 변경을 즉시 수행하되, DOM 조작과 분리
    if (open) {
      safeSetState(setSupplierOpen, true);
    } else {
      // 닫을 때는 즉시 상태 변경
      safeSetState(setSupplierOpen, false);
      safeSetState(setIsDirectInput, false);
      safeSetState(setSupplierSearchValue, '');
    }
  }, [safeSetState]);

  // 구매처 선택 핸들러 개선
  const handleSupplierSelect = useCallback((supplierName: string) => {
    if (!isMountedRef.current) return;

    // 즉시 폼 값 설정
    form.setValue('supplier', supplierName);

    // 즉시 상태 변경
    safeSetState(setSupplierOpen, false);
    safeSetState(setSupplierSearchValue, '');
    safeSetState(setIsDirectInput, false);
  }, [form, safeSetState]);

  // 직접 입력 모드 활성화 개선
  const handleDirectInput = useCallback(() => {
    if (!isMountedRef.current) return;

    safeSetState(setIsDirectInput, true);
    safeSetState(setSupplierOpen, false);
  }, [safeSetState]);

  // 직접 입력 구매처 저장
  const handleDirectInputSubmit = useCallback(() => {
    if (isMountedRef.current) {
      const inputValue = supplierSearchValue.trim();
      if (inputValue) {
        handleSupplierSelect(inputValue);
      }
    }
  }, [supplierSearchValue, handleSupplierSelect]);

  // 파일 선택
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (isMountedRef.current) {
      const file = event.target.files?.[0];
      if (file) {
        safeSetState(setSelectedFile, file);
        form.setValue('receiptFile', file);
      }
    }
  }, [form, safeSetState]);

  // 품목 삭제
  const handleRemoveItem = useCallback((index: number) => {
    if (isMountedRef.current && fields.length > 1) {
      remove(index);
    }
  }, [fields.length, remove]);

  // 엑셀 파일 처리
  const handleExcelUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isMountedRef.current) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast({
            title: "오류",
            description: "엑셀 파일에 데이터가 없습니다.",
            variant: "destructive",
          });
          return;
        }

        // 헤더 검증
        const headers = jsonData[0] as string[];
        const requiredHeaders = ['날짜', '지점', '구매처', '분류', '세부분류', '품목명', '수량', '단가', '금액'];
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));

        if (missingHeaders.length > 0) {
          toast({
            title: "오류",
            description: `필수 헤더가 누락되었습니다: ${missingHeaders.join(', ')}`,
            variant: "destructive",
          });
          return;
        }

        // 데이터 처리 - 빈 행 필터링 추가
        const processedData = jsonData.slice(1)
          .filter((row: any) => {
            // 빈 행 필터링 (모든 셀이 비어있거나 null인 경우)
            return row && row.some((cell: any) => cell !== null && cell !== undefined && cell !== '');
          })
          .map((row: any, index: number) => {
            const rowData: any = {};
            headers.forEach((header, colIndex) => {
              rowData[header] = row[colIndex] || '';
            });

            // 데이터 검증
            if (!rowData['날짜'] || !rowData['지점'] || !rowData['구매처'] || !rowData['분류'] || !rowData['품목명']) {
              throw new Error(`행 ${index + 2}: 필수 데이터가 누락되었습니다.`);
            }

            // 지점명 검증 - 지점 데이터가 로딩 중이면 검증 건너뛰기
            const branchName = rowData['지점'].trim();
            if (!branchesLoading && branches.length > 0) {
              const isValidBranch = branches.some(branch =>
                branch.name === branchName ||
                branch.name.includes(branchName) ||
                branchName.includes(branch.name)
              );

              if (!isValidBranch) {
                const errorMessage = `행 ${index + 2}: 등록되지 않은 지점명 "${branchName}"입니다. 등록된 지점: ${branches.map(b => b.name).join(', ')}`;
                throw new Error(errorMessage);
              }
            }

            // 날짜 처리 개선
            let purchaseDate: Date;
            try {
              // 엑셀에서 날짜가 숫자로 저장된 경우 처리
              if (typeof rowData['날짜'] === 'number') {
                // Excel의 날짜는 1900년 1월 1일부터의 일수
                const excelDate = rowData['날짜'];
                const utcDaysSince1900 = excelDate - 25569; // 1900년 1월 1일부터 1970년 1월 1일까지의 일수
                const utcMillisecondsSince1970 = utcDaysSince1900 * 24 * 60 * 60 * 1000;
                purchaseDate = new Date(utcMillisecondsSince1970);
              } else {
                // 문자열로 저장된 경우
                purchaseDate = new Date(rowData['날짜']);
              }

              // 날짜 유효성 검사
              if (isNaN(purchaseDate.getTime())) {
                throw new Error(`행 ${index + 2}: 유효하지 않은 날짜 형식입니다: ${rowData['날짜']}`);
              }
            } catch (error) {
              throw new Error(`행 ${index + 2}: 날짜 처리 중 오류가 발생했습니다: ${rowData['날짜']}`);
            }

            // 분류 검증
            const categoryKey = Object.keys(SIMPLE_EXPENSE_CATEGORY_LABELS).find(
              key => SIMPLE_EXPENSE_CATEGORY_LABELS[key as SimpleExpenseCategory] === rowData['분류']
            );

            if (!categoryKey) {
              throw new Error(`행 ${index + 2}: 유효하지 않은 분류입니다: ${rowData['분류']}`);
            }

            return {
              ...rowData,
              purchaseDate: purchaseDate, // 파싱된 날짜 객체 추가
              category: categoryKey as SimpleExpenseCategory,
              quantity: parseFloat(rowData['수량']) || 1,
              unitPrice: parseFloat(rowData['단가']) || 0,
              amount: parseFloat(rowData['금액']) || 0,
              rowIndex: index + 2
            };
          });

        // 중복 데이터 체크
        const { duplicates, uniqueData } = await checkDuplicateData(processedData);

        safeSetState(setExcelData, uniqueData);
        safeSetState(setDuplicateData, duplicates);

        let message = `${uniqueData.length}개의 지출 데이터가 로드되었습니다.`;
        if (duplicates.length > 0) {
          message += ` (중복 데이터 ${duplicates.length}개 제외)`;
        }

        toast({
          title: "성공",
          description: message,
        });
      } catch (error) {
        toast({
          title: "오류",
          description: error instanceof Error ? error.message : "엑셀 파일 처리 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [toast, safeSetState, checkDuplicateData]);

  // 엑셀 데이터 일괄 등록
  const handleBulkUpload = useCallback(async () => {
    if (!isMountedRef.current || excelData.length === 0) return;

    try {
      safeSetState(setIsExcelUploading, true);
      let successCount = 0;
      let errorCount = 0;

      for (const item of excelData) {
        if (!isMountedRef.current) break;

        try {
          // 엑셀에서 지점 정보를 읽어서 사용
          const branchName = item['지점'] || selectedBranchName || '';

          // 지점명을 branchId로 변환
          let branchId = selectedBranchId || '';
          let finalBranchName = branchName;

          if (branchName && branchName !== selectedBranchName) {
            // 엑셀에서 읽은 지점명이 현재 선택된 지점과 다르면 해당 지점의 ID를 찾기
            const branch = branches.find(b => b.name === branchName);
            if (branch) {
              branchId = branch.id;
              finalBranchName = branchName;
            } else {
              finalBranchName = selectedBranchName || '';
            }
          } else {
            finalBranchName = selectedBranchName || '';
          }

          // 자재 자동 업데이트를 위한 inventoryUpdates 생성
          const inventoryUpdates = [];

          // 자재비 카테고리인 경우 자재 관리에 자동 업데이트
          if (item.category === 'material') {
            // 해당 지점의 기존 자재 검색
            const existingMaterial = materials.find(m =>
              m.name === item['품목명'] && m.branch === finalBranchName
            );

            if (existingMaterial) {
              // 해당 지점에 같은 이름의 자재가 있으면 해당 ID 사용
              inventoryUpdates.push({
                type: 'material',
                id: existingMaterial.id,
                name: item['품목명'],
                quantity: item.quantity,
                unitPrice: item.unitPrice
              });

            } else {
              // 해당 지점에 같은 이름의 자재가 없으면 새로 생성
              const materialId = `M${String(Date.now()).slice(-5)}`;
              inventoryUpdates.push({
                type: 'material',
                id: materialId,
                name: item['품목명'],
                quantity: item.quantity,
                unitPrice: item.unitPrice
              });

            }
          }

          // 제품 카테고리인 경우 제품 관리에 자동 업데이트
          if (item.category === 'product') {
            // 같은 이름의 제품이 있는지 확인 (지점 무관)
            const existingProduct = products.find(p =>
              p.name === item['품목명']
            );

            if (existingProduct) {
              // 같은 이름의 제품이 있으면 기존 ID 사용
              inventoryUpdates.push({
                type: 'product',
                id: existingProduct.id,
                name: item['품목명'],
                quantity: item.quantity,
                unitPrice: item.unitPrice
              });
            } else {
              // 같은 이름의 제품이 없으면 새로 생성
              const productId = `P${String(Date.now()).slice(-5)}`;
              inventoryUpdates.push({
                type: 'product',
                id: productId,
                name: item['품목명'],
                quantity: item.quantity,
                unitPrice: item.unitPrice
              });
            }
          }

          const expenseData = {
            date: Timestamp.fromDate(item.purchaseDate), // 파싱된 날짜 객체 사용
            supplier: item['구매처'],
            category: item.category,
            subCategory: item['세부분류'] || '',
            description: item['품목명'],
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            receiptFile: undefined,
            inventoryUpdates: inventoryUpdates, // 자재 자동 업데이트 추가
          };

          // 거래처 자동 등록을 위해 addExpense 함수 사용
          await addExpense(expenseData, branchId, finalBranchName);
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      if (isMountedRef.current) {
        toast({
          title: "완료",
          description: `성공: ${successCount}개, 실패: ${errorCount}개`,
        });

        if (successCount > 0) {
          safeSetState(setExcelData, []);
          safeSetState(setUploadMode, 'manual');
          // 거래처 목록 새로고침
          await fetchPartners();
          onSuccess?.();
        }
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "일괄 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        safeSetState(setIsExcelUploading, false);
      }
    }
  }, [excelData, addExpense, selectedBranchId, selectedBranchName, onSuccess, toast, safeSetState]);

  // 엑셀 템플릿 다운로드
  const downloadExcelTemplate = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]; // 오늘 날짜
    const templateData = [
      ['날짜', '지점', '구매처', '분류', '세부분류', '품목명', '수량', '단가', '금액'],
      [today, selectedBranchName || '지점명', '예시거래처', '자재비', '생화', '장미 10송이', '1', '10000', '10000'],
      ['2024-01-15', selectedBranchName || '지점명', '다른거래처', '고정비', '임대료', '월세', '1', '50000', '50000']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '간편지출템플릿');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '간편지출_템플릿.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [selectedBranchName]);

  // 폼 제출
  const onSubmit = useCallback(async (values: ExpenseFormValues) => {
    if (!isMountedRef.current) return;

    try {
      safeSetState(setIsSubmitting, true);

      // 구매처 중복/유사 확인
      let finalSupplierName = values.supplier;
      if (values.supplier) {
        const checkedSupplier = await performDuplicateCheck('supplier', values.supplier);
        if (checkedSupplier === null) {
          safeSetState(setIsSubmitting, false);
          return; // 취소됨
        }
        finalSupplierName = checkedSupplier;
      }

      // 각 품목을 개별 지출로 생성 및 품목명 유사 확인
      for (const item of values.items) {
        if (!isMountedRef.current) break;

        let finalDescription = item.description;

        // 자재/제품 카테고리인 경우 품목명 검사
        if (values.category === SimpleExpenseCategory.MATERIAL) {
          const checkedMaterial = await performDuplicateCheck('material', item.description);
          if (checkedMaterial === null) {
            safeSetState(setIsSubmitting, false);
            return; // 취소됨
          }
          finalDescription = checkedMaterial;
        } else if (values.category === SimpleExpenseCategory.OTHER) { // 기타(제품 등)
          // 제품은 검사하지 않거나 필요시 추가
        }

        const expenseData = {
          date: Timestamp.fromDate(new Date(values.date)),
          supplier: finalSupplierName, // 확인된 구매처명 사용
          category: values.category,
          subCategory: values.subCategory,
          paymentMethod: values.paymentMethod,
          description: finalDescription, // 확인된 품목명 사용
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          receiptFile: selectedFile,
          branchId: selectedBranchId || '',
          branchName: selectedBranchName || '',
        };

        await addExpense(expenseData, selectedBranchId || '', selectedBranchName || '');
      }

      if (isMountedRef.current) {
        toast({
          title: "성공",
          description: `${values.items.length}개 품목이 등록되었습니다.`,
        });

        if (!continueMode) {
          // 폼 초기화
          form.reset({
            date: new Date().toISOString().split('T')[0],
            supplier: '',
            category: SimpleExpenseCategory.OTHER,
            subCategory: '',
            paymentMethod: 'card',
            items: [{
              description: '',
              quantity: 1,
              unitPrice: 0,
              amount: 0
            }],
            receiptFile: undefined
          });
          safeSetState(setSelectedFile, null);
          safeSetState(setSupplierSearchValue, '');
          safeSetState(setSupplierOpen, false);
          safeSetState(setIsDirectInput, false);
        }

        // 거래처 목록 새로고침
        await fetchPartners();
        onSuccess?.();
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "지출 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      if (isMountedRef.current) {
        safeSetState(setIsSubmitting, false);
      }
    }
  }, [addExpense, selectedFile, selectedBranchId, selectedBranchName, continueMode, onSuccess, toast, form, safeSetState]);

  // 폼 초기화
  const handleReset = useCallback(() => {
    if (isMountedRef.current) {
      form.reset({
        date: new Date().toISOString().split('T')[0],
        supplier: '',
        category: SimpleExpenseCategory.OTHER,
        subCategory: '',
        paymentMethod: 'cash',
        items: [{
          description: '',
          quantity: 1,
          unitPrice: 0,
          amount: 0
        }],
        receiptFile: undefined
      });
      safeSetState(setSelectedFile, null);
      safeSetState(setSupplierSearchValue, '');
      safeSetState(setSupplierOpen, false);
      safeSetState(setIsDirectInput, false);
      safeSetState(setDuplicateData, []);
    }
  }, [form, safeSetState]);

  // 검색된 거래처 필터링 및 정렬
  const filteredPartners = useMemo(() => {
    const filtered = partners.filter(partner =>
      String(partner.name ?? '').toLowerCase().includes(supplierSearchValue.toLowerCase()) ||
      String(partner.type ?? '').toLowerCase().includes(supplierSearchValue.toLowerCase()) ||
      String(partner.contactPerson ?? '').toLowerCase().includes(supplierSearchValue.toLowerCase())
    );

    // 구매처명 오름차순으로 정렬
    return filtered.sort((a, b) => {
      const nameA = String(a.name ?? '').toLowerCase();
      const nameB = String(b.name ?? '').toLowerCase();
      return nameA.localeCompare(nameB, 'ko');
    });
  }, [partners, supplierSearchValue]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          간편지출 입력
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          카테고리를 선택하고 해당 카테고리의 여러 품목을 한 번에 입력할 수 있습니다.
        </p>

        {/* 모드 선택 */}
        <div className="flex items-center space-x-4 mt-4">
          <Button
            variant={uploadMode === 'manual' ? 'default' : 'outline'}
            onClick={() => setUploadMode('manual')}
            size="sm"
          >
            수동 입력
          </Button>
          <Button
            variant={uploadMode === 'excel' ? 'default' : 'outline'}
            onClick={() => setUploadMode('excel')}
            size="sm"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            엑셀 업로드
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {uploadMode === 'manual' ? (
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* 헤더 섹션: 날짜, 결제수단, 구매처 */}
              <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 날짜 */}
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">날짜</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-10 border-gray-200 focus:border-primary focus:ring-primary/20 bg-white" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 결제수단 */}
                  {/* 결제수단 - 현금 단일 선택으로 간소화 */}
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">결제수단</FormLabel>
                        <div className="flex p-1 bg-white border border-gray-200 rounded-lg h-10">
                          <button
                            type="button"
                            className={cn(
                              "flex-1 flex items-center justify-center rounded-md text-xs font-medium transition-all",
                              field.value === 'cash'
                                ? "bg-green-600 text-white shadow-sm"
                                : "bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                            )}
                            onClick={() => field.onChange(field.value === 'cash' ? 'card' : 'cash')}
                          >
                            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                            {field.value === 'cash' ? '현금 지출 선택됨' : '현금 지출 시 클릭'}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 구매처 */}
                  <FormField
                    control={form.control}
                    name="supplier"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">구매처</FormLabel>
                        {isDirectInput ? (
                          <div className="flex gap-1 h-10">
                            <Input
                              placeholder="구매처명 직접 입력"
                              value={supplierSearchValue}
                              onChange={(e) => safeSetState(setSupplierSearchValue, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleDirectInputSubmit();
                                }
                              }}
                              className="flex-1 bg-white text-sm"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={handleDirectInputSubmit}
                              className="h-10"
                            >
                              저장
                            </Button>
                          </div>
                        ) : (
                          <div className="relative h-10">
                            <Popover open={supplierOpen} onOpenChange={handlePopoverOpenChange}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "justify-between w-full h-10 bg-white border-gray-200 text-sm font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      {field.value || "구매처 선택/검색"}
                                    </div>
                                    <Search className="h-3.5 w-3.5 opacity-50 ml-2" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0" align="start">
                                <Command shouldFilter={false}>
                                  <div className="flex items-center border-b px-3 py-2">
                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <CommandInput
                                      placeholder="구매처 검색..."
                                      value={supplierSearchValue}
                                      onValueChange={handleSupplierSearch}
                                      className="border-0 focus:ring-0 text-sm"
                                    />
                                  </div>
                                  <CommandList>
                                    <CommandEmpty>
                                      <div className="p-4 text-center">
                                        <p className="text-xs text-muted-foreground mb-3">검색 결과가 없습니다.</p>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={handleDirectInput}
                                          className="w-full text-xs"
                                        >
                                          <Plus className="h-3 w-3 mr-2" />
                                          직접 입력하기
                                        </Button>
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup className="max-h-[250px] overflow-auto overscroll-contain">
                                      {filteredPartners.map((partner) => (
                                        <CommandItem
                                          key={partner.id}
                                          value={partner.name}
                                          onSelect={() => handleSupplierSelect(partner.name)}
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSupplierSelect(partner.name);
                                          }}
                                          className="cursor-pointer py-2 hover:bg-gray-50 pointer-events-auto"
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium text-sm">{partner.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{partner.type}</span>
                                          </div>
                                          {field.value === partner.name && <Check className="ml-auto h-4 w-4 text-primary" />}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* 카테고리 선택: 아이콘 버튼 그리드 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</Label>
                  {form.watch('category') && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] px-2 py-0">
                      {SIMPLE_EXPENSE_CATEGORY_LABELS[form.watch('category')]} 선택됨
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {[
                    { id: SimpleExpenseCategory.MATERIAL, label: '자재비', icon: Flower2, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { id: SimpleExpenseCategory.MEAL, label: '식대', icon: Utensils, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { id: SimpleExpenseCategory.TRANSPORT, label: '운송비', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { id: SimpleExpenseCategory.OFFICE, label: '사무비', icon: Coffee, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { id: SimpleExpenseCategory.FIXED_COST, label: '고정비', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { id: SimpleExpenseCategory.OTHER, label: '기타', icon: Package, color: 'text-gray-600', bg: 'bg-gray-50' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        form.setValue('category', cat.id);
                        form.setValue('subCategory', ''); // 카테고리 변경 시 서브는 초기화
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border transition-all gap-1.5",
                        form.watch('category') === cat.id
                          ? "ring-2 ring-primary ring-offset-1 border-primary bg-primary/5"
                          : "border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm"
                      )}
                    >
                      <div className={cn("p-2 rounded-full", cat.bg)}>
                        <cat.icon className={cn("h-5 w-5", cat.color)} />
                      </div>
                      <span className={cn("text-xs font-bold", form.watch('category') === cat.id ? "text-primary" : "text-gray-600")}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 세부 분류 버튼 그리드 (카테고리 선택 후에만 노출) */}
                {form.watch('category') && getSubCategoryOptions(form.watch('category')).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200 bg-gray-50/50 p-2 rounded-xl border border-dashed border-gray-200">
                    {getSubCategoryOptions(form.watch('category')).map(([key, label]) => {
                      const isSelected = form.watch('subCategory') === key;
                      const mainCat = form.watch('category');

                      // 메인 카테고리에 따른 서브 버튼 강조 색상 결정
                      let activeClass = "bg-primary text-white border-primary";
                      if (mainCat === SimpleExpenseCategory.MATERIAL) activeClass = "bg-rose-600 text-white border-rose-600";
                      else if (mainCat === SimpleExpenseCategory.MEAL) activeClass = "bg-orange-600 text-white border-orange-600";
                      else if (mainCat === SimpleExpenseCategory.TRANSPORT) activeClass = "bg-blue-600 text-white border-blue-600";
                      else if (mainCat === SimpleExpenseCategory.OFFICE) activeClass = "bg-amber-600 text-white border-amber-600";
                      else if (mainCat === SimpleExpenseCategory.FIXED_COST) activeClass = "bg-indigo-600 text-white border-indigo-600";

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => form.setValue('subCategory', isSelected ? '' : key)}
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all",
                            isSelected
                              ? activeClass
                              : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 shadow-sm"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 품목 입력 영역: 컴팩트 그리드 레이아웃 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">입력 품목</Label>
                    <Badge variant="outline" className="text-[10px] h-4 font-normal text-gray-400 border-gray-200">
                      총 {fields.length}개
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addItem}
                    className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5 p-1 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    추가
                  </Button>
                </div>

                <div className="space-y-2">
                  {/* 테두리 없는 컴팩트 로우 */}
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="group relative grid grid-cols-12 gap-2 pr-8 animate-in fade-in slide-in-from-right-2 duration-200"
                    >
                      {/* 품목명 */}
                      <div className="col-span-12 md:col-span-5">
                        <FormField
                          control={form.control}
                          name={`items.${index}.description`}
                          render={({ field }) => (
                            <div className="relative">
                              <Input
                                placeholder="품목명"
                                {...field}
                                className="h-9 text-sm border-gray-100 group-hover:border-gray-300 focus:border-primary bg-white/50 focus:bg-white transition-all"
                              />
                            </div>
                          )}
                        />
                      </div>

                      {/* 단가 */}
                      <div className="col-span-5 md:col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field }) => (
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="단가"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  field.onChange(val);
                                  const qty = form.getValues(`items.${index}.quantity`) || 1;
                                  form.setValue(`items.${index}.amount`, val * qty);
                                }}
                                className="h-9 text-sm border-gray-100 group-hover:border-gray-300 focus:border-primary bg-white/50 focus:bg-white text-right pr-6"
                              />
                              <span className="absolute right-2 top-2.5 text-[10px] text-gray-400 font-medium italic">₩</span>
                            </div>
                          )}
                        />
                      </div>

                      {/* 수량 */}
                      <div className="col-span-3 md:col-span-1.5 flex flex-col justify-center">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <div className="relative">
                              <Input
                                type="number"
                                min="1"
                                placeholder="1"
                                {...field}
                                value={field.value || ""}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1;
                                  field.onChange(val);
                                  const price = form.getValues(`items.${index}.unitPrice`) || 0;
                                  form.setValue(`items.${index}.amount`, price * val);
                                }}
                                className="h-9 text-xs border-gray-100 group-hover:border-gray-300 focus:border-primary bg-white/50 focus:bg-white text-center"
                              />
                            </div>
                          )}
                        />
                      </div>

                      {/* 합계 (읽기 전용 스타일) */}
                      <div className="col-span-4 md:col-span-2.5">
                        <div className="h-9 px-3 flex items-center justify-end bg-gray-50/50 rounded-md border border-gray-100/50 text-sm font-bold text-gray-700">
                          {form.watch(`items.${index}.amount`)?.toLocaleString() || 0}
                        </div>
                      </div>

                      {/* 삭제 버튼 (오른쪽 절대 위치) */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        disabled={fields.length === 1}
                        className="absolute -right-2 top-0 h-9 w-8 text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* 빠른 금액 추가 섹션 (자재비 입력 시 도움) */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="text-[10px] text-gray-400 font-medium py-1">마지막 품목 단가 퀵수정:</span>
                  {[5000, 10000, 30000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        const lastIdx = fields.length - 1;
                        form.setValue(`items.${lastIdx}.unitPrice`, amt);
                        const qty = form.getValues(`items.${lastIdx}.quantity`) || 1;
                        form.setValue(`items.${lastIdx}.amount`, amt * qty);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200 bg-white hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-colors h-6"
                    >
                      +{(amt / 1000).toLocaleString()}k
                    </button>
                  ))}
                </div>
              </div>

              {/* 푸터 합계 & 영수증 영역 */}
              <div className="bg-primary/10 p-5 rounded-2xl border border-primary/20 space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Total Amount</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-primary">₩{totalAmount.toLocaleString()}</span>
                      <span className="text-sm font-bold text-primary/60">원</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 text-right">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="receipt-upload"
                      />
                      <Label
                        htmlFor="receipt-upload"
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all border",
                          selectedFile
                            ? "bg-primary/20 border-primary text-primary font-bold shadow-inner"
                            : "bg-white border-primary/30 text-primary/70 hover:bg-primary/10 shadow-sm"
                        )}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span className="text-xs">{selectedFile ? "영수증 OK" : "영수증 첨부"}</span>
                      </Label>
                      {selectedFile && (
                        <button
                          type="button"
                          onClick={() => {
                            safeSetState(setSelectedFile, null);
                            form.setValue('receiptFile', undefined);
                          }}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 지출 저장 버튼 */}
                <Button
                  type="submit"
                  disabled={isSubmitting || totalAmount === 0}
                  className="w-full h-12 text-base font-black shadow-xl shadow-primary/20 transition-transform active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <RotateCcw className="h-5 w-5 mr-3 animate-spin" />
                  ) : (
                    <Save className="h-5 w-5 mr-3" />
                  )}
                  {fields.length}건의 지출 등록하기
                </Button>
              </div>

              {/* 고급 설정 (자재연동, 재고업데이트) */}
              <div className="space-y-4 pt-4 border-t border-dashed border-gray-100">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3 w-3 text-gray-400" />
                    <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Advanced Settings</Label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => safeSetState(setShowAdvanced, !showAdvanced)}
                    className="h-6 text-[10px] text-gray-400 hover:text-primary transition-colors gap-1"
                  >
                    연동 설정 {showAdvanced ? '숨기기' : '보기'}
                    <Plus className={cn("h-2.5 w-2.5 transition-transform", showAdvanced && "rotate-45")} />
                  </Button>
                </div>

                {showAdvanced && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* 자재요청 ID 연동 */}
                    {selectedCategory === SimpleExpenseCategory.MATERIAL && (
                      <FormField
                        control={form.control}
                        name="relatedRequestId"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className="text-xs font-semibold text-gray-600">관련 자재요청 ID</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Link className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                  placeholder="REQ-20241206-XXXXXX"
                                  {...field}
                                  className="h-9 pl-8 text-xs bg-white border-gray-200"
                                />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    )}

                    {/* 재고 매칭 섹션 */}
                    {selectedCategory === SimpleExpenseCategory.MATERIAL && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-gray-600">재고 연동 품목</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            onClick={() => {
                              const items = form.getValues('items');
                              const suggestions: any[] = [];
                              items.forEach(item => {
                                const matchedMaterial = materials.find(m =>
                                  m.branch === selectedBranchName &&
                                  m.name.toLowerCase().includes(item.description.toLowerCase())
                                );
                                if (matchedMaterial) {
                                  suggestions.push({
                                    type: 'material',
                                    id: matchedMaterial.id,
                                    name: matchedMaterial.name,
                                    quantity: item.quantity,
                                    unitPrice: item.unitPrice
                                  });
                                }
                              });
                              form.setValue('inventoryUpdates', suggestions);
                              toast({ title: "매칭 완료", description: `${suggestions.length}개 품목을 찾았습니다.` });
                            }}
                          >
                            품목 자동 매칭
                          </Button>
                        </div>

                        <div className="space-y-1.5">
                          {inventoryFields.length > 0 ? (
                            inventoryFields.map((f, i) => (
                              <div key={f.id} className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-gray-100 shadow-sm text-[10px]">
                                <Badge variant="outline" className="h-4 px-1 text-[8px] border-primary/20 text-primary">
                                  {form.watch(`inventoryUpdates.${i}.type`) === 'material' ? '자재' : '상품'}
                                </Badge>
                                <span className="flex-1 font-medium truncate text-gray-700">{form.watch(`inventoryUpdates.${i}.name`)}</span>
                                <span className="text-gray-400 font-bold">{form.watch(`inventoryUpdates.${i}.quantity`)}개</span>
                                <button
                                  type="button"
                                  onClick={() => removeInventory(i)}
                                  className="text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4 border border-dashed border-gray-100 rounded-lg">
                              <p className="text-[10px] text-gray-400 font-medium">매칭된 재고 품목이 없습니다.</p>
                            </div>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full h-8 text-[10px] text-gray-400 hover:text-primary transition-all"
                            onClick={() => appendInventory({
                              type: 'material',
                              id: '',
                              name: '',
                              quantity: 1,
                              unitPrice: 0
                            })}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            수동으로 항목 추가
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* 초기화 버튼 (필요시) */}
                    {continueMode && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="w-full h-8 text-[10px] text-gray-300 hover:text-red-400"
                      >
                        <RotateCcw className="h-2.5 w-2.5 mr-1" />
                        입력 내용 전체 초기화
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </form>
          </FormProvider>
        ) : (
          /* 엑셀 업로드 모드 */
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <FileSpreadsheet className="h-12 w-12 text-blue-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium">엑셀 파일 업로드</h3>
                <p className="text-sm text-muted-foreground">
                  엑셀 파일을 업로드하여 대량의 지출 데이터를 한 번에 등록할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-4">
                <Button onClick={downloadExcelTemplate} variant="outline">
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  템플릿 다운로드
                </Button>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                    id="excel-upload"
                    disabled={isExcelUploading}
                  />
                  <Button
                    onClick={() => document.getElementById('excel-upload')?.click()}
                    disabled={isExcelUploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    엑셀 파일 선택
                  </Button>
                </div>
              </div>

              {excelData.length > 0 && (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-800 mb-2">업로드된 데이터</h4>
                    <p className="text-sm text-green-600 mb-3">
                      {excelData.length}개의 지출 데이터가 로드되었습니다.
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {excelData.map((item, index) => (
                        <div key={index} className="text-xs bg-white p-2 rounded border">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{item['날짜']}</span>
                            <span className="text-green-600 font-bold">
                              {item.amount.toLocaleString()}원
                            </span>
                          </div>
                          <div className="text-gray-600">
                            {item['구매처']} - {item['품목명']}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 중복 데이터 표시 */}
                  {duplicateData.length > 0 && (
                    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <h4 className="font-medium text-yellow-800 mb-2">중복 데이터 (제외됨)</h4>
                      <p className="text-sm text-yellow-600 mb-3">
                        다음 {duplicateData.length}개의 데이터는 기존 데이터와 중복되어 제외되었습니다.
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {duplicateData.map((item, index) => (
                          <div key={index} className="text-xs bg-white p-2 rounded border border-yellow-300">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{item['날짜']}</span>
                              <span className="text-yellow-600 font-bold">
                                {item.amount.toLocaleString()}원
                              </span>
                            </div>
                            <div className="text-gray-600">
                              {item['구매처']} - {item['품목명']}
                            </div>
                            <div className="text-xs text-yellow-600 mt-1">
                              ⚠️ {item.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center space-x-4">
                    <Button
                      onClick={handleBulkUpload}
                      disabled={isExcelUploading}
                      className="flex-1 max-w-xs"
                    >
                      {isExcelUploading ? (
                        <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {excelData.length}개 데이터 등록
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        safeSetState(setExcelData, []);
                        safeSetState(setUploadMode, 'manual');
                      }}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      {/* 중복 확인 다이얼로그 */}
      <DuplicateCheckDialog
        open={duplicateDialogOpen}
        onOpenChange={(open) => {
          if (!open && duplicateInfo) {
            duplicateInfo.resolve(null); // 닫으면 취소로 처리
            setDuplicateInfo(null);
          }
          setDuplicateDialogOpen(open);
        }}
        duplicates={duplicateInfo}
        onConfirm={(name) => {
          if (duplicateInfo) {
            duplicateInfo.resolve(name);
            setDuplicateInfo(null);
            setDuplicateDialogOpen(false);
          }
        }}
        onCancel={() => {
          if (duplicateInfo) {
            duplicateInfo.resolve(null);
            setDuplicateInfo(null);
            setDuplicateDialogOpen(false);
          }
        }}
      />
    </Card>
  );
}
