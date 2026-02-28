import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data, error } = await supabase.from('hr_documents').select('branch_confirmed').limit(1);
    if (error) {
        console.error('Column branch_confirmed still does NOT exist:', error);
    } else {
        console.log('Column branch_confirmed EXISTS!');
    }
}
check();
