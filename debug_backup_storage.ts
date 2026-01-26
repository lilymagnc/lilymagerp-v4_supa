
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Error loading .env.local');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log(`Key type used: ${supabaseKey.startsWith('ey') ? 'JWT (Likely Anon/Service)' : 'Unknown'}`);
if (process.env.SUPABASE_SERVICE_ROLE_KEY) console.log('-> Found SUPABASE_SERVICE_ROLE_KEY in env');
else console.log('-> SUPABASE_SERVICE_ROLE_KEY not found, using fallback');

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBackups() {
    console.log('--- Checking Supabase Storage Backups ---');

    // Strategy 1: List root without options
    console.log('\n[1] Listing root (no options)...');
    const { data: data1, error: error1 } = await supabase.storage.from('backups').list();
    if (error1) console.error('Error:', error1);
    else {
        console.log(`Found ${data1.length} items.`);
        data1.forEach(item => console.log(` - ${item.name} (id:${item.id}, meta:${JSON.stringify(item.metadata)})`));
    }

    // Strategy 2: List with search string
    console.log('\n[2] Listing with search "2025"...');
    const { data: data2, error: error2 } = await supabase.storage.from('backups').list('', { search: '2025' });
    if (error2) console.error('Error:', error2);
    else console.log(`Found ${data2?.length} items.`);

    // Strategy 3: Try to list inside a known folder if possible (guess)
    // If user saw 2025-08-09... let's try to list that specific prefix if we can guess one? 
    // No, we can't guess.
}

checkBackups();
