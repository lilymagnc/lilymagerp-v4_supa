import { createClient } from '@supabase/supabase-js';

// v4-supa-final-fix: Ensure build passes by providing a valid URL format even if env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xphvycuaffifjgjaiqxe.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key-for-build';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.warn('⚠️ [v4-supa] NEXT_PUBLIC_SUPABASE_URL is missing. Using fallback for build.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);



