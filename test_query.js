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

async function checkDeliveryCost() {
    try {
        // 1. Get branches to identify 여의도점 (Yeouido)
        const { data: branches, error: branchErr } = await supabase.from('branches').select('*');
        if (branchErr) throw branchErr;
        console.log("Branches:", branches.map(b => `${b.id}: ${b.name}`));

        const yeouidoBranch = branches.find(b => b.name.includes('여의도'));
        if (!yeouidoBranch) {
            console.log("여의도점을 찾을 수 없습니다.");
            return;
        }

        // 2. Query orders
        // The requirement: "오늘 실제 배송비입력" = actualDeliveryCost is not null for today's deliveries
        // Or we look at orders where deliveryInfo->>'date' === '2026-03-05' (today according to metadata)
        // AND (branch_id === yeouidoBranch.id OR transfer_info->>'processBranchId' === yeouidoBranch.id)

        const today = '2026-03-05';

        // Let's just fetch ALL orders where actual_delivery_cost is not null
        // or actual_delivery_cost_cash is not null
        // and see which ones are today's.
        // It's safer to fetch all today's orders maybe?

        console.log(`Checking for date: ${today}`);

        const { data: orders, error: orderErr } = await supabase
            .from('orders')
            .select('*')

        if (orderErr) throw orderErr;

        let yeouidoTodayInputsCount = 0;

        orders.forEach(o => {
            // is it Yeouido?
            const isYeouido = o.branch_id === yeouidoBranch.id;

            let isTransferredToYeouido = false;
            if (typeof o.transfer_info === 'object' && o.transfer_info !== null) {
                isTransferredToYeouido = o.transfer_info.processBranchId === yeouidoBranch.id;

                if (o.transfer_info.processBranchName && o.transfer_info.processBranchName.includes('여의도')) {
                    isTransferredToYeouido = true;
                }
            } else if (typeof o.transfer_info === 'string') {
                try {
                    const ti = JSON.parse(o.transfer_info);
                    isTransferredToYeouido = ti.processBranchId === yeouidoBranch.id ||
                        (ti.processBranchName && ti.processBranchName.includes('여의도'));
                } catch (e) { }
            }

            const belongsToYeouido = isYeouido || isTransferredToYeouido;

            if (!belongsToYeouido) return;

            // Is it today?
            let isToday = false;
            let deliveryDate = null;
            if (typeof o.delivery_info === 'object' && o.delivery_info !== null) {
                deliveryDate = o.delivery_info.date;
            } else if (typeof o.delivery_info === 'string') {
                try {
                    const di = JSON.parse(o.delivery_info);
                    deliveryDate = di.date;
                } catch (e) { }
            }

            const createdStr = o.updated_at ? o.updated_at.substring(0, 10) : '';

            // Is there actual delivery cost input?
            const hasActualCost = (o.actual_delivery_cost !== null && o.actual_delivery_cost !== undefined) ||
                (o.actual_delivery_cost_cash !== null && o.actual_delivery_cost_cash !== undefined);

            // What does "오늘 입력" (entered today) mean? 
            // Usually it means either delivery date is today OR it was updated today. 
            // If deliveryDate === today and it has actual cost.
            if (deliveryDate === today && hasActualCost) {
                yeouidoTodayInputsCount++;
            } else if (createdStr === today && hasActualCost) {
                // might be another definition of "today's input"
                // Let's just track them.
            }
        });

        // Try another approach: just filter the data inside supabase natively for today's deliveries
        const { data: todayOrders, error: todayErr } = await supabase
            .from('orders')
            .select('*')
            .filter('delivery_info->>date', 'eq', today);

        if (todayErr) throw todayErr;

        let resultCount = 0;
        let list = [];

        todayOrders.forEach(o => {
            const isYeouido = o.branch_id === yeouidoBranch.id;

            let isTransferredToYeouido = false;
            if (typeof o.transfer_info === 'object' && o.transfer_info !== null) {
                isTransferredToYeouido = o.transfer_info.processBranchId === yeouidoBranch.id ||
                    (o.transfer_info.processBranchName && o.transfer_info.processBranchName.includes('여의도'));
            }

            const belongsToYeouido = isYeouido || isTransferredToYeouido;

            const hasActualCost = (o.actual_delivery_cost !== null) || (o.actual_delivery_cost_cash !== null);

            if (belongsToYeouido && hasActualCost) {
                resultCount++;
                list.push(o.id);
            }
        });

        console.log(`[Result] 여의도점 (이관 포함) 오늘(${today}) 배송일 기준 실제 배송비 입력 건수: ${resultCount}건`);
        console.log(`List:`, list);

    } catch (error) {
        console.error("Error executing query:", error);
    }
}

checkDeliveryCost();
