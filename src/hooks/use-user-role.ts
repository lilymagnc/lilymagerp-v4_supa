"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
  const { user } = useAuth();

  const mapRowToUserRole = (row: any): UserRole => ({
    id: row.id,
    userId: row.user_id,
    email: row.email,
    role: row.role,
    permissions: row.permissions || [],
    branchId: row.branch_id,
    branchName: row.branch_name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchUserRole = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', user.email)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserRole(mapRowToUserRole(data));
      } else {
        // [Safety] Do NOT create default role automatically in the fetch loop.
        // This causes infinite recursion if creation fails or takes time.
        // Instead, we just require manual creation or a separate flow.
        console.warn("[UserRole] Role not found for user:", user.email);
        toast({ title: '권한 정보 없음', description: '관리자에게 문의하세요.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error fetching user role:', error);
      // toast({ variant: 'destructive', title: '역할 조회 실패', description: '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.id, toast]);

  const createDefaultUserRole = async (email: string, existingRole: string) => {
    try {
      const roleMapping = {
        "본사 관리자": UserRoleType.HQ_MANAGER,
        "가맹점 관리자": UserRoleType.BRANCH_MANAGER,
        "직원": UserRoleType.BRANCH_USER
      };
      const mappedRole = roleMapping[existingRole as keyof typeof roleMapping] || UserRoleType.BRANCH_USER;

      const { data: userData } = await supabase.from('users').select('franchise').eq('email', email).maybeSingle();
      const branchName = userData?.franchise || user?.franchise || "본사";

      await createUserRole({
        userId: user?.id || email,
        email: email,
        role: mappedRole,
        branchName: branchName,
      });
    } catch (error) {
      console.error('Error creating default role:', error);
    }
  };

  const createUserRole = async (roleData: CreateUserRoleData): Promise<string> => {
    try {
      const permissions = ROLE_PERMISSIONS[roleData.role];
      if (!permissions) throw new Error(`Permissions not found for: ${roleData.role}`);

      const id = crypto.randomUUID();
      const payload = {
        id,
        user_id: roleData.userId,
        email: roleData.email,
        role: roleData.role,
        permissions: permissions,
        branch_id: roleData.branchId,
        branch_name: roleData.branchName,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('user_roles').insert([payload]);
      if (error) throw error;

      if (roleData.email === user?.email) {
        setUserRole(mapRowToUserRole(payload));
      }

      toast({ title: '역할 생성 완료', description: '성공적으로 생성되었습니다.' });
      return id;
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '역할 생성 실패', description: '오류 발생' });
      throw error;
    }
  };

  const updateUserRole = async (roleId: string, updates: Partial<Pick<UserRole, 'role' | 'branchId' | 'branchName' | 'permissions' | 'isActive'>>): Promise<void> => {
    try {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (updates.role !== undefined) updatePayload.role = updates.role;
      if (updates.branchId !== undefined) updatePayload.branch_id = updates.branchId;
      if (updates.branchName !== undefined) updatePayload.branch_name = updates.branchName;
      if (updates.permissions !== undefined) updatePayload.permissions = updates.permissions;
      if (updates.isActive !== undefined) updatePayload.is_active = updates.isActive;

      const { error } = await supabase.from('user_roles').update(updatePayload).eq('id', roleId);
      if (error) throw error;

      if (userRole && userRole.id === roleId) {
        setUserRole({ ...userRole, ...updates, updatedAt: new Date().toISOString() as any });
      }
      toast({ title: '역할 업데이트 완료', description: '성공적으로 업데이트되었습니다.' });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: '업데이트 실패', description: '오류 발생' });
      throw error;
    }
  };

  const hasPermission = (permission: Permission): boolean => {
    if (!userRole || !userRole.isActive) return false;
    return userRole.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!userRole || !userRole.isActive) return false;
    return permissions.some(permission => userRole.permissions.includes(permission));
  };

  const isHQManager = (): boolean => {
    return (
      (userRole?.role === 'hq_manager' && userRole.isActive) ||
      (userRole?.role === 'admin' && userRole.isActive) ||
      user?.role === '본사 관리자'
    );
  };

  const isBranchUser = (): boolean => userRole?.role === 'branch_user' && userRole.isActive;
  const isBranchManager = (): boolean => userRole?.role === 'branch_manager' && userRole.isActive;
  const isAdmin = (): boolean => userRole?.role === 'admin' && userRole.isActive;
  const isHeadOfficeAdmin = (): boolean => isHQManager();

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  return {
    userRole, loading, fetchUserRole, createUserRole, updateUserRole, hasPermission, hasAnyPermission, isHQManager, isBranchUser, isBranchManager, isAdmin, isHeadOfficeAdmin,
  };
}
