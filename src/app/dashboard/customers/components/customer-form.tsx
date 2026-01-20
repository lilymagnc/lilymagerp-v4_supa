
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
import { useBranches } from "@/hooks/use-branches"
import { useAuth } from "@/hooks/use-auth"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import type { Customer } from "@/hooks/use-customers"
const customerSchema = z.object({
  name: z.string().min(1, "고객명을 입력해주세요."),
  type: z.enum(["personal", "company"]).default("personal"),
  companyName: z.string().optional(),
  contact: z.string().min(1, "연락처를 입력해주세요."),
  email: z.string().optional().or(z.literal('')),
  branch: z.string().min(1, "담당 지점을 선택해주세요."),
  grade: z.string().optional(),
  tags: z.string().optional(),
  birthday: z.string().optional(),
  weddingAnniversary: z.string().optional(),
  foundingAnniversary: z.string().optional(),
  firstVisitDate: z.string().optional(),
  otherAnniversaryName: z.string().optional(),
  otherAnniversary: z.string().optional(),
  memo: z.string().optional(),
  // 특이사항 및 월결제일 필드 추가
  specialNotes: z.string().optional(),
  monthlyPaymentDay: z.string().optional(),
  // Business fields
  businessNumber: z.string().optional(),
  ceoName: z.string().optional(),
  businessType: z.string().optional(),
  businessItem: z.string().optional(),
  businessAddress: z.string().optional(),
}).refine((data) => {
  // 기업 고객인 경우 회사명이 필수
  if (data.type === 'company') {
    return data.companyName && data.companyName.trim().length > 0;
  }
  return true;
}, {
  message: "기업 고객의 경우 회사명을 입력해주세요.",
  path: ["companyName"],
});
export type CustomerFormValues = z.infer<typeof customerSchema>
interface CustomerFormProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onSubmit: (data: CustomerFormValues) => void
  customer?: Customer | null
}
const defaultValues: CustomerFormValues = {
  name: "",
  type: "personal",
  companyName: "",
  contact: "",
  email: "",
  branch: "",
  grade: "신규",
  tags: "",
  birthday: "",
  weddingAnniversary: "",
  foundingAnniversary: "",
  firstVisitDate: "",
  otherAnniversaryName: "",
  otherAnniversary: "",
  memo: "",
  specialNotes: "",
  monthlyPaymentDay: "",
  businessNumber: "",
  ceoName: "",
  businessType: "",
  businessItem: "",
  businessAddress: "",
}
export function CustomerForm({ isOpen, onOpenChange, onSubmit, customer }: CustomerFormProps) {
  const { branches } = useBranches()
  const { user } = useAuth()
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
  })
  useEffect(() => {
    if (isOpen) {
      if (customer) {
        form.reset({
          ...customer,
          birthday: customer.birthday || "",
          weddingAnniversary: customer.weddingAnniversary || "",
          foundingAnniversary: customer.foundingAnniversary || "",
          firstVisitDate: customer.firstVisitDate || "",
          otherAnniversary: customer.otherAnniversary || "",
          otherAnniversaryName: customer.otherAnniversaryName || "",
          specialNotes: customer.specialNotes || "",
          monthlyPaymentDay: customer.monthlyPaymentDay || "",
        });
      } else {
        // 새 고객 추가 시 로그인한 사용자의 지점으로 자동 설정
        const userBranch = user?.franchise && user.franchise !== '본사' && user.franchise !== '미지정' 
          ? user.franchise 
          : "";
        
        form.reset({
          ...defaultValues,
          branch: userBranch,
        });
      }
    }
  }, [customer, form, isOpen, user]);
  const handleFormSubmit = (data: CustomerFormValues) => {
    onSubmit(data);
  }
  const customerType = form.watch("type");
  
  // 고객유형이 변경될 때 담당자명을 고객명으로 자동 설정
  useEffect(() => {
    if (customerType === 'company') {
      const currentName = form.getValues("name");
      if (currentName && !form.getValues("companyName")) {
        form.setValue("companyName", currentName);
      }
    }
  }, [customerType, form]);
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customer ? "고객 정보 수정" : "새 고객 추가"}</DialogTitle>
          <DialogDescription>고객의 상세 정보를 입력하고 관리합니다.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
             <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>고객 유형</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="personal">개인</SelectItem>
                        <SelectItem value="company">기업</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            <Separator />
            <p className="text-sm font-semibold">담당자 정보</p>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{customerType === 'company' ? '담당자명' : '고객명'} *</FormLabel>
                    <FormControl>
                      <Input placeholder="홍길동" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>연락처 *</FormLabel>
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
                  <FormLabel>이메일 (선택사항)</FormLabel>
                  <FormControl>
                    <Input placeholder="customer@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="branch"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>담당 지점 *</FormLabel>
                        {user?.role === '본사 관리자' ? (
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                  <SelectTrigger><SelectValue placeholder="지점 선택" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {branches.filter(b => b.type !== '본사').map(branch => (
                                      <SelectItem key={branch.id} value={branch.name}>{branch.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                              <Input 
                                  value={field.value} 
                                  readOnly 
                                  className="bg-gray-50"
                                  placeholder="자동 설정됨"
                              />
                          </FormControl>
                        )}
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="grade"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>고객 등급</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="등급 선택" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="신규">신규</SelectItem>
                                <SelectItem value="일반">일반</SelectItem>
                                <SelectItem value="VIP">VIP</SelectItem>
                                <SelectItem value="VVIP">VVIP</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>
            <Separator className="my-6" />
            <p className="text-sm font-semibold">추가 정보</p>
            <Separator />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>태그</FormLabel>
                  <FormControl>
                    <Input placeholder="기념일, 단체주문 (쉼표로 구분)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator className="my-4" />
            <p className="text-sm font-semibold mb-4">기념일 정보</p>
            
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="birthday"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>생일</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date" 
                                    placeholder="YYYY-MM-DD" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="weddingAnniversary"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>결혼기념일</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date" 
                                    placeholder="YYYY-MM-DD" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                {customerType === 'company' && (
                    <FormField
                        control={form.control}
                        name="foundingAnniversary"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>창립기념일</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="date" 
                                        placeholder="YYYY-MM-DD" 
                                        {...field} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
                <FormField
                    control={form.control}
                    name="firstVisitDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>첫 방문일</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date" 
                                    placeholder="YYYY-MM-DD" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="otherAnniversaryName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>기타 기념일명</FormLabel>
                            <FormControl>
                                <Input 
                                    placeholder="예: 아이 생일, 개업일 등" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="otherAnniversary"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>기타 기념일</FormLabel>
                            <FormControl>
                                <Input 
                                    type="date" 
                                    placeholder="YYYY-MM-DD" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            {customerType === 'company' && (
              <>
                <Separator className="my-6" />
                <p className="text-sm font-semibold">사업자 정보 (세금계산서 발행용)</p>
                <Separator />
                                 <FormField control={form.control} name="companyName" render={({ field }) => (
                     <FormItem>
                       <FormLabel>회사명 *</FormLabel>
                       <FormControl><Input placeholder="꽃길 주식회사" {...field} /></FormControl>
                       <FormMessage />
                     </FormItem>
                 )}/>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="businessNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>사업자등록번호</FormLabel>
                        <FormControl><Input placeholder="123-45-67890" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )}/>
                  <FormField control={form.control} name="ceoName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>대표자명</FormLabel>
                        <FormControl><Input placeholder="홍길동" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )}/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="businessType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>업태</FormLabel>
                        <FormControl><Input placeholder="소매업" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )}/>
                  <FormField control={form.control} name="businessItem" render={({ field }) => (
                      <FormItem>
                        <FormLabel>종목</FormLabel>
                        <FormControl><Input placeholder="전자상거래업" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                  )}/>
                </div>
                <FormField control={form.control} name="businessAddress" render={({ field }) => (
                    <FormItem>
                        <FormLabel>사업장 주소</FormLabel>
                        <FormControl><Textarea placeholder="상세 주소 입력" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )}/>
              </>
            )}
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Textarea placeholder="고객 관련 메모 기록" {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {customerType === 'company' && (
              <>
                <Separator className="my-6" />
                <p className="text-sm font-semibold">결제 및 특이사항</p>
                <Separator />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyPaymentDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>월결제일</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="1-31" 
                            min="1" 
                            max="31"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="specialNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>특이사항</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="고객 관련 특이사항, 주의사항, 선호사항 등을 기록해주세요" 
                          {...field} 
                          rows={4} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
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
