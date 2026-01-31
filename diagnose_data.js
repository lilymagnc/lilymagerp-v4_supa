const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function diagnose() {
    console.log('--- DIAGNOSIS START ---');

    // 1. Check Supabase
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: orders, error: sbError } = await supabase
        .from('orders')
        .select('id, order_date, branch_name')
        .gte('order_date', '2026-01-26')
        .limit(10);

    if (sbError) console.error('Supabase Error:', sbError);
    else console.log(`Supabase: Found ${orders?.length || 0} orders for Jan 26+`);

    // 2. Check Firebase
    const saPath = path.resolve(process.cwd(), 'service-account.json');
    if (!fs.existsSync(saPath)) {
        console.error('Firebase: service-account.json NOT FOUND');
    } else {
        try {
            if (admin.apps.length === 0) {
                admin.initializeApp({ credential: admin.credential.cert(saPath) });
            }
            const db = admin.firestore();
            const snapshot = await db.collection('orders')
                .orderBy('orderDate', 'desc')
                .limit(5)
                .get();

            console.log(`Firebase: Found ${snapshot.size} recent orders`);
            snapshot.forEach(doc => {
                const d = doc.data();
                console.log(` - ID: ${doc.id}, orderDate: ${d.orderDate}, order_date: ${d.order_date}`);
            });

            // Specifically look for Jan 26
            const jan26 = await db.collection('orders')
                .where('orderDate', '>=', '2026-01-26')
                .where('orderDate', '<=', '2026-01-26 23:59:59')
                .get();
            console.log(`Firebase: Found ${jan26.size} orders specifically for Jan 26`);

        } catch (e) {
            console.error('Firebase Error:', e.message);
        }
    }
    console.log('--- DIAGNOSIS END ---');
}

diagnose();
