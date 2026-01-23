
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkTransfers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from('order_transfers').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Available columns in order_transfers:', Object.keys(data[0]).join(', '));
    } else {
        const { error: e1 } = await supabase.from('order_transfers').select('cancel_reason').limit(1);
        console.log('cancel_reason exists in order_transfers?', !e1);
    }
}
checkTransfers();
