
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.log('Error loading .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugData() {
    console.log('--- 정밀 데이터 진단 시작 ---');

    // 1. 최근 주문 5개 조회
    const { data: orders } = await supabase
        .from('orders')
        .select('id, orderer, actual_delivery_cost, order_date')
        .order('order_date', { ascending: false })
        .limit(5);

    if (!orders || orders.length === 0) {
        console.log('주문 데이터가 없습니다.');
        return;
    }

    console.log(`\n📦 최근 주문 목록 (5개):`);
    orders.forEach(o => {
        console.log(`- 주문ID: ${o.id} | 날짜: ${o.order_date?.substring(0, 10)} | 현재 배송비: ${o.actual_delivery_cost}`);
    });

    // 2. 최근 배송비 지출 내역 조회 (transport 카테고리)
    // 대소문자 이슈 방지를 위해 둘 다 조회 시도할 수 없으니, 일단 or 없이 가장 최근것들 가져와서 분석
    const { data: expenses } = await supabase
        .from('simple_expenses')
        .select('id, amount, category, sub_category, extra_data, created_at')
        .order('created_at', { ascending: false })
        .limit(50); // 최근 50개

    console.log(`\n💰 최근 지출 내역 목록 (50개 중 배송비 관련만 필터링):`);

    if (!expenses) {
        console.log('지출 데이터가 없습니다.');
        return;
    }

    const transportExpenses = expenses.filter(e =>
        e.category?.toLowerCase() === 'transport' ||
        (e.sub_category && e.sub_category.toUpperCase().includes('DELIVERY'))
    );

    if (transportExpenses.length === 0) {
        console.log('⚠️ 경고: 최근 50개 지출 중 배송비(transport/DELIVERY) 관련 항목이 하나도 없습니다!');
        console.log('   (지출 데이터 마이그레이션이 누락되었거나, 아주 오래된 데이터일 수 있습니다.)');
    }

    transportExpenses.forEach(e => {
        console.log(`- 지출ID: ${e.id} | 금액: ${e.amount} | ExtraData: ${JSON.stringify(e.extra_data)}`);
    });

    console.log('\n🔍 매칭 분석:');

    let matchCount = 0;
    for (const order of orders) {
        const matched = transportExpenses.find(e => {
            const extraStr = JSON.stringify(e.extra_data || {});
            return extraStr.includes(order.id);
        });

        if (matched) {
            matchCount++;
            console.log(`✅ [성공] 주문 ${order.id}에 해당하는 지출 내역을 찾았습니다! (지출ID: ${matched.id})`);
        } else {
            console.log(`❌ [실패] 주문 ${order.id}은 연결된 지출 내역이 없습니다.`);
        }
    }

    if (matchCount === 0) {
        console.log('\n🚨 결론: 최근 주문들과 연결되는 지출 내역이 하나도 없습니다.');
        console.log('   가능성 1) 지출 데이터가 아직 Supabase로 넘어오지 않음 (지출 내역 페이지에 보이는 건 Firebase 데이터일 수 있음)');
        console.log('   가능성 2) 주문 ID가 변경됨 (Firebase ID vs Supabase UUID 불일치)');
    }
}

debugData();
