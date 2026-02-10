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
      // Failed to save auth to storage - non-critical
    }
  };

  // 로컬 스토리지에서 유저 정보 삭제
  const clearUserFromStorage = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // Failed to clear auth storage - non-critical
    }
  };

  // 실제 DB에서 역할 가져오기 (타임아웃 안전장치 포함) - 에러 시 null 반환
  const fetchUserRole = useCallback(async (email: string, userId: string): Promise<UserProfile | null> => {
    try {
      // 3. Robust Retry Logic for All Users (Universal Reliability)
      // Retry up to 3 times with increasing backoff (1s, 2s, 4s)
      let roleData = null;
      let attempts = 0;
      while (attempts < 3 && !roleData) {
        try {
          // Re-create timeout promise for each attempt
          const currentTimeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Role fetch timeout')), 5000 + (attempts * 2000))
          );

          const { data, error } = await Promise.race([
            supabase.from('user_roles').select('*').eq('email', email).maybeSingle(),
            currentTimeout
          ]) as any;

          if (!error) {
            roleData = data;
            break; // Success
          } else {
            // Auth retry - silent
          }
        } catch (e) {
          // Auth retry timeout - silent
        }
        attempts++;
        if (!roleData && attempts < 3) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempts)));
      }

      // 4. Role Assignment
      let role: '본사 관리자' | '가맹점 관리자' | '직원' = '직원';
      let franchise = '미정';
      let branchId = undefined;
      let branchName = undefined;

      // Master Admin Bypass (The Ultimate Truth)
      if (email.toLowerCase() === 'lilymag0301@gmail.com') {
        role = '본사 관리자';
        franchise = '본사';
      } else if (roleData) {
        // Normal User Processing
        switch (roleData.role) {
          case 'hq_manager':
          case 'admin':
            role = '본사 관리자';
            franchise = '본사';
            break;
          case 'branch_manager':
            role = '가맹점 관리자';
            franchise = roleData.branch_name;
            break;
          case 'branch_user':
          default:
            role = '직원';
            franchise = roleData.branch_name;
        }
        branchId = roleData.branch_id;
        branchName = roleData.branch_name;
      } else {
        // DB Failed AND not Master Admin -> Throw to keep loading state
        throw new Error("User role not found and not a master admin.");
      }

      const newUser: UserProfile = {
        id: userId,
        email: email,
        role,
        franchise,
        branchId,
        branchName
      };

      return newUser;

    } catch (error) {
      // Fatal role fetch error - handled gracefully by returning null
      // Do NOT throw error to prevent unhandled promise rejection. Return null instead.
      return null;
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
    try {
      const freshUser = await fetchUserRole(session.user.email, session.user.id);

      if (!freshUser) {
        throw new Error("Failed to fetch fresh user role");
      }

      // 조회된 정보가 "직원/미정" (에러상태) 인데, 기존에 이미 "관리자" 정보가 짱짱하게 있다면 굳이 덮어쓰지 않음 (안전장치)
      setUser(prev => {
        // [Universal Safety] If new data implies downgrade to 'Unknown' due to some error, keep old data
        if (freshUser.franchise === '미정' && prev?.franchise && prev.franchise !== '미정' && prev.email === freshUser.email) {
          // Keeping previous valid data (new data is 'Unknown')
          return prev;
        }
        return freshUser;
      });

      saveUserToStorage(freshUser);
    } catch (error) {
      // Background fetch failed - using cached data if available
      // If we have no user at all (first load, no cache), THEN we might need to show error
      // But if we loaded from cache, we just stay there.
      setUser(prev => {
        if (!prev) throw error; // No cache, no DB -> Real Error
        return prev; // Keep cache
      });
    } finally {
      setLoading(false);
    }
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
          // Cache parse error - non-critical
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
      // Sign out error - silent
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
