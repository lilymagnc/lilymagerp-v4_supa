const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseSize() {
    console.log('--- Analyzing Supabase Database Table Sizes ---');

    const query = `
        SELECT
            relname AS table_name,
            pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
            pg_size_pretty(pg_relation_size(relid)) AS table_size,
            pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
        FROM pg_catalog.pg_statio_user_tables
        ORDER BY pg_total_relation_size(relid) DESC;
    `;

    try {
        const { data, error } = await supabase.rpc('execute_sql', { sql_query: query });

        // Note: rpc('execute_sql') might not exist unless predefined. 
        // We might need to use a different approach or just fallback to listing some large tables via API
        if (error) {
            console.log('RPC execute_sql not found. This is expected on default Supabase.');
            console.log('Falling back to checking record counts for major tables...');

            const tables = ['orders', 'customers', 'simple_expenses', 'daily_stats', 'audit_logs', 'stock_history', 'photos'];
            const stats = [];

            for (const table of tables) {
                const { count, error: cError } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true });

                if (!cError) {
                    stats.push({ Table: table, Count: count });
                }
            }
            console.table(stats);
        } else {
            console.table(data);
        }
    } catch (err) {
        console.error(err);
    }
}

checkDatabaseSize();
