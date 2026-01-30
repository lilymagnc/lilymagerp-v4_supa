
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixTable() {
    console.log('Fixing hr_documents table schema...');

    // We cannot easily run arbitrary SQL via the client unless an RPC exists.
    // Let's try to just use REST to see if we can at least interact.
    // Given the previous failure, I will assume the table needs to be TEXT based.

    // If you have the SQL execution permissions/RPC, use it. 
    // Otherwise, I will have to ask the user to run it in the SQL Editor.

    const sql = `
        DROP TABLE IF EXISTS public.hr_documents CASCADE;
        CREATE TABLE public.hr_documents (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            user_name TEXT,
            document_type TEXT NOT NULL,
            submission_date TIMESTAMPTZ DEFAULT now(),
            status TEXT DEFAULT '처리중',
            contents JSONB,
            file_url TEXT,
            original_file_name TEXT,
            submission_method TEXT,
            extracted_from_file BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all access to hr_documents" ON public.hr_documents FOR ALL USING (true) WITH CHECK (true);
    `;

    // Try a common RPC name for SQL execution if it exists
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error fixing table via RPC:', error);
        console.log('Please run the following SQL in the Supabase SQL Editor manually:');
        console.log(sql);
    } else {
        console.log('Table fixed successfully!');
    }
}

fixTable();
