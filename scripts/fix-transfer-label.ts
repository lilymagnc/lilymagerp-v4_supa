import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ORDER_ID = 'e9648569-7f3b-449d-af55-441710dcef27';

async function fix() {
    // 주문 정보 가져오기
    const { data: order } = await supabase.from('orders')
        .select('delivery_info, orderer, branch_name, transfer_info')
        .eq('id', ORDER_ID).single();
    if (!order) { console.log('Order not found'); return; }

    const recipientName = order.delivery_info?.recipientName || order.orderer?.name || '미지정';
    const driverName = order.delivery_info?.driverName || '';
    const driverInfo = driverName ? ` (${driverName})` : '';

    // 해당 주문 관련 expense 찾기
    const { data: expenses } = await supabase.from('simple_expenses')
        .select('id, description, extra_data')
        .contains('extra_data', { related_order_id: ORDER_ID });

    if (!expenses || expenses.length === 0) {
        console.log('No expenses found');
        return;
    }

    for (const exp of expenses) {
        const newDesc = `이관배송비현금지급-${recipientName}${driverInfo}`;
        const { error } = await supabase.from('simple_expenses').update({
            description: newDesc,
            extra_data: {
                ...exp.extra_data,
                is_transferred: true,
                original_branch_name: order.branch_name,
                payment_method: 'cash'
            }
        }).eq('id', exp.id);

        if (error) console.error('Update failed:', error);
        else console.log(`Updated: "${exp.description}" -> "${newDesc}"`);
    }

    console.log('Done!');
}

fix().catch(console.error);
