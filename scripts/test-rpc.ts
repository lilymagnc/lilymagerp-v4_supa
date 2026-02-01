
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testRpc() {
    console.log("Testing increment_daily_stats RPC...");

    const { data, error } = await supabase.rpc('increment_daily_stats', {
        p_date: new Date().toISOString().split('T')[0],
        p_revenue_delta: 100,
        p_order_count_delta: 1,
        p_settled_amount_delta: 100,
        p_branch_key: 'Test_Rpc_Branch'
    });

    if (error) {
        console.error("RPC failed:", error);
    } else {
        console.log("RPC success:", data);
    }
}

testRpc();
