import { createClient } from '@supabase/supabase-js';

// v4-supa-fix-v3: Extreme defensive check for Vercel build
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isValid = (val: string | undefined): val is string => {
    return !!val && val !== 'undefined' && val !== 'null' && val.length > 0;
};

if (!isValid(rawUrl) || !isValid(rawKey)) {
    console.warn('⚠️ [v4-supa-v3] Supabase 환경 변수가 누락되었습니다. 빌드를 위해 임시 값을 사용합니다.');
}

export const supabase = createClient(
    isValid(rawUrl) ? rawUrl : 'https://placeholder.supabase.co',
    isValid(rawKey) ? rawKey : 'placeholder'
);


