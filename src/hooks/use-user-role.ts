"use client";
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';
import { 
  UserRole, 
  UserRoleType, 
  Permission, 
  CreateUserRoleData,
  ROLE_PERMISSIONS 
} from '@/types/user-role';

export function useUserRole() {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth(); // 실제 로그인한 사용자 정보 가져오기

  // 사용자 역할 조회
  const fetchUserRole = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // 1. 먼저 users 컬렉션에서 사용자 정보 확인
      const userDocRef = doc(db, 'users', user.email);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();

      // 2. userRoles 컬렉션에서 역할 정보 확인
      const q = query(
        collection(db, 'userRoles'),
        where('email', '==', user.email),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const roleDoc = querySnapshot.docs[0];
        const roleData = roleDoc.data();
        
        // 권한과 소속은 별개로 처리 - 본사 관리자도 특정 지점에 소속될 수 있음

        const role: UserRole = {
          id: roleDoc.id,
          ...roleData,
          createdAt: roleData.createdAt,
          updatedAt: roleData.updatedAt,
        } as UserRole;
        setUserRole(role);
      } else {
        // userRoles에 없으면 users 컬렉션의 role을 기반으로 생성
        await createDefaultUserRole(user.email, userData.role);
      }
    } catch (error) {
      console.error('사용자 역할 조회 오류:', error);
      toast({
        variant: 'destructive',
        title: '역할 조회 실패',
        description: '사용자 역할을 조회하는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // 기본 사용자 역할 생성 (기존 인증 시스템 역할 기반)
  const createDefaultUserRole = async (email: string, existingRole: string) => {
    try {
      // 기존 역할을 새로운 시스템에 맞게 매핑
      const roleMapping = {
        "본사 관리자": UserRoleType.HQ_MANAGER,
        "가맹점 관리자": UserRoleType.BRANCH_MANAGER, 
        "직원": UserRoleType.BRANCH_USER
      };
      
      const mappedRole = roleMapping[existingRole as keyof typeof roleMapping] || UserRoleType.BRANCH_USER;
      
      // 권한 확인
      const permissions = ROLE_PERMISSIONS[mappedRole];
      if (!permissions) {
        console.error('권한을 찾을 수 없음:', mappedRole);
        return;
      }

      // 사용자의 실제 franchise 정보 가져오기
      const userDocRef = doc(db, 'users', email);
      const userDoc = await getDoc(userDocRef);
      let branchName = "본사"; // 기본값
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // 소속은 실제 franchise 사용 (권한과 별개)
        branchName = userData.franchise || "본사";
      }

      const defaultRoleData: CreateUserRoleData = {
        userId: email,
        email: email,
        role: mappedRole,
        branchName: branchName,
      };
      
      await createUserRole(defaultRoleData);
    } catch (error) {
      console.error('기본 역할 생성 오류:', error);
    }
  };

  // 사용자 역할 생성
  const createUserRole = async (roleData: CreateUserRoleData): Promise<string> => {
    try {
      const now = serverTimestamp();
      
      // 권한 확인
      const permissions = ROLE_PERMISSIONS[roleData.role];
      if (!permissions) {
        console.error('권한을 찾을 수 없음:', roleData.role);
        throw new Error(`권한을 찾을 수 없음: ${roleData.role}`);
      }

      const userRoleDoc: any = {
        userId: roleData.userId,
        email: roleData.email,
        role: roleData.role,
        permissions: permissions,
        createdAt: now as any,
        updatedAt: now as any,
        isActive: true
      };

      // branchId와 branchName이 있는 경우에만 추가 (undefined 방지)
      if (roleData.branchId) {
        userRoleDoc.branchId = roleData.branchId;
      }
      if (roleData.branchName) {
        userRoleDoc.branchName = roleData.branchName;
      }

      const docRef = doc(collection(db, 'userRoles'));
      await setDoc(docRef, userRoleDoc);

      // 현재 사용자의 역할을 생성한 경우 상태 업데이트
      if (roleData.email === user?.email) {
        setUserRole({
          id: docRef.id,
          ...userRoleDoc,
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        });
      }

      toast({
        title: '역할 생성 완료',
        description: '사용자 역할이 성공적으로 생성되었습니다.',
      });
      
      return docRef.id;
    } catch (error) {
      console.error('사용자 역할 생성 오류:', error);
      toast({
        variant: 'destructive',
        title: '역할 생성 실패',
        description: '사용자 역할 생성 중 오류가 발생했습니다.',
      });
      throw error;
    }
  };

  // 사용자 역할 업데이트
  const updateUserRole = async (
    roleId: string, 
    updates: Partial<Pick<UserRole, 'role' | 'branchId' | 'branchName' | 'permissions' | 'isActive'>>
  ): Promise<void> => {
    try {
      const docRef = doc(db, 'userRoles', roleId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(docRef, updateData, { merge: true });
      
      // 현재 사용자의 역할을 업데이트한 경우 상태 업데이트
      if (userRole && userRole.id === roleId) {
        setUserRole({
          ...userRole,
          ...updates,
          updatedAt: new Date() as any,
        });
      }
      
      toast({
        title: '역할 업데이트 완료',
        description: '사용자 역할이 성공적으로 업데이트되었습니다.',
      });
    } catch (error) {
      console.error('사용자 역할 업데이트 오류:', error);
      toast({
        variant: 'destructive',
        title: '역할 업데이트 실패',
        description: '사용자 역할 업데이트 중 오류가 발생했습니다.',
      });
      throw error;
    }
  };

  // 권한 확인 함수들
  const hasPermission = (permission: Permission): boolean => {
    if (!userRole || !userRole.isActive) return false;
    return userRole.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!userRole || !userRole.isActive) return false;
    return permissions.some(permission => userRole.permissions.includes(permission));
  };

  // 본사 관리자 권한 확인 (hq_manager 또는 admin, 또는 기존 시스템의 본사 관리자)
  // 권한은 소속과 상관없이 작동
  const isHQManager = (): boolean => {
    return (
      (userRole?.role === 'hq_manager' && userRole.isActive) ||
      (userRole?.role === 'admin' && userRole.isActive) ||
      user?.role === '본사 관리자'
    );
  };

  const isBranchUser = (): boolean => {
    return userRole?.role === 'branch_user' && userRole.isActive;
  };

  const isBranchManager = (): boolean => {
    return userRole?.role === 'branch_manager' && userRole.isActive;
  };

  const isAdmin = (): boolean => {
    return userRole?.role === 'admin' && userRole.isActive;
  };
  
  // 본사 관리자 권한 확인 (hq_manager 또는 admin)
  // 권한은 소속과 상관없이 작동
  const isHeadOfficeAdmin = (): boolean => {
    return (
      (userRole?.role === 'hq_manager' && userRole.isActive) ||
      (userRole?.role === 'admin' && userRole.isActive) ||
      user?.role === '본사 관리자'
    );
  };

  // 컴포넌트 마운트 시 사용자 역할 조회
  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  return {
    userRole,
    loading,
    fetchUserRole,
    createUserRole,
    updateUserRole,
    hasPermission,
    hasAnyPermission,
    isHQManager,
    isBranchUser,
    isBranchManager,
    isAdmin,
    isHeadOfficeAdmin,
  };
}
