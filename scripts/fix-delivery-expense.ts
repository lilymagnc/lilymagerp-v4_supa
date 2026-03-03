import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const ORDER_ID = 'e9648569-7f3b-449d-af55-441710dcef27';

async function fix() {
    const { data: order } = await supabase.from('orders').select('*').eq('id', ORDER_ID).single();
    if (!order) { console.log('Order not found'); return; }

    const tInfo = order.transfer_info || order.extra_data?.transfer_info;
    const targetBranchId = tInfo?.processBranchId || order.branch_id;
    const targetBranchName = tInfo?.processBranchName || order.branch_name;
    const deliveryCost = order.actual_delivery_cost || 0;
    const deliveryCash = order.actual_delivery_cost_cash || 0;
    const expenseDate = order.delivery_info?.date || new Date().toISOString().split('T')[0];

    console.log(`Target branch: ${targetBranchName} (${targetBranchId})`);
    console.log(`Delivery cost: ${deliveryCost}, cash: ${deliveryCash}, date: ${expenseDate}`);

    // payment_method, related_order_id 컬럼 없음! extra_data 안에만 넣기
    if (deliveryCost > 0) {
        const { error } = await supabase.from('simple_expenses').insert([{
            id: crypto.randomUUID(),
            expense_date: expenseDate,
            amount: deliveryCost,
            category: 'transport',
            sub_category: 'DELIVERY',
            description: `실제배송료-주문복구`,
            supplier: '운송업체',
            branch_id: targetBranchId,
            branch_name: targetBranchName,
            is_auto_generated: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            extra_data: { related_order_id: ORDER_ID, type: 'standard_delivery_fee' }
        }]);
        if (error) console.error('Standard delivery fee insert failed:', error);
        else console.log(`Standard delivery fee ${deliveryCost} created for ${targetBranchName}`);
    }

    if (deliveryCash > 0) {
        const { error } = await supabase.from('simple_expenses').insert([{
            id: crypto.randomUUID(),
            expense_date: expenseDate,
            amount: deliveryCash,
            category: 'transport',
            sub_category: 'DELIVERY',
            description: `배송비현금지급-주문복구`,
            supplier: '운송업체',
            branch_id: targetBranchId,
            branch_name: targetBranchName,
            is_auto_generated: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            extra_data: { related_order_id: ORDER_ID, type: 'driver_cash_payment', payment_method: 'cash' }
        }]);
        if (error) console.error('Cash delivery fee insert failed:', error);
        else console.log(`Cash delivery fee ${deliveryCash} created for ${targetBranchName}`);
    }

    console.log('Done!');
}

fix().catch(console.error);
