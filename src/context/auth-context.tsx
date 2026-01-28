"use client";

import { createContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
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

  // useRef를 사용하여 useEffect 의존성 루프 없이 최신 user 상태 추적
  const userRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let mounted = true;

    // 1. Get initial session
    const initializeAuth = async () => {
      try {
        // [복구 로직] 저장된 세션이 유효한지 적극적으로 확인
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
          // 세션이 없다면 바로 포기하지 않고 1회 재시도 (localStorage 이슈 방지)
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

    // [활성 상태 감지] 사용자가 탭으로 돌아왔을 때 세션 재검증 (Heartbeat)
    const handleFocus = async () => {
      if (!mounted) return;

      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = userRef.current; // Ref에서 최신 상태 읽기

      if (session?.user) {
        // 현재 상태가 없거나(메모리 소실), 정보가 다르면 복구
        if (!currentUser || currentUser.id !== session.user.id) {
          console.log("Recovering session on window focus...");
          const userWithRole = await fetchUserRole(session.user.email!, session.user.id);
          if (mounted) setUser(userWithRole);
        }
      } else {
        // 세션이 만료된 상태라면 로그아웃 처리
        if (currentUser && mounted) {
          console.log("Session expired on focus, signing out...");
          setUser(null);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      // 토큰 갱신 등 기타 이벤트
      if (session?.user) {
        // 불필요한 DB 호출 최소화: 이미 유저 정보가 있고 토큰만 바뀐 경우 스킵 가능하나,
        // 안전을 위해 ID 비교 후 업데이트
        if (mounted) {
          const currentUser = userRef.current; // Ref에서 최신 상태 읽기

          // 현재 유저 정보가 없으면 바로 가져오기
          if (!currentUser) {
            const userWithRole = await fetchUserRole(session.user.email!, session.user.id);
            setUser(userWithRole);
          } else {
            // 이미 있는데 토큰만 갱신된거면 패스 (DB 부하 감소)
            // 단, 역할 변경 등을 실시간 반영하려면 여기서도 fetchUserRole 필요
          }
          setLoading(false);
        }
      } else {
        if (mounted && event !== 'INITIAL_SESSION') {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      subscription.unsubscribe();
    };
  }, [fetchUserRole]); // user 의존성 제거됨

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
