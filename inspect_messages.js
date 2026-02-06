const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectMessages() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, message, extra_data')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- Order Messages & Extra Data ---');
    orders.forEach(order => {
        console.log(`Order ID: ${order.id} (${order.order_number})`);
        console.log(`  Message Column:`, JSON.stringify(order.message));
        console.log(`  Extra Data Message:`, JSON.stringify(order.extra_data?.message));
        console.log('---');
    });
}

inspectMessages();
