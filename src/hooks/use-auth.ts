
"use client";
import { useContext } from 'react';
import { AuthContext } from '@/context/auth-context';
import type { UserProfile as UserProfileType } from '@/context/auth-context';
// To avoid naming conflicts with the re-exported type
export interface UserProfile extends UserProfileType {}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
