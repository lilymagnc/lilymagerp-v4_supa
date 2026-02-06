
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Config
const firebaseServiceAccount = require('./firebase-service-account.json');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role for admin actions

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseServiceAccount)
    });
}
const db = admin.firestore();
const supabase = createClient(supabaseUrl, supabaseKey);

// Fields mapping from firebase-sync.ts
const fieldMap = {
    orderNumber: 'order_number',
    receiptType: 'receipt_type',
    branchId: 'branch_id',
    branchName: 'branch_name',
    orderDate: 'order_date',
    deliveryInfo: 'delivery_info',
    pickupInfo: 'pickup_info',
    transferInfo: 'transfer_info',
    actualDeliveryCost: 'actual_delivery_cost',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    completedAt: 'completed_at',
    completedBy: 'completed_by',
    cancelReason: 'cancel_reason',
};

const convertValue = (val) => {
    if (!val) return val;
    if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString();
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) return val.map(convertValue);
    if (typeof val === 'object') {
        const newObj = {};
        for (const key in val) newObj[key] = convertValue(val[key]);
        return newObj;
    }
    return val;
};

const allowedColumns = ['id', 'order_number', 'status', 'receipt_type', 'branch_id', 'branch_name', 'order_date', 'orderer', 'delivery_info', 'pickup_info', 'summary', 'payment', 'items', 'memo', 'transfer_info', 'outsource_info', 'actual_delivery_cost', 'actual_delivery_cost_cash', 'delivery_cost_status', 'delivery_cost_updated_at', 'delivery_cost_updated_by', 'delivery_cost_reason', 'delivery_profit', 'created_at', 'updated_at', 'completed_at', 'completed_by', 'extra_data'];

function transformOrder(fbId, fbData) {
    const payload = { id: fbId };
    const extraData = {};

    for (const [key, value] of Object.entries(fbData)) {
        const pgKey = fieldMap[key] || key;
        let converted = convertValue(value);

        if (allowedColumns.includes(pgKey) && pgKey !== 'extra_data') {
            payload[pgKey] = converted;
        } else {
            extraData[pgKey] = converted;
        }
    }

    if (payload.outsource_info) {
        extraData.outsource_info = payload.outsource_info;
        delete payload.outsource_info;
    }

    payload.extra_data = {
        ...(convertValue(fbData.extra_data || fbData.extraData || {})),
        ...extraData
    };

    return payload;
}

async function getAllSupabaseOrders(start, end) {
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .gte('order_date', start.toISOString())
            .lte('order_date', end.toISOString())
            .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }
    return all;
}

