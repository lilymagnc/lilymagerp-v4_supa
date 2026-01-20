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
import { Textarea } from "@/components/ui/textarea"
import { useEffect } from "react"
import { Separator } from "@/components/ui/separator"
import type { Partner } from "@/hooks/use-partners"
const partnerSchema = z.object({
  name: z.string().min(1, "거래처명을 입력해주세요."),
  type: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("유효한 이메일을 입력해주세요.").optional().or(z.literal('')),
  address: z.string().optional(),
  businessNumber: z.string().optional(),
  ceoName: z.string().optional(),
  bankAccount: z.string().optional(),
  items: z.string().optional(),
  memo: z.string().optional(),
  defaultMarginPercent: z.number().min(0).max(100).optional(),
});
export type PartnerFormValues = z.infer<typeof partnerSchema>
interface PartnerFormProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (data: PartnerFormValues) => void
  partner?: Partner | null
}
const defaultValues: PartnerFormValues = {
  name: "",
  type: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  businessNumber: "",
  ceoName: "",
  bankAccount: "",
  items: "",
  memo: "",
  defaultMarginPercent: 20,
}
export function PartnerForm({ isOpen, onOpenChange, onSubmit, partner }: PartnerFormProps) {
  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerSchema),
    defaultValues,
  })
  useEffect(() => {
    if (isOpen) {
      form.reset(partner || defaultValues);
    }
  }, [partner, form, isOpen]);
  const handleFormSubmit = (data: PartnerFormValues) => {
    onSubmit(data);
  }
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{partner ? "거래처 정보 수정" : "새 거래처 추가"}</DialogTitle>
          <DialogDescription>매입처(공급업체)의 상세 정보를 입력하고 관리합니다. 거래처명만 입력해도 저장 가능합니다.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <Separator />
            <p className="text-sm font-semibold">기본 정보</p>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>거래처명 *</FormLabel>
                    <FormControl>
                      <Input placeholder="플라워팜" {...field} />
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
                    <FormLabel>거래 유형</FormLabel>
                    <FormControl>
                      <Input placeholder="자재, 생화, 운송 등" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultMarginPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>기본 마진율 (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="20"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="items"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>주요 품목</FormLabel>
                  <FormControl>
                    <Input placeholder="장미, 카네이션 (쉼표로 구분)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator className="my-6" />
            <p className="text-sm font-semibold">담당자 정보</p>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>담당자명</FormLabel>
                    <FormControl>
                      <Input placeholder="김철수" {...field} />
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
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input placeholder="partner@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <>
              <Separator className="my-6" />
              <p className="text-sm font-semibold">사업자 정보 (세금계산서 발행용)</p>
              <Separator />
              <FormField control={form.control} name="ceoName" render={({ field }) => (
                <FormItem>
                  <FormLabel>대표자명</FormLabel>
                  <FormControl><Input placeholder="홍길동" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="businessNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>사업자등록번호</FormLabel>
                  <FormControl><Input placeholder="123-45-67890" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>사업장 주소</FormLabel>
                  <FormControl><Textarea placeholder="상세 주소 입력" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bankAccount" render={({ field }) => (
                <FormItem>
                  <FormLabel>계좌 정보</FormLabel>
                  <FormControl><Input placeholder="은행명, 계좌번호, 예금주" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </>
            <Separator className="my-6" />
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Textarea placeholder="거래 조건, 특이사항 등 기록" {...field} rows={4} />
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
