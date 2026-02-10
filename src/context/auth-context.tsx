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

const STORAGE_KEY = 'lilymag_auth_user_v1';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // 로컬 스토리지에 유저 정보 저장 (캐싱)
  const saveUserToStorage = (userData: UserProfile) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      }
    } catch (e) {
      console.warn("Failed to save auth to storage:", e);
    }
  };

  // 로컬 스토리지에서 유저 정보 삭제
  const clearUserFromStorage = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.warn("Failed to clear auth storage:", e);
    }
  };

  // 실제 DB에서 역할 가져오기 (타임아웃 안전장치 포함)
  const fetchUserRole = useCallback(async (email: string, userId: string): Promise<UserProfile> => {
    try {
      // 1. user_roles 테이블 조회
      const fetchPromise = supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      // 10초 타임아웃 (Supabase 인스턴스 기동 지연 고려)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Role fetch timeout')), 10000)
      );

      // 경주 시작
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) throw error;

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

      // 하드코딩된 슈퍼 관리자
      if (email.toLowerCase() === 'lilymag0301@gmail.com') {
        role = '본사 관리자';
      }

      const newUser: UserProfile = {
        id: userId,
        email: email,
        role,
        franchise: roleData?.branch_name || (role === '본사 관리자' ? '본사' : ''),
        branchId: roleData?.branch_id,
        branchName: roleData?.branch_name
      };

      return newUser;

    } catch (error) {
      console.warn("[Auth] Background role fetch failed/timed out. Falling back to email check.", error);

      // 에러 발생 시에는 이메일 기반 권한 판정이 최우선으로 된다.
      const role = email.toLowerCase() === 'lilymag0301@gmail.com' ? '본사 관리자' : '직원';

      return {
        id: userId,
        email: email,
        role: role as any,
        franchise: role === '본사 관리자' ? '본사' : '미정'
      };
    }
  }, []);

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session?.user?.email) {
      setUser(null);
      clearUserFromStorage();
      setLoading(false);
      return;
    }

    // 1. 이미 캐시된 유저가 있고, 이메일이 같다면 일단 그거 씀 (Fast Rendering)
    // (상태가 이미 있으면 굳이 로딩 상태로 안 바꿈 -> 깜빡임 제거)

    // 2. 백그라운드에서 최신 정보 조회 (Background Sync)
    // 사용자는 이미 화면을 보고 있고, 뒤에서 조회가 끝나면 쓱 업데이트 됨.
    const freshUser = await fetchUserRole(session.user.email, session.user.id);

    // 조회된 정보가 "직원/미정" (에러상태) 인데, 기존에 이미 "관리자" 정보가 짱짱하게 있다면 굳이 덮어쓰지 않음 (안전장치)
    setUser(prev => {
      // 이전 데이터가 더 좋은 데이터(관리자)라면 에러난 데이터로 덮어쓰지 말자.
      if (freshUser.role === '직원' && prev?.role === '본사 관리자' && prev.email === freshUser.email) {
        return prev;
      }
      return freshUser;
    });

    saveUserToStorage(freshUser);
    setLoading(false);
  }, [fetchUserRole]);


  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      // 0. 로컬 스토리지 우선 확인 (Zero Delay)
      if (typeof window !== 'undefined') {
        try {
          const cachedJson = localStorage.getItem(STORAGE_KEY);
          if (cachedJson) {
            const cachedUser = JSON.parse(cachedJson);
            if (cachedUser && cachedUser.email) {
              setUser(cachedUser);
              setLoading(false); // 로딩 즉시 해제!
            }
          }
        } catch (e) {
          console.warn("[Auth] Cache parse error", e);
        }
      }

      // 1. Supabase Session 확인
      const { data: { session } } = await supabase.auth.getSession();

      if (mounted) {
        if (session) {
          // 세션이 있으면 검증 및 업데이트 수행
          await handleSession(session);
        } else {
          // 세션이 없으면 로그아웃 처리
          setUser(null);
          clearUserFromStorage();
          setLoading(false);
        }
      }

      // 2. Auth 변경 리스너
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          clearUserFromStorage();
          setLoading(false);
        } else if (session) {
          await handleSession(session);
        }
      });

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    };

    initializeAuth();
  }, [handleSession]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setUser(null);
      clearUserFromStorage();
      setLoading(false);
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
