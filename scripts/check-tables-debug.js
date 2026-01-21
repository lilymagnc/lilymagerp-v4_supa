const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkTables() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking all tables in public schema...');
    // This might not work if permissions are tight, but let's try
    const { data, error } = await supabase
        .from('_table_check') // Just a dummy name to see what the error says
        .select('*')
        .limit(1);

    console.log('Error from dummy table:', error?.message);

    // Try to use a system table if allowed
    const { data: tables, error: tableError } = await supabase
        .from('branches')
        .select('id')
        .limit(1);

    if (tableError) {
        console.log('Error selecting from branches:', tableError.message);
    } else {
        console.log('Success selecting from branches! Rows found:', tables.length);
    }
}

checkTables();
