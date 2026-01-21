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

      if (roleData) {
        let role: '본사 관리자' | '가맹점 관리자' | '직원';
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

        return {
          id: roleData.id,
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role,
          franchise: roleData.branch_name || '', // 미지정이면 빈 문자열
          branchId: roleData.branch_id,
          branchName: roleData.branch_name
        } as UserProfile;
      }

      // 기본값 반환
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: '직원',
        franchise: '' // 기본값 빈 문자열
      } as UserProfile;
    } catch (error) {
      console.error("Error fetching user role from Supabase:", error);
      return {
        id: firebaseUser.uid,
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: '직원',
        franchise: '미정'
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

