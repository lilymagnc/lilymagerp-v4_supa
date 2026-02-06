
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// Config
const firebaseServiceAccount = require('./firebase-service-account.json');
const supabaseUrl = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

// Initialize
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseServiceAccount)
    });
}
const db = admin.firestore();
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllSupabaseOrders(start, end) {
    let all = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .gte('order_date', start.toISOString())
            .lte('order_date', end.toISOString())
            .range(from, from + step - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < step) break;
        from += step;
    }
    return all;
}

async function compare() {
    console.log('Comparing January 2026 Orders (KST aware)...');

    // KST: 2026-01-01 00:00:00 ~ 2026-01-31 23:59:59
    const start = new Date('2025-12-31T15:00:00Z');
    const end = new Date('2026-01-31T14:59:59Z');

    // 1. Fetch Firebase Orders
    const fbSnap = await db.collection('orders')
        .where('orderDate', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('orderDate', '<=', admin.firestore.Timestamp.fromDate(end))
        .get();

    const fbOrders = [];
    fbSnap.forEach(doc => {
        fbOrders.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Firebase January Orders: ${fbOrders.length}`);

    // 2. Fetch Supabase Orders (all)
    const sbOrders = await getAllSupabaseOrders(start, end);
    console.log(`Supabase January Orders: ${sbOrders.length}`);

    // 3. Status Breakdown
    const fbStats = {};
    let fbTotalRevenue = 0;
    fbOrders.forEach(o => {
        const status = o.status || 'unknown';
        fbStats[status] = (fbStats[status] || 0) + 1;
        if (status !== 'canceled' && status !== '취소') {
            fbTotalRevenue += (o.summary?.total || 0);
        }
    });

    const sbStats = {};
    let sbTotalRevenue = 0;
    sbOrders.forEach(o => {
        const status = o.status || 'unknown';
        sbStats[status] = (sbStats[status] || 0) + 1;
        if (status !== 'canceled' && status !== '취소') {
            sbTotalRevenue += (o.summary?.total || 0);
        }
    });

    console.log('\n--- Status Breakdown ---');
    console.log('Firebase:', fbStats);
    console.log('Supabase:', sbStats);

    console.log(`\nFirebase Total Revenue (All): ${fbOrders.reduce((sum, o) => sum + (o.summary?.total || 0), 0).toLocaleString()}`);
    console.log(`Supabase Total Revenue (All): ${sbOrders.reduce((sum, o) => sum + (o.summary?.total || 0), 0).toLocaleString()}`);

    console.log(`\nFirebase Revenue (Excl. Canceled): ${fbTotalRevenue.toLocaleString()}`);
    console.log(`Supabase Revenue (Excl. Canceled): ${sbTotalRevenue.toLocaleString()}`);
    console.log(`Difference (Active): ${(fbTotalRevenue - sbTotalRevenue).toLocaleString()}`);

    // 4. Find Missing IDs
    const fbIds = new Set(fbOrders.map(o => o.id));
    const sbIds = new Set(sbOrders.map(o => o.id));

    const missingInSB = fbOrders.filter(o => !sbIds.has(o.id));
    const missingInFB = sbOrders.filter(o => !fbIds.has(o.id));

    console.log(`Missing in Supabase: ${missingInSB.length}`);
    console.log(`Missing in Firebase: ${missingInFB.length}`);

    if (missingInSB.length > 0) {
        console.log('\nOrders in Firebase but NOT in Supabase:');
        missingInSB.forEach(o => {
            console.log(`- ID: ${o.id}, OrderNum: ${o.orderNumber}, Name: ${o.orderer?.name}, Date: ${o.orderDate?.toDate().toISOString()}`);
        });
    }

    if (missingInFB.length > 0) {
        console.log('\nOrders in Supabase but NOT in Firebase:');
        missingInFB.forEach(o => {
            console.log(`- ID: ${o.id}, OrderNum: ${o.order_number}, Name: ${o.orderer?.name}, Date: ${o.order_date}`);
        });
    }

    // 5. Check for Status Mismatches
    console.log('\n--- Status Mismatches (Common IDs) ---');
    let mismatchCount = 0;
    fbOrders.forEach(fo => {
        const so = sbOrders.find(s => s.id === fo.id);
        if (so) {
            if (fo.status !== so.status) {
                mismatchCount++;
                console.log(`- ID: ${fo.id}, FB Status: ${fo.status}, SB Status: ${so.status}, Name: ${fo.orderer?.name}`);
            }
        }
    });
    console.log(`Total status mismatches: ${mismatchCount}`);

    // 6. Check for Duplicates by orderNumber
    const fbOrderNums = {};
    fbOrders.forEach(o => {
        if (o.orderNumber) {
            fbOrderNums[o.orderNumber] = (fbOrderNums[o.orderNumber] || 0) + 1;
        }
    });
    const fbDupes = Object.entries(fbOrderNums).filter(([num, count]) => count > 1);
    console.log(`Firebase OrderNumber Duplicates: ${fbDupes.length}`);

    const sbOrderNums = {};
    sbOrders.forEach(o => {
        if (o.order_number) {
            sbOrderNums[o.order_number] = (sbOrderNums[o.order_number] || 0) + 1;
        }
    });
    const sbDupes = Object.entries(sbOrderNums).filter(([num, count]) => count > 1);
    console.log(`Supabase OrderNumber Duplicates: ${sbDupes.length}`);

    process.exit(0);
}

compare().catch(error => {
    console.error(error);
    process.exit(1);
});
