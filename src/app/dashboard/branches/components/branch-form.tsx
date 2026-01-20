
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
  DialogDescription,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useEffect } from "react"
import type { Branch } from "@/hooks/use-branches"
const branchSchema = z.object({
  name: z.string().min(1, "지점명을 입력해주세요."),
  type: z.string().min(1, "유형을 선택해주세요."),
  manager: z.string().optional(),
  employeeCount: z.coerce.number().optional(),
  businessNumber: z.string().optional(),
  address: z.string().min(1, "주소를 입력해주세요."),
  phone: z.string().min(1, "연락처를 입력해주세요."),
  account: z.string().optional(),
})
export type BranchFormValues = z.infer<typeof branchSchema>
interface BranchFormProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (data: Branch) => void
  branch?: Branch | null
}
const defaultValues: BranchFormValues = {
  name: "",
  type: "",
  manager: "",
  employeeCount: 0,
  businessNumber: "",
  address: "",
  phone: "",
  account: "",
}
export function BranchForm({ isOpen, onOpenChange, onSubmit, branch }: BranchFormProps) {
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),
    defaultValues: branch || defaultValues,
  })
  useEffect(() => {
    if (isOpen) {
      // Reset form with all data, including non-form fields to preserve them
      form.reset(branch || defaultValues);
    }
  }, [branch, form, isOpen]);
  const handleFormSubmit = (data: BranchFormValues) => {
    // When submitting, combine form data with non-form data like deliveryFees
    // This ensures that data not present in the form is not lost on update.
    const fullBranchData = {
        ...(branch || {}), // old data including deliveryFees
        ...data,           // new data from the form
    } as Branch;
    onSubmit(fullBranchData);
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{branch ? "지점 정보 수정" : "새 지점 추가"}</DialogTitle>
          <DialogDescription>지점의 상세 정보를 입력하고 관리합니다.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>지점명</FormLabel>
                    <FormControl>
                      <Input placeholder="릴리맥 광화문점" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>유형</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                          <SelectTrigger><SelectValue placeholder="지점 유형 선택" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              <SelectItem value="본사">본사</SelectItem>
                              <SelectItem value="직영점">직영점</SelectItem>
                              <SelectItem value="가맹점">가맹점</SelectItem>
                              <SelectItem value="기타">기타</SelectItem>
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="manager"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>점장(책임자)</FormLabel>
                        <FormControl>
                        <Input placeholder="홍길동" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="employeeCount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>직원 수</FormLabel>
                        <FormControl>
                        <Input type="number" placeholder="5" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
             <FormField
                control={form.control}
                name="businessNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사업자 등록번호</FormLabel>
                    <FormControl>
                      <Input placeholder="123-45-67890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>연락처</FormLabel>
                  <FormControl>
                    <Input placeholder="010-1234-5678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>주소</FormLabel>
                  <FormControl>
                    <Textarea placeholder="상세 주소 입력" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="account"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>계좌 정보</FormLabel>
                  <FormControl>
                    <Input placeholder="은행명, 계좌번호, 예금주" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
