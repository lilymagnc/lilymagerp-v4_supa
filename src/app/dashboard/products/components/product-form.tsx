
"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useBranches } from "@/hooks/use-branches"
import { useCategories } from "@/hooks/use-categories"
import { useEffect, useMemo } from "react"
const productSchema = z.object({
  name: z.string().min(1, "상품명을 입력해주세요."),
  mainCategory: z.string().min(1, "대분류를 선택해주세요."),
  midCategory: z.string().min(1, "중분류를 선택해주세요."),
  price: z.coerce.number().min(0, "가격은 0 이상이어야 합니다."),
  supplier: z.string().min(1, "공급업체를 선택해주세요."),
  size: z.string().min(1, "규격을 입력해주세요."),
  color: z.string().min(1, "색상을 입력해주세요."),
  branch: z.string().min(1, "지점을 선택해주세요."),
  stock: z.coerce.number().min(0, "재고는 0 이상이어야 합니다.").default(0),
})
export type ProductFormValues = z.infer<typeof productSchema>
interface ProductFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ProductFormValues) => void;
  product?: (ProductFormValues & { id: string; docId: string }) | null;
  initialData?: (ProductFormValues & { id: string; docId: string }) | null;
  branches?: any[];
  selectedBranch?: string;
}
const defaultValues: ProductFormValues = {
  name: "",
  mainCategory: "",
  midCategory: "",
  price: 0,
  supplier: "",
  size: "",
  color: "",
  branch: "",
  stock: 0,
}
export function ProductForm({ isOpen, onOpenChange, onSubmit, product, initialData, branches: propBranches, selectedBranch }: ProductFormProps) {
  const { branches } = useBranches();
  const { categories } = useCategories();
  const availableBranches = propBranches || branches;
  // 카테고리 목록 생성
  const mainCategories = useMemo(() => {
    const mainCats = categories.filter(cat => cat.type === 'main').map(cat => cat.name);
    return mainCats.length > 0 ? mainCats : ['완제품', '부자재'];
  }, [categories]);
  const midCategories = useMemo(() => {
    const midCats = categories.filter(cat => cat.type === 'mid').map(cat => cat.name);
    return midCats.length > 0 ? midCats : ['꽃다발', '꽃바구니', '포장지', '리본'];
  }, [categories]);
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
  })
  useEffect(() => {
    if(isOpen) {
      form.reset(product || defaultValues);
    }
  }, [isOpen, product, form]);
  const handleFormSubmit = (data: ProductFormValues) => {
    onSubmit(data);
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{product ? "상품 정보 수정" : "새 상품 추가"}</DialogTitle>
          <DialogDescription>상품의 상세 정보를 입력해주세요.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
             <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>상품명</FormLabel>
                  <FormControl>
                    <Input placeholder="릴리 화이트 셔츠" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mainCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대분류</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="대분류 선택" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mainCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
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
                name="midCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>중분류</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="중분류 선택" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {midCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>가격</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="45000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="size"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>규격</FormLabel>
                        <FormControl>
                        <Input placeholder="S, M, L / 95, 100" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>색상</FormLabel>
                        <FormControl>
                        <Input placeholder="White, Black" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <FormField
              control={form.control}
              name="supplier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>공급업체</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="공급업체 선택" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="꽃길 본사">꽃길 본사</SelectItem>
                      <SelectItem value="데님월드">데님월드</SelectItem>
                      <SelectItem value="티셔츠팩토리">티셔츠팩토리</SelectItem>
                      <SelectItem value="슬랙스하우스">슬랙스하우스</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>소속 지점</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="소속 지점 선택" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branches.filter(b => b.type !== '본사').map(branch => (
                        <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             {product && (
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>재고</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter className="pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">취소</Button>
                </DialogClose>
                <Button type="submit">저장</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
