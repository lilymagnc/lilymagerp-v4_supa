import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const YEOUIDO_BRANCH_ID = 'ztewxOfLrno5mEzTKSNT';

async function fix() {
    // 1. "주문복구" 중복 항목 삭제 (e9648569 주문의 driver_cash_payment 타입)
    const ORDER_ID = 'e9648569-7f3b-449d-af55-441710dcef27';

    const { data: dupes } = await supabase.from('simple_expenses')
        .select('id, amount, description, extra_data')
        .contains('extra_data', { related_order_id: ORDER_ID });

    console.log(`=== e9648569 관련 지출: ${dupes?.length}건 ===`);
    dupes?.forEach(e => console.log(`  id=${e.id}, amount=${e.amount}, type=${e.extra_data?.type}, desc=${e.description}`));

    // driver_cash_payment 타입 삭제 (중복)
    const cashDupe = dupes?.find(e => e.extra_data?.type === 'driver_cash_payment');
    if (cashDupe) {
        const { error } = await supabase.from('simple_expenses').delete().eq('id', cashDupe.id);
        if (error) console.error('Delete failed:', error);
        else console.log(`Deleted: ${cashDupe.id} (driver_cash_payment ${cashDupe.amount})`);
    }

    // standard_delivery_fee 항목의 description을 수정 (주문복구 → 정상)
    const stdExpense = dupes?.find(e => e.extra_data?.type === 'standard_delivery_fee');
    if (stdExpense) {
        // 원래 주문에서 수신자 정보 가져오기
        const { data: order } = await supabase.from('orders')
            .select('delivery_info, orderer')
            .eq('id', ORDER_ID).single();

        const recipientName = order?.delivery_info?.recipientName || order?.orderer?.name || '미지정';
        const driverName = order?.delivery_info?.driverName || '';
        const driverInfo = driverName ? ` (${driverName})` : '';

        // actual_delivery_cost_cash > 0이면 현금 표시 (description에 '현금' 포함시키기)
        const isCash = order?.delivery_info ? true : true; // 17000 cash
        const desc = `배송비현금지급-${recipientName}${driverInfo}`;

        const { error } = await supabase.from('simple_expenses').update({
            description: desc,
            extra_data: {
                ...stdExpense.extra_data,
                payment_method: 'cash'
            }
        }).eq('id', stdExpense.id);
        if (error) console.error('Update failed:', error);
        else console.log(`Updated: ${stdExpense.id} -> desc="${desc}"`);
    }

    // 2. 최종 확인
    console.log('\n=== 최종 확인 (여의도 3/3 transport) ===');
    const { data: final } = await supabase.from('simple_expenses')
        .select('id, amount, description, extra_data')
        .eq('branch_id', YEOUIDO_BRANCH_ID)
        .eq('category', 'transport')
        .gte('expense_date', '2026-03-03T00:00:00')
        .lte('expense_date', '2026-03-03T23:59:59');

    let total = 0;
    console.log(`Total: ${final?.length} rows`);
    final?.forEach(e => {
        console.log(`  id=${e.id}, amount=${e.amount}, desc="${e.description}", type=${e.extra_data?.type}`);
        total += e.amount;
    });
    console.log(`Total amount: ${total}`);
}

fix().catch(console.error);
