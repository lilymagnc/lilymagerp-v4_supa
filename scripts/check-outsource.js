require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOutsource() {
    console.log('--- Checking Outsource Info in Orders ---');

    // Check extra_data->outsource_info
    const { data: edData, error: edError } = await supabase
        .from('orders')
        .select('id, extra_data')
        .not('extra_data->outsource_info', 'is', null);

    if (edError) {
        console.error('Error checking extra_data:', edError.message);
    } else {
        console.log(`Found ${edData ? edData.length : 0} items in extra_data->outsource_info.`);
        if (edData && edData.length > 0) {
            console.log('Sample:', JSON.stringify(edData[0].extra_data.outsource_info));
        }
    }

    // Check top-level outsource_info column
    const { error: tlError } = await supabase
        .from('orders')
        .select('outsource_info')
        .limit(1);

    if (tlError) {
        console.log('Top-level outsource_info column status:', tlError.message);
    } else {
        console.log('Top-level outsource_info column EXISTS.');
    }
}

checkOutsource();
