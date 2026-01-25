import { createClient } from '@supabase/supabase-js';

// v4-supa-debug-v1: 환경 변수 문제를 진단하기 위한 디버그 로그와 로직 보강
let supabaseInstance: any = null;

export const supabase = new Proxy({} as any, {
    get(_, prop) {
        if (!supabaseInstance) {
            const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
            const rawKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

            // 실제 주소인지 검증 (http로 시작해야 함)
            const isActualUrl = rawUrl.startsWith('http');
            const finalUrl = isActualUrl ? rawUrl : 'https://xphvycuaffifjgjaiqxe.supabase.co';
            const finalKey = rawKey || 'dummy-key';

            // 보안을 위해 앞부분만 로그에 노출
            if (typeof window !== 'undefined') {
                console.log(`[Supabase Init] URL: ${finalUrl.substring(0, 15)}... (isActual: ${isActualUrl})`);
            }

            supabaseInstance = createClient(finalUrl, finalKey);
        }
        return (supabaseInstance as any)[prop];
    }
});





