
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function checkColumns() {
    const fields = ['message', 'request', 'memo'];

    for (const field of fields) {
        const { error } = await supabase.from('orders').select(field).limit(1);
        if (error) {
            console.log(`${field} check error:`, error.message);
        } else {
            console.log(`${field} exists.`);
        }
    }
}

checkColumns();
