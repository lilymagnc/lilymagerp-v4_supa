const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key is missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncExpenses() {
    console.log('🔄 Starting ROBUST sync of delivery expenses with delivery dates...');

    // 1. Fetch all auto-generated delivery expenses
    const { data: expenses, error: expenseError } = await supabase
        .from('simple_expenses')
        .select('*')
        .in('sub_category', ['DELIVERY', 'DELIVERY_CASH']);

    if (expenseError) {
        console.error('Error fetching expenses:', expenseError);
        return;
    }

    console.log(`📊 Found ${expenses.length} delivery expenses to check.`);

    let updatedCount = 0;
    let skipCount = 0;

    for (const expense of expenses) {
        // Check all possible places for order ID
        const orderId = expense.related_order_id ||
            expense.extra_data?.related_order_id ||
            expense.extra_data?.relatedOrderId ||
            expense.relatedOrderId;

        if (!orderId) {
            console.log(`⚠️ Expense ${expense.id} ("${expense.description}") has no related order ID. Skipping.`);
            skipCount++;
            continue;
        }

        // 2. Fetch the related order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('delivery_info, pickup_info, receipt_type')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            console.log(`⚠️ Could not find order ${orderId} for expense ${expense.id}. Skipping.`);
            skipCount++;
            continue;
        }

        // 3. Get the correct delivery date
        const deliveryDateStr = order.delivery_info?.date || order.pickup_info?.date;

        if (!deliveryDateStr) {
            console.log(`⚠️ Order ${orderId} has no delivery/pickup date. Skipping.`);
            skipCount++;
            continue;
        }

        // Normalize expense_date and deliveryDateStr for comparison
        const currentExpenseDate = new Date(expense.expense_date).toISOString().split('T')[0];
        const targetDeliveryDate = new Date(deliveryDateStr).toISOString().split('T')[0];

        if (currentExpenseDate !== targetDeliveryDate) {
            console.log(`📝 Updating Expense ${expense.id} (Order: ${orderId}): ${currentExpenseDate} -> ${targetDeliveryDate}`);

            const { error: updateError } = await supabase
                .from('simple_expenses')
                .update({
                    expense_date: targetDeliveryDate,
                    updated_at: new Date().toISOString()
                })
                .eq('id', expense.id);

            if (updateError) {
                console.error(`❌ Error updating expense ${expense.id}:`, updateError);
            } else {
                updatedCount++;
            }
        } else {
            // console.log(`✅ Expense ${expense.id} is already correct (${currentExpenseDate}).`);
            skipCount++;
        }
    }

    console.log('\n✅ Sync Complete!');
    console.log(`✨ Updated: ${updatedCount}`);
    console.log(`⏭️ Skipped/Already correct: ${skipCount}`);
}

syncExpenses();
