require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verify() {
    console.log('Testing connection to Supabase (SELECT * LIMIT 1)...');

    const tables = ['customers', 'orders', 'daily_stats', 'non_existent_table_test'];

    for (const table of tables) {
        console.log(`Checking table: ${table}`);
        const { data, error, status, statusText } = await supabase
            .from(table)
            .select('*')
            .limit(1);

        if (error) {
            console.error(`  Error: ${error.message} (Code: ${error.code})`);
            console.error(`  Status: ${status} ${statusText}`);
        } else {
            console.log(`  Connected. Data length: ${data ? data.length : 0}`);
            console.log(`  Status: ${status} ${statusText}`);
        }
        console.log('---');
    }
}

verify();
