
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking daily_settlements table...');
    const { data: earlySettlement, error: sError } = await supabase
        .from('daily_settlements')
        .select('date')
        .order('date', { ascending: true })
        .limit(1);

    if (sError) {
        console.error('Error fetching settlements:', sError);
    } else {
        console.log('Earliest daily settlement date:', earlySettlement?.[0]?.date || 'No data');
    }

    const { data: latestSettlement, error: slError } = await supabase
        .from('daily_settlements')
        .select('date')
        .order('date', { ascending: false })
        .limit(1);

    if (slError) {
        console.error('Error fetching latest settlements:', slError);
    } else {
        console.log('Latest daily settlement date:', latestSettlement?.[0]?.date || 'No data');
    }

    console.log('\nChecking orders table for old data...');
    const { data: earlyOrder, error: oError } = await supabase
        .from('orders')
        .select('created_at')
        .order('created_at', { ascending: true })
        .limit(1);

    if (oError) {
        console.error('Error fetching orders:', oError);
    } else {
        console.log('Earliest order created_at:', earlyOrder?.[0]?.created_at || 'No data');
    }
}

checkData();
