
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
    console.log('Error loading .env.local');
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function checkOrderDates() {
    console.log('--- 주문 날짜 분포 진단 ---');

    // 1. 전체 주문 수 및 날짜 범위 조회
    const { data: allOrders, error: countError } = await supabase
        .from('orders')
        .select('order_date, id')
        .order('order_date', { ascending: true }); // 가장 오래된 것부터

    if (countError) {
        console.error('조회 실패:', countError);
        return;
    }

    const total = allOrders.length;
    console.log(`총 주문 수: ${total}건`);

    if (total === 0) return;

    const oldest = allOrders[0].order_date;
    const newest = allOrders[total - 1].order_date;

    console.log(`가장 오래된 주문: ${oldest}`);
    console.log(`가장 최근 주문: ${newest}`);

    // 2. 월별 통계 계산
    const stats: Record<string, number> = {};
    allOrders.forEach(o => {
        if (!o.order_date) return;
        const yyyymm = o.order_date.substring(0, 7); // 2025-01
        stats[yyyymm] = (stats[yyyymm] || 0) + 1;
    });

    console.log('\n[월별 주문 수]');
    Object.keys(stats).sort().forEach(ym => {
        console.log(`${ym}: ${stats[ym]}건`);
    });

    // 3. 2025년 데이터 존재 여부 확인
    const count2025 = allOrders.filter(o => o.order_date && o.order_date.startsWith('2025')).length;
    console.log(`\n2025년 데이터 총 개수: ${count2025}건`);
}

checkOrderDates();
