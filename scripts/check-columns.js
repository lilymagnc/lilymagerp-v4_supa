
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkColumns() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- Checking Orders Table ---');
    // Using select('*').limit(1) and then checking keys in the result is safer to see what columns exist
    const { data: orders, error: oError } = await supabase.from('orders').select('*').limit(1);
    if (oError) {
        console.log('❌ Orders table check failed:', oError.message);
    } else if (orders && orders.length > 0) {
        const columns = Object.keys(orders[0]);
        console.log('Available columns in orders:', columns.join(', '));
        console.log('Has cancel_reason?', columns.includes('cancel_reason'));
        console.log('Has canceled_at?', columns.includes('canceled_at'));
    } else {
        console.log('⚠️ No data in orders table to check columns.');
        // Try selecting specifically to trigger error if missing
        const { error: specificError } = await supabase.from('orders').select('cancel_reason').limit(1);
        if (specificError && specificError.code === 'PGRST204') { // Column not found? No, PGRST204 is something else.
            console.log('❌ Specific select for cancel_reason failed:', specificError.message);
        } else {
            console.log('✅ Specific select for cancel_reason worked (or table empty but column exists)');
        }
    }
}

checkColumns();
