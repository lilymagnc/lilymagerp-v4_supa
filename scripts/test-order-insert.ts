
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Use Anon Key

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testInsert() {
    console.log("Testing insert...");

    const testOrder = {
        // minimalist order
        branch_id: 'test-branch-id', // Assuming UUID or text. V4 uses UUID usually but lets check.
        branch_name: 'Test Branch',
        order_date: new Date().toISOString(),
        status: 'processing',
        items: [],
        summary: { total: 0 },
        orderer: { name: 'Test' },
        payment: { method: 'card', status: 'pending' },
        is_anonymous: false,
        register_customer: false,
        order_type: 1,
        id: 'test-uuid-' + Date.now()
    };

    const { data, error } = await supabase.from('orders').insert([testOrder]).select();

    if (error) {
        console.error("Insert failed:", error);
    } else {
        console.log("Insert successful:", data);
        // cleanup
        if (data[0]?.id) {
            await supabase.from('orders').delete().eq('id', data[0].id);
        }
    }
}

testInsert();
