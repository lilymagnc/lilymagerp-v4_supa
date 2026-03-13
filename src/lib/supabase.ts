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

// 디버깅을 위한 로그 (브라우저 콘솔에서 확인 가능)
if (typeof window !== 'undefined') {
    console.log('[Supabase Init] URL:', supabaseUrl);
    console.log('[Supabase Init] Key Length:', supabaseKey?.length);
    if (supabaseKey === 'dummy-key') {
        console.warn('[Supabase Init] Warning: Using dummy-key. Auth will not work.');
    }
}

// 글로벌 Fetch 인터셉터를 통한 완벽한 401/토큰 만료 방어막
const customFetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    try {
        const res = await fetch(url, options);

        // Auth Token이 만료되어 401 Unauthorized가 떨어졌는지 감지
        if (res.status === 401 && typeof window !== 'undefined') {
            const urlStr = url.toString();
            // 로그인/토큰발급 경로는 제외 (무한루프 방지)
            if (!urlStr.includes('/auth/v1/token')) {
                try {
                    const clone = res.clone();
                    const json = await clone.json();

                    if (json?.code === 'PGRST301' || json?.message?.includes('JWT') || json?.message?.includes('expired')) {
                        console.error('[Supabase Auto-Interceptor] JWT Expired or Unauthorized!', json);
                        // 즉시 브라우저 로컬 스토리지 데이터 파기 후 강제 이동
                        localStorage.removeItem('sb-xphvycuaffifjgjaiqxe-auth-token');
                        localStorage.removeItem('lilymag_auth_user_v1');
                        window.location.href = '/login';
                    }
                } catch (e) {
                    // json 파싱 오류 시 무시
                }
            }
        }
        return res;
    } catch (error: any) {
        // AbortError 등 처리
        if (error.name === 'AbortError') {
            console.warn('[Supabase Fetch] Request aborted:', url);
        } else {
            console.error('[Supabase Fetch] Global error:', error);
        }
        throw error;
    }
};

// 싱글톤 인스턴스 생성
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true, // 세션 자동 저장 (localStorage)
        autoRefreshToken: true, // 토큰 자동 갱신
        detectSessionInUrl: true,
        storageKey: 'sb-xphvycuaffifjgjaiqxe-auth-token', // 명시적 키 지정
    },
    global: {
        fetch: customFetch
    }
});
