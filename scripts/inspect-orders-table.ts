
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectTable() {
    console.log("Inspecting 'orders' table schema via pseudo-introspection...");

    // We can't easily run SQL introspection from client unless we use rpc.
    // But we can try to insert a dummy row or just check a single row's returned structure.

    const { data, error } = await supabase
        .from('orders')
        .select('order_type')
        .limit(5);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    if (data && data.length > 0) {
        console.log("Sample data for 'order_type':");
        data.forEach(row => {
            console.log(`${row.order_type} (Type: ${typeof row.order_type})`);
        });
    } else {
        console.log("No orders found to inspect.");
    }
}

inspectTable();
