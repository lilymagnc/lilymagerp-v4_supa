import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function alterTable() {
    console.log('Altering hr_documents table schema...');

    // We cannot easily run arbitrary SQL via the client without RPC.
    // However, I will check if 'branch_confirmed' exists by trying a select.
    const { error: checkError } = await supabase.from('hr_documents').select('branch_confirmed').limit(1);

    if (checkError) {
        console.log('Column branch_confirmed might not exist. Please run this SQL in Supabase SQL editor:');
        console.log('ALTER TABLE public.hr_documents ADD COLUMN branch_confirmed BOOLEAN DEFAULT false;');
        // try RPC exec_sql
        await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS branch_confirmed BOOLEAN DEFAULT false;' });
    } else {
        console.log('Column branch_confirmed already exists!');
    }
}

alterTable();
