const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing configuration');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking Supabase Data ---');

    // Check latest 5 orders
    const { data: orders, error: oError } = await supabase
        .from('orders')
        .select('id, order_number, order_date, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (oError) {
        console.error('Orders fetch error:', oError);
    } else {
        console.log('Latest 5 orders in Supabase:');
        console.table(orders);
    }

    // Check latest daily_stats
    const { data: stats, error: sError } = await supabase
        .from('daily_stats')
        .select('date, last_updated')
        .order('date', { ascending: false })
        .limit(5);

    if (sError) {
        console.error('Stats fetch error:', sError);
    } else {
        console.log('Latest 5 daily stats:');
        console.table(stats);
    }
}

checkData();
