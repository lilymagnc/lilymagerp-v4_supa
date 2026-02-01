
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkColumns() {
    const { data, error } = await supabase
        .from('orders')
        .select('receipt_type')
        .limit(1);

    if (error) {
        console.log("receipt_type check error:", error.message);
    } else {
        console.log("receipt_type exists.");
    }
}

checkColumns();
