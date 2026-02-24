import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .gte('order_date', '2026-02-06T00:00:00+09:00')
        .lt('order_date', '2026-02-07T00:00:00+09:00')
        .order('order_date', { ascending: true });

    if (error) {
        console.error(error);
    } else {
        console.log("Orders on Feb 6 by order_date:");
        console.log(JSON.stringify(data[0], null, 2));
        console.log(`Total orders: ${data.length}`);
    }
}
check();
