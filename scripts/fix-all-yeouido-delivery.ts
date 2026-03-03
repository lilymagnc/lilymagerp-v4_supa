import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const YEOUIDO_BRANCH_ID = 'ztewxOfLrno5mEzTKSNT';

async function fix() {
    // 1. 여의도 발주 주문 (배송일 3/3, 배송비 > 0)
    const { data: orders1 } = await supabase.from('orders')
        .select('id, branch_id, branch_name, actual_delivery_cost, actual_delivery_cost_cash, delivery_info, transfer_info, orderer, status')
        .eq('branch_id', YEOUIDO_BRANCH_ID)
        .neq('status', 'canceled');

    // 2. 이관 수주 주문 (processBranchId = 여의도)
    const { data: orders2 } = await supabase.from('orders')
        .select('id, branch_id, branch_name, actual_delivery_cost, actual_delivery_cost_cash, delivery_info, transfer_info, orderer, status')
        .contains('transfer_info', { processBranchId: YEOUIDO_BRANCH_ID })
        .neq('status', 'canceled');

    const allOrders = [...(orders1 || []), ...(orders2 || [])];
    const uniqueOrders = Array.from(new Map(allOrders.map(o => [o.id, o])).values());

    const todayOrders = uniqueOrders.filter(o => {
        const deliveryDate = o.delivery_info?.date;
        return deliveryDate === '2026-03-03' && (o.actual_delivery_cost > 0 || o.actual_delivery_cost_cash > 0);
    });

    console.log(`Found ${todayOrders.length} orders with delivery cost for 2026-03-03`);

    for (const order of todayOrders) {
        const orderId = order.id;
        const deliveryCost = order.actual_delivery_cost || 0;
        const deliveryCash = order.actual_delivery_cost_cash || 0;
        const recipientName = order.delivery_info?.recipientName || order.orderer?.name || '미지정';
        const driverName = order.delivery_info?.driverName || '';
        const driverAffiliation = order.delivery_info?.driverAffiliation || '운송업체';
        const driverInfo = driverName ? ` (${driverName})` : '';
        const expenseDate = order.delivery_info?.date || '2026-03-03';

        // 이 주문에 대한 기존 simple_expenses가 있는지 확인
        const { data: existing } = await supabase.from('simple_expenses')
            .select('id, extra_data')
            .contains('extra_data', { related_order_id: orderId });

        if (existing && existing.length > 0) {
            console.log(`  [SKIP] ${orderId} - already has ${existing.length} expenses`);
            continue;
        }

        // 실제배송비 생성
        if (deliveryCost > 0) {
            const { error } = await supabase.from('simple_expenses').insert([{
                id: crypto.randomUUID(),
                expense_date: expenseDate,
                amount: deliveryCost,
                category: 'transport',
                sub_category: 'DELIVERY',
                description: `실제배송료-${recipientName}${driverInfo}`,
                supplier: driverAffiliation,
                branch_id: YEOUIDO_BRANCH_ID,
                branch_name: '릴리맥여의도점',
                is_auto_generated: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                extra_data: { related_order_id: orderId, type: 'standard_delivery_fee' }
            }]);
            if (error) console.error(`  [ERROR] standard ${orderId}:`, error.message);
            else console.log(`  [OK] standard ${deliveryCost} for ${recipientName}`);
        }

        // 배송비현금 생성
        if (deliveryCash > 0) {
            const { error } = await supabase.from('simple_expenses').insert([{
                id: crypto.randomUUID(),
                expense_date: expenseDate,
                amount: deliveryCash,
                category: 'transport',
                sub_category: 'DELIVERY',
                description: `배송비현금지급-${recipientName}${driverInfo}`,
                supplier: driverAffiliation,
                branch_id: YEOUIDO_BRANCH_ID,
                branch_name: '릴리맥여의도점',
                is_auto_generated: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                extra_data: { related_order_id: orderId, type: 'driver_cash_payment', payment_method: 'cash' }
            }]);
            if (error) console.error(`  [ERROR] cash ${orderId}:`, error.message);
            else console.log(`  [OK] cash ${deliveryCash} for ${recipientName}`);
        }
    }

    console.log('\nDone!');
}

fix().catch(console.error);
