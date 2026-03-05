const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixExpenses() {
    const today = '2026-03-05';

    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .filter('delivery_info->>date', 'eq', today);

    if (error) {
        console.error(error);
        return;
    }

    let fixedCount = 0;

    for (const order of orders) {
        const standardCost = order.actual_delivery_cost || 0;
        const cashCost = order.actual_delivery_cost_cash || 0;
        const totalDeliveryCost = standardCost + cashCost;

        if (totalDeliveryCost > 0) {
            let expenseBranchId = order.branch_id;
            let expenseBranchName = order.branch_name;

            let tInfo = order.transfer_info || (order.extra_data && order.extra_data.transfer_info);

            if (typeof tInfo === 'string') {
                try { tInfo = JSON.parse(tInfo); } catch (e) { }
            }

            const isTransferredOrder = tInfo && tInfo.isTransferred && ['pending', 'accepted', 'completed'].includes(tInfo.status);

            if (isTransferredOrder && tInfo.processBranchId) {
                expenseBranchId = tInfo.processBranchId;
                expenseBranchName = tInfo.processBranchName;
            }

            const { data: existingExpenses } = await supabase
                .from('simple_expenses')
                .select('id, amount, extra_data')
                .contains('extra_data', { related_order_id: order.id });

            const existingExpense = existingExpenses?.find(e =>
                e.extra_data?.type === 'standard_delivery_fee' ||
                e.extra_data?.type === 'driver_cash_payment'
            );

            if (!existingExpense) {
                const supplierName = (order.delivery_info && order.delivery_info.driverAffiliation) || '운송업체';
                const driverName = (order.delivery_info && order.delivery_info.driverName) || '';
                const driverInfo = driverName ? ` (${driverName})` : '';
                const expenseDate = order.delivery_info && order.delivery_info.date ? order.delivery_info.date : order.order_date;
                const recipientName = (order.delivery_info && order.delivery_info.recipientName) || (order.orderer && order.orderer.name) || '미지정';

                const isCashPayment = cashCost > 0;
                const transferPrefix = isTransferredOrder ? '이관' : '';
                const descPrefix = isCashPayment ? `${transferPrefix}배송비현금지급` : `${transferPrefix}실제배송료`;

                const payload = {
                    id: crypto.randomUUID(),
                    expense_date: expenseDate,
                    amount: totalDeliveryCost,
                    category: 'transport',
                    sub_category: 'DELIVERY',
                    description: `${descPrefix}-${recipientName}${driverInfo}`,
                    supplier: supplierName,
                    branch_id: expenseBranchId,
                    branch_name: expenseBranchName,
                    is_auto_generated: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    extra_data: {
                        related_order_id: order.id,
                        type: 'standard_delivery_fee',
                        ...(isCashPayment ? { payment_method: 'cash', cash_amount: cashCost } : { payment_method: 'transfer' }),
                        ...(isTransferredOrder ? { is_transferred: true, original_branch_name: order.branch_name } : {})
                    }
                };

                await supabase.from('simple_expenses').insert([payload]);
                console.log(`Created expense for order ${order.id}`);
                fixedCount++;
            } else {
                if (existingExpense.amount !== totalDeliveryCost) {
                    await supabase.from('simple_expenses').update({ amount: totalDeliveryCost }).eq('id', existingExpense.id);
                    console.log(`Updated expense for order ${order.id} to new amount ${totalDeliveryCost}`);
                    fixedCount++;
                }
            }
        }
    }

    console.log(`Fixed ${fixedCount} expenses.`);
}

fixExpenses();
