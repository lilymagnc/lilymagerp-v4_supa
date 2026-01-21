
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
import { useBranches } from "@/hooks/use-branches"
import { useToast } from "@/hooks/use-toast"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"
import { POSITION_OPTIONS } from "@/lib/constants";

// 직원 데이터 타입 정의 (Supabase)
interface EmployeeData {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  contact: string;
  hire_date?: string;
  birth_date?: string;
  address?: string;
  created_at?: any;
}

const userSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요."),
  role: z.string().min(1, "권한을 선택해주세요."),
  franchise: z.string().min(1, "소속을 선택해주세요."),
  password: z.string().optional(),
  name: z.string().min(1, "이름을 입력해주세요."),
  position: z.string().min(1, "직위를 입력해주세요."),
  contact: z.string().min(1, "연락처를 입력해주세요."),
})

type UserFormValues = z.infer<typeof userSchema>

interface UserFormProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  user?: UserFormValues & { id: string } | null
  onUserUpdated?: () => void
}

export function UserForm({ isOpen, onOpenChange, user, onUserUpdated }: UserFormProps) {
  const { branches } = useBranches()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const isEditMode = !!user

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      role: "",
      franchise: "",
      password: "",
      name: "",
      position: "",
      contact: "",
    },
  })

  // 1. 기존 데이터 불러오기
  useEffect(() => {
    const fetchUserAndEmployeeData = async () => {
      if (isEditMode && user?.email) {
        try {
          // 1) user_roles에서 기본 정보 가져오기
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('*')
            .eq('email', user.email)
            .single();

          // 2) employees에서 상세 정보 가져오기
          const { data: employeeData } = await supabase
            .from('employees')
            .select('*')
            .eq('email', user.email)
            .maybeSingle();

          // Role mapping
          const roleCodeToLabel: Record<string, string> = {
            hq_manager: "본사 관리자",
            branch_manager: "가맹점 관리자",
            branch_user: "직원",
            admin: "본사 관리자",
          }

          // Initial values
          const initialEmail = user.email;
          let initialRole = user.role;
          let initialFranchise = user.franchise;
          let initialName = "";
          let initialPosition = "";
          let initialContact = "";

          if (roleData) {
            initialRole = roleCodeToLabel[roleData.role] || roleData.role;
            initialFranchise = roleData.branch_name || "";
          }

          if (employeeData) {
            initialName = employeeData.name || "";
            initialPosition = employeeData.position || "";
            initialContact = employeeData.contact || "";
          }

          form.reset({
            email: initialEmail,
            role: initialRole,
            franchise: initialFranchise,
            password: "",
            name: initialName,
            position: initialPosition,
            contact: initialContact,
          });

        } catch (error) {
          console.error("Error fetching user details:", error);
          form.reset({
            email: user.email,
            role: user.role || "",
            franchise: user.franchise || "",
            name: user.name || "",
            position: user.position || "",
            contact: user.contact || "",
          });
        }
      } else if (!isEditMode) {
        form.reset({
          email: "",
          role: "",
          franchise: "",
          password: "",
          name: "",
          position: "",
          contact: "",
        })
      }
    }

    if (isOpen) {
      fetchUserAndEmployeeData()
    }
  }, [isOpen, user, isEditMode, form])

  // 2. 제출 (Create / Update)
  const onSubmit = async (data: UserFormValues) => {
    setLoading(true);
    try {
      // 권한 매핑
      const roleMapping = {
        "본사 관리자": "hq_manager",
        "가맹점 관리자": "branch_manager",
        "직원": "branch_user"
      };
      const mappedRole = roleMapping[data.role as keyof typeof roleMapping] || "branch_user";

      // A. 신규 사용자 중복 체크 (Supabase user_roles)
      if (!isEditMode) {
        const { data: existing, error: checkError } = await supabase
          .from('user_roles')
          .select('email')
          .eq('email', data.email)
          .maybeSingle();

        if (existing) {
          toast({
            variant: "destructive",
            title: "중복 이메일",
            description: "이미 등록된 이메일입니다."
          });
          setLoading(false);
          return;
        }

        // 새 사용자: Supabase Auth signUp 필요 (클라이언트 사이드라 제한적일 수 있음)
        // 여기서는 DB 레코드만 생성한다고 가정하거나, 필요 시 Admin API 호출
        // 일단 DB 레코드 생성에 집중
      }

      // B. user_roles upsert (이메일 기준)
      // Upsert user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
          email: data.email,
          role: mappedRole,
          branch_name: data.franchise,
          is_active: true,
          permissions: getPermissionsForRole(mappedRole)
        }, { onConflict: 'email' });

      if (roleError) throw roleError;

      // C. employees upsert (이메일 기준)
      const { error: empError } = await supabase
        .from('employees')
        .upsert({
          email: data.email,
          name: data.name,
          position: data.position,
          contact: data.contact,
          department: data.franchise,
        }, { onConflict: 'email' });

      if (empError) throw empError;

      toast({
        title: "성공",
        description: isEditMode ? "사용자 정보가 수정되었습니다." : "새 사용자가 등록되었습니다.",
      });

      if (onUserUpdated) onUserUpdated();
      setTimeout(() => onOpenChange(false), 500);

    } catch (error: any) {
      console.error("❌ Error saving user:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: `저장 중 오류가 발생했습니다: ${error.message}`
      })
    } finally {
      setLoading(false);
    }
  }

  const getPermissionsForRole = (role: string) => {
    switch (role) {
      case 'hq_manager':
      case 'admin':
        return ['create_request', 'view_all_requests', 'edit_prices', 'change_status', 'manage_users', 'consolidate_requests', 'export_data'];
      case 'branch_manager':
        return ['create_request', 'view_all_requests', 'change_status'];
      case 'branch_user':
      default:
        return ['create_request'];
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "사용자 정보 수정" : "새 사용자 추가"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "사용자 권한, 소속 및 직원 정보를 수정합니다." : "새 사용자 계정을 생성하고 직원 정보를 함께 등록합니다."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="user-email">이메일</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="user@example.com"
                      {...field}
                      disabled={isEditMode}
                      id="user-email"
                      name="email"
                      autoComplete="email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="user-name">이름</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="홍길동"
                      {...field}
                      id="user-name"
                      name="name"
                      autoComplete="name"
                    />
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
                  <FormLabel htmlFor="user-contact">연락처</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="010-1234-5678"
                      {...field}
                      id="user-contact"
                      name="contact"
                      autoComplete="tel"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="user-position">직위</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger id="user-position" name="position">
                        <SelectValue placeholder="직위 선택" id="user-position-value" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent id="user-position-content">
                      {POSITION_OPTIONS.map(option => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          id={`position-${option.value}`}
                          className="cursor-pointer"
                        >
                          {option.label}
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="user-role">권한</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger id="user-role" name="role">
                        <SelectValue placeholder="권한 선택" id="user-role-value" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent id="user-role-content">
                      <SelectItem value="본사 관리자" id="role-hq-manager" className="cursor-pointer">본사 관리자</SelectItem>
                      <SelectItem value="가맹점 관리자" id="role-branch-manager" className="cursor-pointer">가맹점 관리자</SelectItem>
                      <SelectItem value="직원" id="role-employee" className="cursor-pointer">직원</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="franchise"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="user-franchise">소속</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger id="user-franchise" name="franchise">
                        <SelectValue placeholder="소속 선택" id="user-franchise-value" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent id="user-franchise-content">
                      {field.value &&
                        field.value !== '' &&
                        !['본사', ...branches.map(b => b.name)].includes(field.value) && (
                          <SelectItem value={field.value} id={`franchise-current`} className="cursor-pointer">
                            {field.value}
                          </SelectItem>
                        )}
                      <SelectItem value="본사" id="franchise-hq" className="cursor-pointer">본사</SelectItem>
                      {branches.map(branch => (
                        <SelectItem
                          key={branch.id}
                          value={branch.name}
                          id={`franchise-${branch.id}`}
                          className="cursor-pointer"
                        >
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditMode && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="user-password">초기 비밀번호</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="로그인 시 사용할 초기 비밀번호"
                        {...field}
                        id="user-password"
                        name="password"
                        autoComplete="new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">취소</Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? "수정" : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
