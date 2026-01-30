const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, order_date, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) console.error(error);
    else {
        console.log('--- Latest Orders (JSON) ---');
        console.log(JSON.stringify(orders, null, 2));
    }
}

checkOrders();
