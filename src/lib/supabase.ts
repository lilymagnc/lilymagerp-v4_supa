import { createClient } from '@supabase/supabase-js';

// v4-supa-lazy-load: 빌드 타임의 URL 유효성 검사를 완전히 우회하기 위해 지연 초기화(Lazy Init) 방식을 사용합니다.
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
    get(_, prop) {
        if (!supabaseInstance) {
            const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() || 'https://xphvycuaffifjgjaiqxe.supabase.co';
            const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim() || 'dummy-key';

            supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
        }
        return (supabaseInstance as any)[prop];
    }
});




