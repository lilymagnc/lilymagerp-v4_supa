
"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Users, Search, Filter, Key, UserCheck, UserX } from "lucide-react";
import { UserTable } from "./components/user-table";
import { UserForm } from "./components/user-form";
import { useAuth } from "@/hooks/use-auth";
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuth } from "firebase/auth";

export interface SystemUser {
  id: string; // email is the id
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

  // 사용자 데이터 로드 함수
  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersSnapshot = await getDocs(collection(db, "users"));
      
      const usersData = await Promise.all(
        usersSnapshot.docs.map(async (doc) => {
          const userData = {
            id: doc.id,
            ...doc.data()
          } as SystemUser;
          
          // 직원 정보에서 직위 가져오기
          try {
            const employeesQuery = query(
              collection(db, "employees"), 
              where("email", "==", userData.email)
            );
            const employeeSnapshot = await getDocs(employeesQuery);
            if (!employeeSnapshot.empty) {
              const employeeData = employeeSnapshot.docs[0].data();
              userData.position = employeeData.position || '직원';
            } else {
              userData.position = '직원'; // 기본값
            }
          } catch (error) {
            console.error("직원 정보 조회 오류:", error);
            userData.position = '직원'; // 오류 시 기본값
          }
          
          return userData;
        })
      );

      // 중복 이메일 체크 및 경고
      const emailCounts = usersData.reduce((acc, user) => {
        acc[user.email] = (acc[user.email] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
      if (duplicates.length > 0) {
        console.warn("중복 이메일 발견:", duplicates);
        toast({
          variant: "destructive",
          title: "데이터 오류",
          description: `중복 이메일이 발견되었습니다: ${duplicates.map(([email]) => email).join(', ')}`
        });
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
      // 본사 관리자는 삭제할 수 없도록 체크
      const userToDelete = users.find(user => user.id === userId);
      if (userToDelete?.role === '본사 관리자') {
        toast({
          variant: "destructive",
          title: "삭제 불가",
          description: "본사 관리자는 삭제할 수 없습니다."
        });
        return;
      }
      
      // 현재 로그인한 사용자 자신을 삭제하려고 하는지 체크
      if (userId === currentUser?.uid) {
        toast({
          variant: "destructive",
          title: "삭제 불가",
          description: "현재 로그인한 계정은 삭제할 수 없습니다."
        });
        return;
      }

      // 1. users 컬렉션에서 삭제
      await deleteDoc(doc(db, "users", userId));
      
      // 2. userRoles 컬렉션에서 비활성화
      const userRolesQuery = query(collection(db, "userRoles"), where("email", "==", userEmail));
      const userRolesSnapshot = await getDocs(userRolesQuery);
      if (!userRolesSnapshot.empty) {
        const userRoleDoc = userRolesSnapshot.docs[0];
        await updateDoc(userRoleDoc.ref, { isActive: false });
      }
      
      // 3. employees 컬렉션에서 삭제
      const employeesQuery = query(collection(db, "employees"), where("email", "==", userEmail));
      const employeesSnapshot = await getDocs(employeesQuery);
      if (!employeesSnapshot.empty) {
        const employeeDoc = employeesSnapshot.docs[0];
        await deleteDoc(employeeDoc.ref);
      }

      toast({
        title: "사용자 삭제 완료",
        description: `${userEmail} 사용자가 삭제되었습니다.`
      });
      
      // 데이터 새로고침
      handleUserUpdated();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: "사용자 삭제 중 오류가 발생했습니다."
      });
    }
  };

  const handlePasswordReset = async (userId: string, userEmail: string) => {
    try {
      const tempPassword = Math.random().toString(36).slice(-8);
      // Firebase Auth에서 비밀번호 재설정 (실제 구현에서는 Firebase Auth API 사용)
      // 여기서는 토스트 메시지만 표시
      toast({
        title: "비밀번호 초기화",
        description: `${userEmail}의 임시 비밀번호가 생성되었습니다: ${tempPassword}`,
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({
        variant: "destructive",
        title: "초기화 실패",
        description: "비밀번호 초기화 중 오류가 발생했습니다."
      });
    }
  };

  const handleToggleUserStatus = async (userId: string, userEmail: string, currentStatus: boolean) => {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        isActive: !currentStatus
      });
      
      // userRoles 컬렉션도 함께 업데이트
      const userRolesQuery = query(collection(db, "userRoles"), where("email", "==", userEmail));
      const userRolesSnapshot = await getDocs(userRolesQuery);
      if (!userRolesSnapshot.empty) {
        const userRoleDoc = userRolesSnapshot.docs[0];
        await updateDoc(userRoleDoc.ref, { isActive: !currentStatus });
      }
      
      toast({
        title: "상태 변경 완료",
        description: `${userEmail} 사용자가 ${!currentStatus ? '활성화' : '비활성화'}되었습니다.`
      });
      
      // 데이터 새로고침
      handleUserUpdated();
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        variant: "destructive",
        title: "상태 변경 실패",
        description: "사용자 상태 변경 중 오류가 발생했습니다."
      });
    }
  };

  if (currentUser?.role !== '본사 관리자') {
    return (
      <div className="flex items-center justify-center h-96 border rounded-md">
        <p className="text-muted-foreground">이 페이지에 접근할 권한이 없습니다.</p>
      </div>
    );
  }

  const activeUsers = users.filter(user => user.isActive !== false).length;
  const inactiveUsers = users.filter(user => user.isActive === false).length;

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
