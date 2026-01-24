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
    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userWithRole = await fetchUserRole(session.user.email!, session.user.id);
          setUser(userWithRole);
        }
      } catch (err) {
        console.error("Session error:", err);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userWithRole = await fetchUserRole(session.user.email!, session.user.id);
        setUser(userWithRole);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
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
