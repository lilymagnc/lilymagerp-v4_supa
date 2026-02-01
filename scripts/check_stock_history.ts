
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkStockHistorySchema() {
    console.log("Checking stock_history table schema...");

    // Try to insert a dummy row to see what fails or check columns by selecting them
    // Selecting is safer first
    const columns = [
        'id', 'type', 'item_type', 'item_id', 'item_name',
        'quantity', 'from_stock', 'to_stock', 'branch',
        'operator', 'price', 'total_amount', 'note', 'created_at'
    ];

    for (const col of columns) {
        const { error } = await supabase.from('stock_history').select(col).limit(1);
        if (error) {
            console.log(`Column '${col}' check failed:`, error.message);
        } else {
            console.log(`Column '${col}' exists.`);
        }
    }
}

checkStockHistorySchema();
