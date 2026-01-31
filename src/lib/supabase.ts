import { createClient } from '@supabase/supabase-js';

// 환경 변수 가져오기 및 검증
const getSupabaseConfig = () => {
    // 1. URL
    const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    // http로 시작하지 않으면(빈 문자열 포함) 기본값이나 에러 처리
    const supabaseUrl = rawUrl.startsWith('http')
        ? rawUrl
        : 'https://xphvycuaffifjgjaiqxe.supabase.co';

    // 2. Key
    const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    // 키가 없으면 더미 키라도 넣어서 크래시 방지 (단, 실제 요청은 실패함)
    const supabaseKey = rawKey || 'dummy-key';

    return { supabaseUrl, supabaseKey };
};

const { supabaseUrl, supabaseKey } = getSupabaseConfig();

// [강제 청소 로직] 앱 초기화 시 레거시/충돌 토큰 제거
// 이 로직은 브라우저 환경에서만 실행됩니다.
// [수정] 무한 로딩 원인 제거: Supabase Client가 관리하는 스토리지를 수동으로 비우면
// 새로고침 시 세션을 잃어버리는 문제가 발생하므로 해당 로직을 제거합니다.
if (typeof window !== 'undefined') {
    // Legacy cleanup removed to prevent race conditions
}

// 싱글톤 인스턴스 생성
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true, // 세션 자동 저장 (localStorage)
        autoRefreshToken: true, // 토큰 자동 갱신
        detectSessionInUrl: true,
        // storageKey: 'supabase-auth-token', // 기본값 사용 (sb-[project-id]-auth-token) to fix reload persistence
    },
    // 전역적인 에러 처리가 필요하다면 여기서 옵션 추가 가능
});
