
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { parseISO, format } from 'date-fns';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Order {
    id: string;
    order_date: string;
    created_at: string;
    branch_name: string;
    summary: { total?: number };
    payment: { status?: string, completedAt?: string };
    status: string;
    completed_at?: string;
}

async function rebuildStats() {
    console.log('Starting Daily Stats Rebuild via Node.js...');

    // 1. Clear existing stats
    console.log('Clearing old daily_stats...');
    const { error: delError } = await supabase.from('daily_stats').delete().neq('date', 'cleanup_protection');
    // Delete all rows. 'cleanup_protection' is dummy, actually we want delete all.
    // .neq('id', '0') might be safer if date allows? daily_stats PK is date.
    // Try delete with a filter that matches all. date > '1900-01-01'.

    // Better: split delete into chunks if huge, but here likely small.
    // Using date filter to delete all
    await supabase.from('daily_stats').delete().gte('date', '2000-01-01');

    // 2. Fetch all valid orders
    console.log('Fetching all orders...');
    let allOrders: Order[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_date, created_at, branch_name, summary, payment, status, completed_at')
            .not('status', 'in', '("cancelled","canceled","취소","주문취소")')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching orders:', error);
            return;
        }
        if (!data || data.length === 0) break;

        allOrders = [...allOrders, ...data] as any;
        if (data.length < pageSize) break;
        page++;
    }
    console.log(`Fetched ${allOrders.length} valid orders.`);

    // 3. Aggregate in Memory
    const statsMap: Record<string, any> = {};

    function initDay(dateStr: string) {
        if (!statsMap[dateStr]) {
            statsMap[dateStr] = {
                date: dateStr,
                total_revenue: 0,
                total_order_count: 0,
                total_settled_amount: 0,
                branches: {}
            };
        }
    }

    // KST Helper
    const toKSTDateStr = (utcStr: string | undefined | null) => {
        if (!utcStr) return null;
        try {
            const date = new Date(utcStr);
            // UTC+9 (KST)
            date.setHours(date.getHours() + 9);
            return date.toISOString().substring(0, 10);
        } catch (e) {
            return null;
        }
    };

    allOrders.forEach(order => {
        // 엄격한 결제 완료 조건: payment.status가 확실한 완료 상태여야 함
        const pStatus = (order.payment?.status || '').toLowerCase();
        const isPaid = ['paid', 'completed', '결제완료', '입금완료'].includes(pStatus);

        // 제외 조건: 취소된 주문은 당연히 제외 (이미 쿼리에서 필터링했으나 이중 체크)
        const oStatus = (order.status || '').toLowerCase();
        const isCancelled = ['cancelled', 'canceled', '취소', '주문취소'].includes(oStatus);

        if (!isPaid || isCancelled) return; // 매출 집계 제외!

        // 3. 날짜 기준: "언제 돈이 들어왔는가?" (결제일 기준)
        // payment.completedAt > order.completed_at > order_date 순서
        // User Request: "금일 결제건이 당일 결제액" -> 즉, 과거에 주문했어도 오늘 결제했으면 오늘 날짜 매출!

        let rawDate = order.payment?.completedAt || order.completed_at;

        // 결제일 정보가 불확실하면 (데이터 마이그레이션 누락 등), 주문일이나 생성일 사용
        if (!rawDate) rawDate = order.order_date || order.created_at;

        let targetDateStr = toKSTDateStr(rawDate);

        if (targetDateStr) {
            initDay(targetDateStr);
            const total = Number(order.summary?.total || 0);

            // Branch Normalization
            let branchKey = (order.branch_name || 'unknown').replace(/ /g, '_');

            // Add Stats (Only Paid)
            statsMap[targetDateStr].total_revenue += total;
            statsMap[targetDateStr].total_order_count += 1; // 결제된 주문 수만 카운트? (매출 분석이므로)
            statsMap[targetDateStr].total_settled_amount += total; // revenue = settled 같은 개념으로 처리

            // Add Branch Stats
            if (!statsMap[targetDateStr].branches[branchKey]) {
                statsMap[targetDateStr].branches[branchKey] = { revenue: 0, orderCount: 0, settledAmount: 0 };
            }
            statsMap[targetDateStr].branches[branchKey].revenue += total;
            statsMap[targetDateStr].branches[branchKey].orderCount += 1;
            statsMap[targetDateStr].branches[branchKey].settledAmount += total;
        }
    });

    // 4. Save to DB
    console.log(`Aggregated into ${Object.keys(statsMap).length} days. Saving...`);

    const rows = Object.values(statsMap).map((d: any) => ({
        date: d.date,
        total_revenue: d.total_revenue,
        total_order_count: d.total_order_count,
        total_settled_amount: d.total_settled_amount,
        branches: d.branches,
        last_updated: new Date().toISOString()
    }));

    // Batch insert
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('daily_stats').upsert(batch);
        if (error) console.error('Error inserting batch:', error);
    }

    console.log('Rebuild Complete!');
}

rebuildStats();
