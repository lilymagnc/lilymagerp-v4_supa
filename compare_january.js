
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

async function compare() {
    console.log('Comparing January 2026 Orders...');

    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-31T23:59:59Z');

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

    // 2. Fetch Supabase Orders
    const { data: sbOrders, error: sbError } = await supabase
        .from('orders')
        .select('*')
        .gte('order_date', start.toISOString())
        .lte('order_date', end.toISOString());

    if (sbError) {
        console.error('Supabase Error:', sbError);
        return;
    }

    console.log(`Supabase January Orders: ${sbOrders.length}`);

    // 3. Totals
    const fbTotal = fbOrders.reduce((sum, o) => sum + (o.summary?.total || 0), 0);
    const sbTotal = sbOrders.reduce((sum, o) => sum + (o.summary?.total || 0), 0);

    console.log(`Firebase Total Revenue: ${fbTotal.toLocaleString()}`);
    console.log(`Supabase Total Revenue: ${sbTotal.toLocaleString()}`);

    // 4. Find Missing IDs
    const fbIds = new Set(fbOrders.map(o => o.id));
    const sbIds = new Set(sbOrders.map(o => o.id));

    const missingInSB = fbOrders.filter(o => !sbIds.has(o.id));
    const missingInFB = sbOrders.filter(o => !fbIds.has(o.id));

    console.log(`Missing in Supabase: ${missingInSB.length}`);
    console.log(`Missing in Firebase: ${missingInFB.length}`);

    // 5. Check for Duplicates by orderNumber (if exists)
    const fbOrderNums = {};
    fbOrders.forEach(o => {
        if (o.orderNumber) {
            fbOrderNums[o.orderNumber] = (fbOrderNums[o.orderNumber] || 0) + 1;
        }
    });
    const fbDupes = Object.entries(fbOrderNums).filter(([num, count]) => count > 1);
    console.log(`Firebase OrderNumber Duplicates: ${fbDupes.length}`);

    if (fbDupes.length > 0) {
        console.log('Sample FB Duplicates:', fbDupes.slice(0, 5));
        // Investigate one dupe pair
        const dupeNum = fbDupes[0][0];
        const samples = fbOrders.filter(o => o.orderNumber === dupeNum);
        console.log(`Sample Duplicate Analysis for ${dupeNum}:`);
        samples.forEach(s => {
            console.log(`ID: ${s.id}, Date: ${s.orderDate?.toDate().toISOString()}, Total: ${s.summary?.total}, Status: ${s.status}`);
        });
    }

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