async function run() {
    console.log('🚀 Deep Analysis and Fix for January 2026 Data...');

    const start = new Date('2025-12-31T15:00:00Z');
    const end = new Date('2026-01-31T14:59:59Z');

    // 1. Fetch data
    const fbSnap = await db.collection('orders')
        .where('orderDate', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('orderDate', '<=', admin.firestore.Timestamp.fromDate(end))
        .get();

    const fbOrders = [];
    fbSnap.forEach(doc => fbOrders.push({ id: doc.id, ...doc.data() }));

    const sbOrders = await getAllSupabaseOrders(start, end);

    console.log(`- Firebase count: ${fbOrders.length}`);
    console.log(`- Supabase count: ${sbOrders.length}`);

    const branches = [...new Set(fbOrders.map(o => o.branchName || 'Unknown'))];
    const report = {};
    branches.forEach(b => {
        report[b] = {
            fbCount: 0,
            sbCount: 0,
            statusMismatches: [],
            missingInSB: [],
            ghostsInSB: [],
            potentialDupes: []
        };
    });

    // Maps for fast lookup
    const fbMap = new Map(fbOrders.map(o => [o.id, o]));
    const sbMap = new Map(sbOrders.map(o => [o.id, o]));

    // Identify Status Mismatches and Missing in SB
    for (const fo of fbOrders) {
        const b = fo.branchName || 'Unknown';
        if (!report[b]) report[b] = { fbCount: 0, sbCount: 0, statusMismatches: [], missingInSB: [], ghostsInSB: [], potentialDupes: [] };
        report[b].fbCount++;

        const so = sbMap.get(fo.id);
        if (!so) {
            report[b].missingInSB.push(fo.id);
        } else if (fo.status !== so.status) {
            report[b].statusMismatches.push({ id: fo.id, fb: fo.status, sb: so.status });
        }
    }

    // Identify Ghosts in SB
    for (const so of sbOrders) {
        const b = so.branch_name || 'Unknown';
        if (!report[b]) report[b] = { fbCount: 0, sbCount: 0, statusMismatches: [], missingInSB: [], ghostsInSB: [], potentialDupes: [] };
        report[b].sbCount++;

        if (!fbMap.has(so.id)) {
            report[b].ghostsInSB.push(so.id);
        }
    }

    // Duplicate Analysis in FB
    branches.forEach(b => {
        const fbInBranch = fbOrders.filter(o => o.branchName === b);
        const fbByFingerprint = new Map();
        fbInBranch.forEach(o => {
            const dateStr = o.orderDate?.toDate().toISOString().split('T')[0];
            const fingerprint = `${dateStr}|${o.summary?.total}|${o.orderer?.name}`;
            if (!fbByFingerprint.has(fingerprint)) fbByFingerprint.set(fingerprint, []);
            fbByFingerprint.get(fingerprint).push(o);
        });
        fbByFingerprint.forEach((list, fp) => {
            if (list.length > 1) {
                report[b].potentialDupes.push({ fingerprint: fp, ids: list.map(l => l.id) });
            }
        });
    });

    // Print Analysis Result
    console.log('\n--- Analysis Result by Branch ---');
    for (const b of Object.keys(report).sort()) {
        const r = report[b];
        console.log(`📍 [${b}]`);
        console.log(`  - FB Orders: ${r.fbCount}, SB Orders: ${r.sbCount}`);
        if (r.statusMismatches.length > 0) console.log(`  - Status Mismatches: ${r.statusMismatches.length}`);
        if (r.missingInSB.length > 0) console.log(`  - Missing in SB: ${r.missingInSB.length}`);
        if (r.ghostsInSB.length > 0) console.log(`  - Ghost records in SB: ${r.ghostsInSB.length} ids: ${r.ghostsInSB.join(', ')}`);
        if (r.potentialDupes.length > 0) console.log(`  - Potential FB Duplicates (Groups): ${r.potentialDupes.length}`);
    }

    // --- APPLY FIXES ---
    console.log('\n--- Applying Fixes ---');

    // 1. Update Status Mismatches
    let statusUpserts = [];
    for (const b of Object.keys(report)) {
        for (const m of report[b].statusMismatches) {
            const fo = fbMap.get(m.id);
            statusUpserts.push(transformOrder(m.id, fo));
        }
    }
    if (statusUpserts.length > 0) {
        console.log(`Updating ${statusUpserts.length} statuses in Supabase...`);
        const { error } = await supabase.from('orders').upsert(statusUpserts);
        if (error) console.error('Status Update Error:', error);
        else console.log('Successfully updated statuses.');
    }

    // 2. Sync Missing Records
    let missingUpserts = [];
    for (const b of Object.keys(report)) {
        for (const id of report[b].missingInSB) {
            missingUpserts.push(transformOrder(id, fbMap.get(id)));
        }
    }
    if (missingUpserts.length > 0) {
        console.log(`Syncing ${missingUpserts.length} missing orders to Supabase...`);
        const { error } = await supabase.from('orders').upsert(missingUpserts);
        if (error) console.error('Missing Sync Error:', error);
        else console.log('Successfully synced missing records.');
    }

    // 3. Delete Ghosts
    let ghostIds = [];
    for (const b of Object.keys(report)) {
        ghostIds = ghostIds.concat(report[b].ghostsInSB);
    }
    if (ghostIds.length > 0) {
        console.log(`Deleting ${ghostIds.length} ghost records from Supabase...`);
        const { error } = await supabase.from('orders').delete().in('id', ghostIds);
        if (error) console.error('Ghost Delete Error:', error);
        else console.log('Successfully deleted ghost records.');
    }

    console.log('\n✅ All fixes applied. Please check the dashboard.');
    process.exit(0);
}

run().catch(console.error);
