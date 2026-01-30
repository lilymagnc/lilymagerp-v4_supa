const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkDbSize() {
    console.log('--- Database Size Check ---');
    // We can't run raw SQL easily without RPC, but we can check if there's any huge table by checking record counts and estimating.
    // However, Supabase sometimes has logs or internal tables that grow.

    const tables = ['stock_history', 'orders', 'simple_expenses', 'customers', 'audit_logs', 'notifications', 'daily_stats'];
    for (const table of tables) {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
        console.log(`${table}: ${count} records`);
    }
}
checkDbSize();
