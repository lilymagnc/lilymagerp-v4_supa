"use client";

import { createContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

export interface UserProfile {
  id: string;
  uid: string; // Firebase UID
  email?: string;
  role?: '본사 관리자' | '가맹점 관리자' | '직원';
  franchise?: string;
  branchId?: string;
  branchName?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserRole = useCallback(async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser.email) return null;

    try {
      // user_roles 테이블에서 사용자 역할 확인
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', firebaseUser.email)
        .eq('is_active', true)
        .maybeSingle();

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
      const email = firebaseUser.email.toLowerCase();
      if (email === 'lilymag0301@gmail.com' || email === 'lilymagg01@gmail.com') {
        role = '본사 관리자';
      }

      return {
        id: roleData?.id || firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role,
        franchise: roleData?.branch_name || (role === '본사 관리자' ? '본사' : ''),
        branchId: roleData?.branch_id,
        branchName: roleData?.branch_name
      } as UserProfile;

    } catch (error) {
      console.error("Error fetching user role from Supabase:", error);

      // 오류 발생 시에도 특정 이메일은 관리자로 처리
      const isSpecialAdmin = firebaseUser.email.toLowerCase() === 'lilymag0301@gmail.com' || firebaseUser.email.toLowerCase() === 'lilymagg01@gmail.com';

      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: isSpecialAdmin ? '본사 관리자' : '직원',
        franchise: isSpecialAdmin ? '본사' : '미정'
      } as UserProfile;
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userWithRole = await fetchUserRole(firebaseUser);
        setUser(userWithRole);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserRole]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
