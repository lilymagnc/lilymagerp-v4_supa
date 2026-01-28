"use client";

import { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export interface UserProfile {
  id: string; // Supabase UID
  email?: string;
  role?: '본사 관리자' | '가맹점 관리자' | '직원';
  franchise?: string;
  branchId?: string;
  branchName?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => { }
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (email: string, userId: string) => {
    try {
      // 1. user_roles 테이블에서 사용자 역할 확인
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .maybeSingle();

      const roleData = data as any;
      let role: '본사 관리자' | '가맹점 관리자' | '직원' = '직원';

      if (roleData) {
        switch (roleData.role) {
          case 'hq_manager':
          case 'admin':
            role = '본사 관리자';
            break;
          case 'branch_manager':
            role = '가맹점 관리자';
            break;
          case 'branch_user':
          default:
            role = '직원';
        }
      }

      // 특정 관리자 이메일 강제 권한 부여 (임시 해결책)
      const lowerEmail = email.toLowerCase();
      if (lowerEmail === 'lilymag0301@gmail.com') {
        role = '본사 관리자';
      }

      return {
        id: userId,
        email: email,
        role,
        franchise: roleData?.branch_name || (role === '본사 관리자' ? '본사' : ''),
        branchId: roleData?.branch_id,
        branchName: roleData?.branch_name
      } as UserProfile;

    } catch (error) {
      console.error("Error fetching user role from Supabase:", error);
      return {
        id: userId,
        email: email,
        role: '직원',
        franchise: '미정'
      } as UserProfile;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Session init error:", error);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          const userWithRole = await fetchUserRole(session.user.email!, session.user.id);
          if (mounted) setUser(userWithRole);
        } else {
          if (mounted) setUser(null);
        }
      } catch (err) {
        console.error("Unexpected auth error:", err);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // console.log("Auth state change:", event); // 디버깅용 로그

      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      if (session?.user) {
        // 토큰 갱신 등의 이벤트에서는 굳이 다시 DB를 조회할 필요가 없을 수도 있으나,
        // 역할 변경 등을 감지하기 위해 조회하되, 현재 상태와 비교하여 불필요한 업데이트 방지
        const userWithRole = await fetchUserRole(session.user.email!, session.user.id);

        if (mounted) {
          setUser((prev) => {
            // 깊은 비교를 통해 불필요한 리렌더링 방지
            if (prev &&
              prev.id === userWithRole.id &&
              prev.role === userWithRole.role &&
              prev.branchId === userWithRole.branchId &&
              prev.franchise === userWithRole.franchise) {
              return prev;
            }
            return userWithRole;
          });
          setLoading(false);
        }
      } else {
        // 세션이 없는 경우 (초기 로딩 제외)
        if (mounted && event !== 'INITIAL_SESSION') {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
