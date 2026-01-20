"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function BackupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const current = new URLSearchParams(searchParams as any);
    current.set("tab", "backup");
    const qs = current.toString();
    router.replace(`/dashboard/settings${qs ? `?${qs}` : ""}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p>백업 관리 페이지가 시스템 설정으로 이동되었습니다. 이동 중...</p>
      </div>
    </div>
  );
}
