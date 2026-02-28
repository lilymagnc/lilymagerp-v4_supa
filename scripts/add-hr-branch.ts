import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function alterTable() {
    console.log('Altering hr_documents table schema to add branch_name...');

    // Check if column exists
    const { error: checkError } = await supabase.from('hr_documents').select('branch_name').limit(1);

    if (checkError) {
        console.log('Column branch_name might not exist. Adding via exec_sql...');
        const { error: rpcError } = await supabase.rpc('exec_sql', { sql_query: 'ALTER TABLE public.hr_documents ADD COLUMN IF NOT EXISTS branch_name TEXT;' });

        if (rpcError) {
            console.error('Failed to add via RPC:', rpcError);
        } else {
            console.log('Successfully added branch_name via RPC.');
        }
    } else {
        console.log('Column branch_name already exists!');
    }
}

alterTable();
