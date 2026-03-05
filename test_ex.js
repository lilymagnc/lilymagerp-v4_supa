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

async function checkEx() {
    // Yeouido orders list
    const orderIds = [
        'b68cf917-d6d1-4c0c-8c7e-f279cb097b22',
        '5810eccc-2ad5-403d-a3fd-867d612172a5',
        'b5671597-4f6c-4ec6-b48f-0f477f7a7def'
    ];

    // Check their exact transfer_info
    const { data: orders } = await supabase.from('orders').select('id, branch_id, branch_name, actual_delivery_cost, actual_delivery_cost_cash, transfer_info, updated_at').in('id', orderIds);
    console.log("Orders:", JSON.stringify(orders, null, 2));

    // Check simple expenses linked to them
    const { data: expenses } = await supabase.from('simple_expenses').select('id, branch_id, branch_name, amount, description, extra_data').contains('extra_data', { type: 'standard_delivery_fee' });

    const related = expenses.filter(e => e.extra_data && orderIds.includes(e.extra_data.related_order_id));
    console.log("Related Expenses:", JSON.stringify(related, null, 2));
}

checkEx();
