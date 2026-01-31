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

    // 1. 초기 세션 확인 (Timeout Protected)
    // onAuthStateChange가 놓칠 수 있는 초기 상태를 확인하되, getSession이 멈추는 것을 방지하기 위해 2초 타임아웃 적용
    const initSession = async () => {
      try {
        console.log("[Auth] Checking initial session...");
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session init timeout')), 2000)
        );

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (error) throw error;
        if (mounted && session) { // 세션이 있을 때만 처리 (없으면 onAuthStateChange가 SIGNED_OUT 처리 or fallback)
          await handleSession(session);
        }
      } catch (error) {
        console.warn("[Auth] Initial session check failed or timed out (using listener instead):", error);
        // 여기서 로딩을 끄지 않습니다. onAuthStateChange가 곧 처리하거나, 아래 Safety Timer가 처리합니다.
      }
    };

    initSession();

    // 2. Auth 상태 변경 감지
    // Supabase의 onAuthStateChange는 구독 시 현재 세션 정보를 즉시 반환(INITIAL_SESSION)하므로
    // 별도의 getSession() 호출 없이도 초기화가 가능합니다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[Auth] Auth state changed: ${_event}`, session?.user?.email);
      if (mounted) {
        await handleSession(session);
      }
    });

    // [Safety] 만약 위 두 가지 방법이 모두 실패하여 로딩이 3초 이상 지속되면 강제 종료 (최후의 보루)
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("[Auth] Safety timeout triggered. Releasing loading state.");
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
