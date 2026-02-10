
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkIncorrectTransferExpenses() {
    console.log("Checking for transfer orders with incorrect expense branch attribution...");

    // 1. Fetch all orders that have been transferred and accepted/completed
    // We need orders where transfer_info exists and status is accepted or completed
    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, branch_id, branch_name, transfer_info, order_number')
        .not('transfer_info', 'is', null);

    if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        return;
    }

    const transferredOrders = orders.filter(o => {
        const tStats = o.transfer_info?.status;
        return tStats === 'accepted' || tStats === 'completed';
    });

    console.log(`Found ${transferredOrders.length} transferred (accepted/completed) orders.`);

    let incorrectCount = 0;
    let correctCount = 0;
    let missingExpenseCount = 0;

    for (const order of transferredOrders) {
        const processBranchId = order.transfer_info.processBranchId;
        const processBranchName = order.transfer_info.processBranchName;

        if (!processBranchId) continue;

        // 2. Find related expenses
        const { data: expenses, error: expensesError } = await supabase
            .from('simple_expenses')
            .select('id, branch_id, branch_name, description, amount')
            .contains('extra_data', { relatedOrderId: order.id });

        if (expensesError) {
            console.error(`Error fetching expenses for order ${order.id}:`, expensesError);
            continue;
        }

        if (!expenses || expenses.length === 0) {
            missingExpenseCount++;
            continue;
        }

        // Check if expense is attributed to the correct branch (process branch)
        for (const expense of expenses) {
            // We only care about delivery expenses usually, but let's check all related expenses
            if (expense.branch_id !== processBranchId) {
                console.log(`[MISMATCH] Order ${order.order_number} (${order.id})`);
                console.log(`  - Order Branch (Origin): ${order.branch_name} (${order.branch_id})`);
                console.log(`  - Process Branch (Target): ${processBranchName} (${processBranchId})`);
                console.log(`  - Expense Content: ${expense.description} (${expense.amount.toLocaleString()} won)`);
                console.log(`  - Expense Branch: ${expense.branch_name} (${expense.branch_id})`);
                console.log(`  -> Should be: ${processBranchName}`);
                incorrectCount++;
            } else {
                correctCount++;
            }
        }
    }

    console.log("\n--- Summary ---");
    console.log(`Total Transferred Orders Checked: ${transferredOrders.length}`);
    console.log(`Orders with No Expenses: ${missingExpenseCount}`);
    console.log(`Correctly Attributed Expenses: ${correctCount}`);
    console.log(`Incorrectly Attributed Expenses (Need Fix): ${incorrectCount}`);
}

checkIncorrectTransferExpenses();
