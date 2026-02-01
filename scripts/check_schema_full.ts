
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function inspectSchema() {
    console.log("Fetching columns for 'orders' table...");

    // We can't query information_schema directly via Supabase JS client easily typically, 
    // but we can try RPC if available, or just standard select if permissions allow.
    // actually standard select on information_schema usually fails or returns empty for security.

    // Instead, let's try to insert a record with ALL fields we expect, and see which one fails specifically.
    // We can also try to select strict columns.

    const propertiesToCheck = [
        'id', 'order_number', 'status', 'receipt_type', 'branch_id', 'branch_name',
        'order_date', 'orderer', 'delivery_info', 'pickup_info', 'summary', 'payment',
        'items', 'message', 'request', 'source', 'is_anonymous', 'register_customer', 'order_type'
    ];

    const { data, error } = await supabase.from('orders').select(propertiesToCheck.join(',')).limit(1);

    if (error) {
        console.error("Select check failed:", error);
        return;
    }
    console.log("Select successful. All columns exist.", Object.keys(data[0] || {}));
}

inspectSchema();
