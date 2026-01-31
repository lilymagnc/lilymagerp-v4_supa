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
        // 조용히 넘어감 (기본 권한으로 앱 사용 가능)
        console.log("User role fetch delayed, using default permissions.");
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

    // 1. LocalStorage 토큰 확인 (무한 로딩 방지의 핵심)
    // Supabase가 세션을 복구하기 전에, 로컬 스토리지에 토큰이 있는지 먼저 확인합니다.
    // 토큰이 아예 없다면 -> 기다릴 필요 없이 즉시 로딩 끝 (로그인 페이지로)
    // 토큰이 있다면 -> Supabase가 처리할 때까지 기다림 (단, 10초 이상 걸리면 타임아웃)
    const checkLocalToken = () => {
      if (typeof window === 'undefined') return false;
      // Supabase default key pattern: sb-<project-ref>-auth-token
      // 또는 우리가 이전에 썼던 'supabase-auth-token'
      // 모든 키를 뒤져서 'sb-'로 시작하거나 'supabase'가 들어간 키가 있는지 확인
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            return true;
          }
        }
      } catch (e) {
        console.warn("LocalStorage access failed:", e);
      }
      return false;
    };

    const hasToken = checkLocalToken();

    if (!hasToken) {
      console.log("[Auth] No local token found. Immediate sign-out state.");
      setLoading(false);
      // 토큰이 없으므로 initSession이나 리스너를 기다릴 필요가 없음
      return;
    }

    // 2. 초기 세션 확인 (Timeout Protected)
    const initSession = async () => {
      try {
        console.log("[Auth] Checking initial session (Token detected)...");
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session init timeout')), 2000)
        );

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (error) throw error;
        if (mounted && session) {
          await handleSession(session);
        }
      } catch (error) {
        // [Silent Failover] 타임아웃/에러 발생 시 조용히 이벤트 리스너(onAuthStateChange)로 위임
        // v3와 동일하게 사용자는 에러를 느끼지 못하고 자연스럽게 로그인됩니다.
        console.log("[Auth] Switch to event listener mode (Session init delayed)", error instanceof Error ? error.message : "");
      }
    };

    initSession();

    // 3. Auth 상태 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log(`[Auth] Auth state changed: ${_event}`, session?.user?.email);
      if (mounted) {
        await handleSession(session);
      }
    });

    // [Safety] 토큰은 있는데 Supabase가 10초 동안 아무 반응이 없으면 그때서야 포기
    // 3초는 너무 짧아서 네트워크 지연 시 로그아웃됨. 10초로 늘림.
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        // [Silent Recovery] 10초가 지나도 로딩 중이라면 조용히 로딩을 끝내고 화면을 보여줍니다.
        setLoading(false);
      }
    }, 10000);

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
