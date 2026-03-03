import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    const orderId = 'e9648569-7f3b-449d-af55-441710dcef27';

    // 1. Get the order
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) {
        console.log('Order not found');
        return;
    }

    const tInfo = order.transfer_info || order.extra_data?.transfer_info;
    if (!tInfo) {
        console.log('No transfer info');
        return;
    }

    console.log('Transfer info:', tInfo);
    console.log('Should be branch:', tInfo.processBranchName, tInfo.processBranchId);

    // 2. Find expenses
    const { data: expenses } = await supabase.from('simple_expenses').select('*').contains('extra_data', { related_order_id: orderId });

    console.log('Expenses found:', expenses?.length);
    if (expenses && expenses.length > 0) {
        for (const exp of expenses) {
            console.log('Expense:', exp.id, exp.description, exp.amount, exp.branch_name);
            if (exp.branch_id !== tInfo.processBranchId) {
                // Fix it
                const { error } = await supabase.from('simple_expenses').update({
                    branch_id: tInfo.processBranchId,
                    branch_name: tInfo.processBranchName
                }).eq('id', exp.id);
                if (error) {
                    console.error('Failed to update:', error);
                } else {
                    console.log(`Updated ${exp.id} to ${tInfo.processBranchName}`);
                }
            }
        }
    } else {
        console.log('No expenses found for this order.');
    }
}

fix();
