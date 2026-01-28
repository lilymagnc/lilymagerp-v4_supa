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
if (typeof window !== 'undefined') {
    try {
        const TARGET_KEY = 'supabase-auth-token';
        // 로컬 스토리지의 모든 키를 검사
        Object.keys(window.localStorage).forEach(key => {
            // Supabase 관련 키패턴이면서, 우리가 현재 사용하는 키가 아닌 경우 삭제
            if ((key.startsWith('sb-') || key.includes('supabase')) && key !== TARGET_KEY) {
                console.log(`[Auth Cleanup] Removing legacy token: ${key}`);
                window.localStorage.removeItem(key);
            }
        });
    } catch (e) {
        console.warn('[Auth Cleanup] Failed to clear legacy storage:', e);
    }
}

// 싱글톤 인스턴스 생성
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true, // 세션 자동 저장 (localStorage)
        autoRefreshToken: true, // 토큰 자동 갱신
        detectSessionInUrl: true,
        storageKey: 'supabase-auth-token', // 명시적인 키 이름 설정 (충돌 방지)
    },
    // 전역적인 에러 처리가 필요하다면 여기서 옵션 추가 가능
});
