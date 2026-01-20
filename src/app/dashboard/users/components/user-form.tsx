
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
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc, query, where, getDocs, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Loader2 } from "lucide-react"
import { POSITION_OPTIONS, POSITION_TO_ROLE } from "@/lib/constants";

// 직원 데이터 타입 정의
interface EmployeeData {
  id: string;
  name: string;
  email: string;
  position: string;
  department: string;
  contact: string;
  hireDate: Date;
  birthDate: Date;
  address: string;
  createdAt: any;
  [key: string]: any;
}

const userSchema = z.object({
  email: z.string().email("유효한 이메일을 입력해주세요."),
  role: z.string().min(1, "권한을 선택해주세요."),
  franchise: z.string().min(1, "소속을 선택해주세요."),
  password: z.string().optional(),
  // 직원 정보 추가 필드
  name: z.string().min(1, "이름을 입력해주세요."),
  position: z.string().min(1, "직위를 입력해주세요."),
  contact: z.string().min(1, "연락처를 입력해주세요."),
})

type UserFormValues = z.infer<typeof userSchema>

interface UserFormProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  user?: UserFormValues & { id: string } | null
  onUserUpdated?: () => void // 사용자 업데이트 후 콜백 추가
}

export function UserForm({ isOpen, onOpenChange, user, onUserUpdated }: UserFormProps) {
  const { branches } = useBranches()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [employeeData, setEmployeeData] = useState<EmployeeData | null>(null)
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

  // 수정 모드일 때 사용자 데이터와 직원 데이터를 가져와서 폼 초기화
  useEffect(() => {
    const fetchUserAndEmployeeData = async () => {
      if (isEditMode && user?.email) {
        try {
          // 1) 사용자 기본 문서 조회로 최신 값 확보
          const userDocRef = doc(db, "users", user.email)
          const userDocSnap = await getDoc(userDocRef)
          
          // 2) userRoles에서 branchName/role 코드 보완
          const userRolesSnap = await getDocs(query(collection(db, "userRoles"), where("email", "==", user.email), where("isActive", "==", true)))
          
          const roleCodeToLabel: Record<string, string> = {
            hq_manager: "본사 관리자",
            branch_manager: "가맹점 관리자",
            branch_user: "직원",
            admin: "본사 관리자",
          }
          
          let resolvedRole = user.role || ""
          let resolvedFranchise = user.franchise || ""
          
          if (userDocSnap.exists()) {
            const d = userDocSnap.data() as any
            resolvedRole = (d.role || resolvedRole) as string
            resolvedFranchise = (d.franchise || resolvedFranchise) as string
          }
          
          if (!resolvedFranchise || !resolvedRole) {
            if (!userRolesSnap.empty) {
              const r = userRolesSnap.docs[0].data() as any
              // role 코드 → 라벨 매핑
              const mapped = roleCodeToLabel[r.role as string]
              if (!resolvedRole && mapped) resolvedRole = mapped
              if (!resolvedFranchise && r.branchName) resolvedFranchise = r.branchName
            }
          }
          
          // 사용자 데이터 설정 (권한/소속 보완값 반영)
          const userData = {
            email: user.email,
            role: resolvedRole,
            franchise: resolvedFranchise,
            password: "",
            name: "",
            position: "",
            contact: "",
          }
          
          // 직원 데이터 가져오기
          const employeesQuery = collection(db, "employees")
          const employeeSnapshot = await getDocs(query(employeesQuery, where("email", "==", user.email)))
          
          if (!employeeSnapshot.empty) {
            const employeeDoc = employeeSnapshot.docs[0]
            const employee = employeeDoc.data() as EmployeeData
            setEmployeeData({
              ...employee,
              id: employeeDoc.id // 문서 ID 추가
            })
            // 직원 데이터로 폼 업데이트
            form.reset({
              ...userData,
              name: employee.name || "",
              position: employee.position || "",
              contact: employee.contact || "",
            })
          } else {
            // 직원 데이터가 없는 경우 사용자 데이터만 설정
            form.reset(userData)
          }
        } catch (error) {
          console.error("Error fetching employee data:", error)
          // 에러가 발생해도 사용자 데이터는 설정
          form.reset({
            email: user.email,
            role: user.role || "",
            franchise: user.franchise || "",
            password: "",
            name: "",
            position: "",
            contact: "",
          })
        }
      } else if (!isEditMode) {
        // 새 사용자 추가 모드일 때 폼 초기화
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

  const onSubmit = async (data: UserFormValues) => {
    setLoading(true);
    try {
      // 중복 이메일 체크 (새 사용자 추가 시에만)
      if (!isEditMode) {
        const existingUserQuery = query(
          collection(db, "users"),
          where("email", "==", data.email)
        );
        const existingUser = await getDocs(existingUserQuery);
        if (!existingUser.empty) {
          toast({
            variant: "destructive",
            title: "중복 이메일",
            description: "이미 등록된 이메일입니다."
          });
          setLoading(false);
          return;
        }
      }

      // 최종 권한 결정
      let finalRole = data.role;
      let finalFranchise = data.franchise;

      if (isEditMode) {
        // 1. users 컬렉션 업데이트
        const userDocRef = doc(db, "users", data.email);
        const existingDoc = await getDoc(userDocRef);
        
        if (existingDoc.exists()) {
          const currentData = existingDoc.data();
          const newData = {
            ...currentData,
            role: finalRole,
            franchise: finalFranchise,
            updatedAt: serverTimestamp()
          };
          await setDoc(userDocRef, newData);
        } else {
          toast({
            variant: "destructive",
            title: "오류",
            description: "사용자 문서를 찾을 수 없습니다."
          });
          setLoading(false);
          return;
        }

        // 2. userRoles 컬렉션 업데이트
        const roleMapping = {
          "본사 관리자": "hq_manager",
          "가맹점 관리자": "branch_manager", 
          "직원": "branch_user"
        };
        const mappedRole = roleMapping[finalRole as keyof typeof roleMapping] || "branch_user";
        
        const userRolesQuery = query(collection(db, "userRoles"), where("email", "==", data.email));
        const userRolesSnapshot = await getDocs(userRolesQuery);
        
        if (!userRolesSnapshot.empty) {
          const userRoleDoc = userRolesSnapshot.docs[0];
          await updateDoc(userRoleDoc.ref, {
            role: mappedRole,
            branchName: finalFranchise,
            updatedAt: serverTimestamp()
          });
        } else {
          // userRoles가 없으면 생성
          await addDoc(collection(db, "userRoles"), {
            userId: data.email,
            email: data.email,
            role: mappedRole,
            branchName: finalFranchise,
            permissions: getPermissionsForRole(mappedRole),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isActive: true
          });
        }

        // 3. 직원 데이터 업데이트
        await updateEmployeeData(data);

        toast({
          title: "성공",
          description: "사용자 정보가 성공적으로 수정되었습니다.",
        });
      } else {
        // 새 사용자 추가
        // 1. users 컬렉션에 추가
        const userDocRef = doc(db, "users", data.email);
        await setDoc(userDocRef, {
          email: data.email,
          role: finalRole,
          franchise: finalFranchise,
          createdAt: serverTimestamp(),
          isActive: true
        });

        // 2. userRoles 컬렉션에 추가
        const roleMapping = {
          "본사 관리자": "hq_manager",
          "가맹점 관리자": "branch_manager", 
          "직원": "branch_user"
        };
        const mappedRole = roleMapping[finalRole as keyof typeof roleMapping] || "branch_user";
        
        await addDoc(collection(db, "userRoles"), {
          userId: data.email,
          email: data.email,
          role: mappedRole,
          branchName: finalFranchise,
          permissions: getPermissionsForRole(mappedRole),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isActive: true
        });

        // 3. 직원 데이터 추가
        await addEmployeeData(data);

        toast({
          title: "성공",
          description: "새 사용자가 추가되었습니다.",
        });
      }

      // 사용자 업데이트 콜백 호출
      if (onUserUpdated) {
        onUserUpdated();
      }

      // 다이얼로그 닫기
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    } catch(error) {
      console.error("❌ Error saving user:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "사용자 정보 저장 중 오류가 발생했습니다."
      })
    } finally {
      setLoading(false);
    }
  }

  // 역할에 따른 권한 반환 함수
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

  // 직원 데이터 업데이트 함수
  const updateEmployeeData = async (data: UserFormValues) => {
    try {
      const employeesQuery = query(collection(db, "employees"), where("email", "==", data.email));
      const employeeSnapshot = await getDocs(employeesQuery);
      
      if (!employeeSnapshot.empty) {
        // 기존 직원 데이터 업데이트
        const employeeDoc = employeeSnapshot.docs[0];
        await updateDoc(employeeDoc.ref, {
          name: data.name,
          position: data.position,
          contact: data.contact,
          updatedAt: serverTimestamp()
        });
      } else {
        // 새 직원 데이터 생성
        await addDoc(collection(db, "employees"), {
          email: data.email,
          name: data.name,
          position: data.position,
          contact: data.contact,
          department: data.franchise,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("직원 데이터 업데이트 오류:", error);
    }
  }

  // 직원 데이터 추가 함수
  const addEmployeeData = async (data: UserFormValues) => {
    try {
      await addDoc(collection(db, "employees"), {
        email: data.email,
        name: data.name,
        position: data.position,
        contact: data.contact,
        department: data.franchise,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("직원 데이터 추가 오류:", error);
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
                      {/* 현재 값이 옵션 목록에 없더라도 표시되도록 임시 옵션 추가 */}
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
                    <FormLabel htmlFor="user-password">임시 비밀번호</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="임시 비밀번호" 
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
