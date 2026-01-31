"use client";

import { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';

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

  const fetchUserRole = useCallback(async (email: string, userId: string): Promise<UserProfile> => {
    try {
      // 1. user_roles 테이블에서 사용자 역할 확인
      // [Safety] DB 쿼리가 5초 이상 걸리면 기본 권한으로 진행 (무한 로딩 방지)
      const fetchPromise = supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Role fetch timeout')), 5000)
      );

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.error("Error fetching user role:", error);
      }

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

      // 특정 관리자 이메일 강제 권한 부여 (임시 해결책 유지)
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
      };

    } catch (error) {
      console.error("Unexpected error fetching user role:", error);
      // 에러 발생 시에도 최소한의 유저 정보는 리턴하여 로그인 상태 유지는 보장
      return {
        id: userId,
        email: email,
        role: '직원',
        franchise: '미정'
      };
    }
  }, []);

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userWithRole = await fetchUserRole(session.user.email!, session.user.id);
      setUser(userWithRole);
    } catch (error) {
      console.error("Error checking user session:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchUserRole]);

  useEffect(() => {
    let mounted = true;

    // 2. Auth 상태 변경 감지 (가장 중요)
    // Supabase의 onAuthStateChange는 구독 시 현재 세션 정보를 즉시 반환(INITIAL_SESSION)하므로
    // 별도의 getSession() 호출 없이도 초기화가 가능합니다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[Auth] Auth state changed: ${_event}`, session?.user?.email);
      if (mounted) {
        await handleSession(session);
      }
    });

    // [Safety] 만약 onAuthStateChange가 어떤 이유로든 3초 내에 발동하지 않으면 로딩 종료
    // (네트워크 이슈 등으로 이벤트가 누락되는 경우 대비)
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[Auth] Event listener timeout. Force releasing loading state (Guest).");
        setLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setUser(null);
      setLoading(false); // 확실하게 로딩 해제
    }
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
