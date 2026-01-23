import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

// Vercel 빌드 시 에러를 방지하기 위해 URL이 없을 경우 placeholder를 사용합니다.
// 실제 런타임에서는 .env 또는 Vercel 설정의 값이 사용됩니다.
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
);

