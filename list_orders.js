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

async function listDeliveryCostOrders() {
    const today = '2026-03-05';

    const { data: branches, error: branchErr } = await supabase.from('branches').select('id, name');
    if (branchErr) throw branchErr;

    const yeouidoBranches = branches.filter(b => b.name.includes('여의도'));
    const yeouidoBranchIds = yeouidoBranches.map(b => b.id);

    const { data: todayOrders, error: todayErr } = await supabase
        .from('orders')
        .select('id, order_number, orderer, delivery_info, branch_id, branch_name, actual_delivery_cost, actual_delivery_cost_cash, transfer_info')
        .filter('delivery_info->>date', 'eq', today);

    if (todayErr) throw todayErr;

    let resultList = [];

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
        const tCost = (o.actual_delivery_cost || 0) + (o.actual_delivery_cost_cash || 0);

        if (belongsToYeouido && tCost > 0) {
            const recipientName = (o.delivery_info && o.delivery_info.recipientName) || (o.orderer && o.orderer.name) || '미지정';
            const affiliation = (o.delivery_info && o.delivery_info.driverAffiliation) || '';
            const driver = (o.delivery_info && o.delivery_info.driverName) || '';
            const driverInfo = `${affiliation} ${driver}`.trim() || '미지정';

            resultList.push({
                id: o.id,
                order_number: o.order_number,
                recipient: recipientName,
                cost: Number(o.actual_delivery_cost || 0),
                cash: Number(o.actual_delivery_cost_cash || 0),
                branch: o.branch_name,
                process_branch: isTransferredToYeouido && ti ? ti.processBranchName : o.branch_name,
                driver: driverInfo
            });
        }
    });

    console.log(JSON.stringify(resultList, null, 2));
}

listDeliveryCostOrders();
