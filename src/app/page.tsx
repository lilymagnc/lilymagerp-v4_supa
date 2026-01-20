
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, loading } = useAuth();
  const { userRole, loading: roleLoading, isHQManager } = useUserRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !roleLoading) {
      if (user) {
        // 모든 사용자를 대시보드로 리다이렉트
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, roleLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
