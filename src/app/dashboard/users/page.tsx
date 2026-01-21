
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Users, Search, Filter, Key, UserCheck, UserX } from "lucide-react";
import { UserTable } from "./components/user-table";
import { UserForm } from "./components/user-form";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SystemUser {
  id: string; // email is the id or uuid
  email: string;
  role: string;
  franchise: string;
  position?: string;
  lastLogin?: string;
  isActive?: boolean;
  createdAt?: any;
}

export default function UsersPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // 권한 코드 -> 표시 이름 매핑
  const roleCodeToLabel: Record<string, string> = {
    hq_manager: "본사 관리자",
    admin: "본사 관리자",
    branch_manager: "가맹점 관리자",
    branch_user: "직원"
  };

  // 사용자 데이터 로드 함수 (Supabase)
  const loadUsers = async () => {
    try {
      setLoading(true);

      // 1. user_roles 테이블 조회
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // 2. employees 테이블 조회 (추가 정보)
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*');

      if (employeesError) console.error("Error fetching employees:", employeesError);

      const employeeMap = new Map();
      if (employeesData) {
        employeesData.forEach((emp: any) => {
          employeeMap.set(emp.email, emp);
        });
      }

      const usersData: SystemUser[] = rolesData.map((roleUser: any) => {
        const emp = employeeMap.get(roleUser.email);
        return {
          id: roleUser.user_id || roleUser.email, // Use uuid if available, else email
          email: roleUser.email,
          role: roleCodeToLabel[roleUser.role] || roleUser.role,
          franchise: roleUser.branch_name || '',
          position: emp?.position || '직원',
          isActive: roleUser.is_active,
          createdAt: roleUser.created_at,
          lastLogin: roleUser.updated_at // Approximate
        };
      });

      // 중복 이메일 체크 및 경고
      const emailCounts = usersData.reduce((acc, user) => {
        acc[user.email] = (acc[user.email] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
      if (duplicates.length > 0) {
        console.warn("중복 이메일 발견:", duplicates);
      }

      setUsers(usersData);
    } catch (error) {
      console.error("사용자 데이터 로드 오류:", error);
      toast({
        variant: "destructive",
        title: "데이터 로드 실패",
        description: "사용자 데이터를 불러오는 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };

  // 데이터 새로고침 함수
  const handleUserUpdated = () => {
    loadUsers();
  };

  // 초기 데이터 로드
  useEffect(() => {
    loadUsers();
  }, []);

  // 검색 및 필터링 적용
  useEffect(() => {
    let filtered = users;

    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.position && user.position.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 권한 필터링
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // 상태 필터링
    if (statusFilter !== "all") {
      const isActive = statusFilter === "active";
      filtered = filtered.filter(user =>
        statusFilter === "all" || user.isActive === isActive
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    try {
      const userToDelete = users.find(u => u.email === userEmail);
      if (userToDelete?.role === '본사 관리자') {
        toast({
          variant: "destructive",
          title: "삭제 불가",
          description: "본사 관리자는 삭제할 수 없습니다."
        });
        return;
      }

      if (userEmail === currentUser?.email) {
        toast({
          variant: "destructive",
          title: "삭제 불가",
          description: "현재 로그인한 계정은 삭제할 수 없습니다."
        });
        return;
      }

      if (!confirm(`${userEmail} 사용자를 정말 삭제하시겠습니까?`)) return;

      // Supabase에서 삭제 (user_roles 및 employees)
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('email', userEmail);

      if (roleError) throw roleError;

      const { error: empError } = await supabase
        .from('employees')
        .delete()
        .eq('email', userEmail);

      // Auth user 삭제는 Supabase Edge Function이나 Admin API가 필요하므로 여기서는 DB 레코드만 삭제 처리

      toast({
        title: "사용자 삭제 완료",
        description: `${userEmail} 사용자가 시스템에서 제거되었습니다.`
      });

      handleUserUpdated();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: `사용자 삭제 중 오류가 발생했습니다: ${error.message}`
      });
    }
  };

  const handlePasswordReset = async (userId: string, userEmail: string) => {
    // Supabase Password Reset Email
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: window.location.origin + '/update-password',
      });

      if (error) throw error;

      toast({
        title: "비밀번호 재설정 메일 발송",
        description: `${userEmail}로 비밀번호 재설정 링크를 보냈습니다.`,
      });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast({
        variant: "destructive",
        title: "발송 실패",
        description: "비밀번호 재설정 메일 발송 실패."
      });
    }
  };

  const handleToggleUserStatus = async (userId: string, userEmail: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;

      // user_roles 테이블 업데이트
      const { error } = await supabase
        .from('user_roles')
        .update({ is_active: newStatus })
        .eq('email', userEmail);

      if (error) throw error;

      toast({
        title: "상태 변경 완료",
        description: `${userEmail} 사용자가 ${newStatus ? '활성화' : '비활성화'}되었습니다.`
      });

      handleUserUpdated();
    } catch (error: any) {
      console.error("Error toggling user status:", error);
      toast({
        variant: "destructive",
        title: "상태 변경 실패",
        description: `오류가 발생했습니다: ${error.message}`
      });
    }
  };

  if (!currentUser) return null; // 로딩 중 등

  // 권한 체크 완화 (이메일로 비상 접근 허용 또는 관리자 키워드 포함 확인)
  const canAccess = currentUser.role === '본사 관리자' ||
    currentUser.email === 'lilymag0301@gmail.com'; // 비상 접근 허용

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-96 border rounded-md bg-slate-50">
        <Key className="h-10 w-10 text-slate-400 mb-4" />
        <h3 className="text-lg font-medium">접근 권한이 없습니다</h3>
        <p className="text-muted-foreground mt-2">
          현재 계정({currentUser.role})은 사용자 관리 페이지에 접근할 수 없습니다.
        </p>
      </div>
    );
  }

  const activeUsers = users.filter(user => user.isActive).length;
  const inactiveUsers = users.filter(user => !user.isActive).length;

  return (
    <div>
      <PageHeader
        title="사용자 관리"
        description="시스템 사용자 계정과 권한을 관리하세요."
      >
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          사용자 추가
        </Button>
      </PageHeader>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 사용자</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">비활성 사용자</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{inactiveUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">관리자</CardTitle>
            <Key className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {users.filter(user => user.role === '본사 관리자').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 검색 및 필터 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            검색 및 필터
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="이메일 또는 직위로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="권한 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 권한</SelectItem>
                <SelectItem value="본사 관리자">본사 관리자</SelectItem>
                <SelectItem value="가맹점 관리자">가맹점 관리자</SelectItem>
                <SelectItem value="직원">직원</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 상태</SelectItem>
                <SelectItem value="active">활성</SelectItem>
                <SelectItem value="inactive">비활성</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <UserTable
        users={filteredUsers}
        onDeleteUser={handleDeleteUser}
        onPasswordReset={handlePasswordReset}
        onToggleStatus={handleToggleUserStatus}
        onUserUpdated={handleUserUpdated}
      />

      <UserForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}
