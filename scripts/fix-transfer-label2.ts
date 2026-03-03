import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const TRANSFERRED_IDS = [
    'a1cd5eda-1e6f-4f93-a0d3-e942549cc394',
    '8d96aa8c-5dd5-40a6-bdc8-e57fe28d300c'
];

async function fix() {
    for (const orderId of TRANSFERRED_IDS) {
        const { data: order } = await supabase.from('orders')
            .select('delivery_info, orderer, branch_name')
            .eq('id', orderId).single();
        if (!order) { console.log(`Order ${orderId} not found`); continue; }

        const { data: expenses } = await supabase.from('simple_expenses')
            .select('id, description, extra_data')
            .contains('extra_data', { related_order_id: orderId });

        if (!expenses || expenses.length === 0) {
            console.log(`No expenses for ${orderId}`);
            continue;
        }

        const recipientName = order.delivery_info?.recipientName || order.orderer?.name || '미지정';
        const driverName = order.delivery_info?.driverName || '';
        const driverInfo = driverName ? ` (${driverName})` : '';

        for (const exp of expenses) {
            const newDesc = `이관실제배송료-${recipientName}${driverInfo}`;
            const { error } = await supabase.from('simple_expenses').update({
                description: newDesc,
                extra_data: { ...exp.extra_data, is_transferred: true, original_branch_name: order.branch_name }
            }).eq('id', exp.id);
            if (error) console.error('Error:', error);
            else console.log(`Updated: "${exp.description}" -> "${newDesc}"`);
        }
    }
    console.log('Done!');
}

fix().catch(console.error);
