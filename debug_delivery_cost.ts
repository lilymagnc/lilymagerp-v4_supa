
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Error loading .env.local, using process.env');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
    console.log('--- 1. 최근 주문 5개 조회 (2026-01-26 근처) ---');
    // 화면에 보이는 날짜(1/26) 기준 조회
    const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, orderer, actual_delivery_cost, order_date')
        .order('order_date', { ascending: false })
        .limit(5);

    if (orderError) {
        console.error('주문 조회 실패:', orderError);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('주문 데이터가 없습니다.');
        return;
    }

    console.log(`조회된 주문 수: ${orders.length}`);

    for (const order of orders) {
        console.log(`\n[주문] ${order.orderer?.name} (${order.order_date}) ID: ${order.id}`);
        console.log(`  - 현재 배송비(DB): ${order.actual_delivery_cost}`);

        // 이 주문과 연결된 지출 내역 찾기 (텍스트 검색)
        // extra_data를 텍스트로 변환하여 ID가 포함된게 있는지 확인
        const { data: expenses, error: expenseError } = await supabase
            .from('simple_expenses')
            .select('id, amount, category, sub_category, extra_data')
            .or(`extra_data.ilike.%${order.id}%`)
            .limit(1);

        if (expenseError) {
            // ilike 검색이 안될 수 있으므로 전체 like 시도 (RPC 없이 클라이언트 필터링은 제한적일 수 있으나 시도)
            console.log('  - 지출 내역 검색 중 에러 (Supabase 필터 제한 가능성):', expenseError.message);
        }

        if (expenses && expenses.length > 0) {
            const exp = expenses[0];
            console.log(`  - ✅ 매칭된 지출 발견!`);
            console.log(`    ID: ${exp.id}`);
            console.log(`    Category: ${exp.category} / ${exp.sub_category}`);
            console.log(`    Amount: ${exp.amount}`);
            console.log(`    Extra Data: ${JSON.stringify(exp.extra_data)}`);
        } else {
            // 혹시 모르니 related_order_id로 한번 더 체크 (컬럼이 있다면)
            console.log(`  - ❌ 매칭된 지출 내역 없음. (이 주문에 대한 배송비 지출 데이터가 DB에 없는 것으로 보임)`);
        }
    }
}

debugData();
