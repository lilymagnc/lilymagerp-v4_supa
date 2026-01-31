
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectNullDates() {
    console.log('Inspecting orders with missing timestamps...');

    // 1. created_at이 비어있는 주문 검색
    // Supabase에서 TIMESTAMP 컬럼이 NULL인 경우
    const { data: missingCreated, error: err1 } = await supabase
        .from('orders')
        .select('id, order_date, created_at, payment')
        .is('created_at', null);

    // 2. 혹시 created_at은 있는데 order_date가 비어있는 경우도 확인
    const { data: missingOrderDate, error: err2 } = await supabase
        .from('orders')
        .select('id, order_date, created_at, payment')
        .is('order_date', null);

    if (err1 || err2) {
        console.error("Error fetching data:", err1, err2);
        return;
    }

    const nullCreated = missingCreated || [];
    const nullOrderDate = missingOrderDate || [];

    console.log(`\n1. created_at (생성시간)이 없는 주문: ${nullCreated.length}건`);
    if (nullCreated.length > 0) {
        console.table(nullCreated.slice(0, 5)); // 5개만 샘플 보기

        // 회생 가능성 체크
        const recoverable = nullCreated.filter(o => o.order_date).length;
        console.log(`   -> 이 중 'order_date(주문일)'는 있어서 복구 가능한 건: ${recoverable}건`);
        console.log(`   -> 완전히 날짜 정보가 없는 건: ${nullCreated.length - recoverable}건`);
    }

    console.log(`\n2. order_date (주문일)가 없는 주문: ${nullOrderDate.length}건`);
    if (nullOrderDate.length > 0) {
        console.table(nullOrderDate.slice(0, 5));

        // 회생 가능성 체크
        const recoverable = nullOrderDate.filter(o => o.created_at).length;
        console.log(`   -> 이 중 'created_at(생성시간)'은 있어서 복구 가능한 건: ${recoverable}건`);
    } else {
        console.log("   -> order_date는 모두 잘 들어있습니다. (다행입니다!)");
    }
}

inspectNullDates();
