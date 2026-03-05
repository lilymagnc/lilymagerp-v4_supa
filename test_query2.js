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
        const { data: branches, error: branchErr } = await supabase.from('branches').select('*');
        if (branchErr) throw branchErr;

        const yeouidoBranches = branches.filter(b => b.name.includes('여의도'));
        const yeouidoBranchIds = yeouidoBranches.map(b => b.id);

        const today = '2026-03-05';

        // We should search orders that match the branch ID or where transfer_info -> processBranchName includes 여의도
        const { data: todayOrders, error: todayErr } = await supabase
            .from('orders')
            .select('*')
            .filter('delivery_info->>date', 'eq', today);

        if (todayErr) throw todayErr;

        let resultCount = 0;

        todayOrders.forEach(o => {
            const isYeouido = yeouidoBranchIds.includes(o.branch_id);

            let isTransferredToYeouido = false;
            let ti = o.transfer_info;
            if (typeof ti === 'string') {
                try { ti = JSON.parse(ti); } catch (e) { }
            }
            if (typeof ti === 'object' && ti !== null) {
                isTransferredToYeouido = yeouidoBranchIds.includes(ti.processBranchId) ||
                    (ti.processBranchName && ti.processBranchName.includes('여의도'));
            }

            const belongsToYeouido = isYeouido || isTransferredToYeouido;
            const hasActualCost = (o.actual_delivery_cost !== null && o.actual_delivery_cost !== undefined) ||
                (o.actual_delivery_cost_cash !== null && o.actual_delivery_cost_cash !== undefined);

            if (belongsToYeouido && hasActualCost) {
                resultCount++;
            }
        });

        console.log(`[Result] 여의도점 배송일 기준 실제 배송비 입력 건수: ${resultCount}건`);

    } catch (error) {
        console.error("Error executing query:", error);
    }
}

checkDeliveryCost();
