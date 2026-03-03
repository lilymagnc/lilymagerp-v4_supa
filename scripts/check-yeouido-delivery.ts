import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const YEOUIDO_BRANCH_ID = 'ztewxOfLrno5mEzTKSNT';

async function check() {
    // 1. simple_expenses: 여의도점 2026-03-03 운송비
    const { data: expenses } = await supabase.from('simple_expenses')
        .select('id, amount, description, category, expense_date, extra_data, branch_name')
        .eq('branch_id', YEOUIDO_BRANCH_ID)
        .eq('category', 'transport')
        .gte('expense_date', '2026-03-03T00:00:00')
        .lte('expense_date', '2026-03-03T23:59:59')
        .order('expense_date', { ascending: false });

    console.log('=== simple_expenses (transport, Yeouido, 2026-03-03) ===');
    console.log(`Total: ${expenses?.length} rows`);
    let total = 0;
    expenses?.forEach(e => {
        console.log(`  id=${e.id}, amount=${e.amount}, desc="${e.description}", extra_data.type=${e.extra_data?.type}, related_order=${e.extra_data?.related_order_id}`);
        total += e.amount;
    });
    console.log(`Total amount: ${total}`);

    // 2. orders: 여의도점 수주 or 발주, 배송일 2026-03-03, delivery cost > 0
    // 여의도점 발주 주문
    const { data: orders1 } = await supabase.from('orders')
        .select('id, branch_name, actual_delivery_cost, actual_delivery_cost_cash, delivery_info, transfer_info, status')
        .eq('branch_id', YEOUIDO_BRANCH_ID)
        .neq('status', 'canceled');

    // 이관된 주문 중 수주지점이 여의도인 주문
    const { data: orders2 } = await supabase.from('orders')
        .select('id, branch_name, actual_delivery_cost, actual_delivery_cost_cash, delivery_info, transfer_info, status')
        .contains('transfer_info', { processBranchId: YEOUIDO_BRANCH_ID })
        .neq('status', 'canceled');

    const allOrders = [...(orders1 || []), ...(orders2 || [])];
    // Deduplicate
    const uniqueOrders = Array.from(new Map(allOrders.map(o => [o.id, o])).values());

    // Filter: delivery date = 2026-03-03, has delivery cost
    const todayOrders = uniqueOrders.filter(o => {
        const deliveryDate = o.delivery_info?.date;
        return deliveryDate === '2026-03-03' && (o.actual_delivery_cost > 0 || o.actual_delivery_cost_cash > 0);
    });

    console.log('\n=== Orders with delivery cost (Yeouido, delivery date 2026-03-03) ===');
    console.log(`Total: ${todayOrders.length} orders`);
    let orderTotal = 0;
    let orderCashTotal = 0;
    todayOrders.forEach(o => {
        const isTransferred = o.transfer_info?.isTransferred;
        console.log(`  id=${o.id}, branch=${o.branch_name}, cost=${o.actual_delivery_cost}, cash=${o.actual_delivery_cost_cash}, transferred=${isTransferred}, transfer_status=${o.transfer_info?.status}`);
        orderTotal += (o.actual_delivery_cost || 0);
        orderCashTotal += (o.actual_delivery_cost_cash || 0);
    });
    console.log(`Total delivery cost: ${orderTotal}`);
    console.log(`Total delivery cash: ${orderCashTotal}`);
}

check().catch(console.error);
