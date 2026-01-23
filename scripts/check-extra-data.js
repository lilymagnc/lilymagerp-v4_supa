require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExtraData() {
    const { data, error } = await supabase
        .from('orders')
        .select('id, extra_data')
        .not('extra_data', 'is', null)
        .limit(10);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log(`Found ${data.length} orders with extra_data.`);
        data.forEach(d => {
            console.log(`Order ${d.id}:`, Object.keys(d.extra_data));
        });
    }
}

checkExtraData();
