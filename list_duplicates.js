
const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

const firebaseServiceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseServiceAccount)
    });
}
const db = admin.firestore();

async function analyze() {
    console.log('🔍 Detailed Duplicate Analysis for January 2026...');
    const start = new Date('2025-12-31T15:00:00Z');
    const end = new Date('2026-01-31T14:59:59Z');

    const fbSnap = await db.collection('orders')
        .where('orderDate', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('orderDate', '<=', admin.firestore.Timestamp.fromDate(end))
        .get();

    const orders = [];
    fbSnap.forEach(doc => orders.push({ id: doc.id, ...doc.data() }));

    const dupes = [];
    const groups = new Map();

    orders.forEach(o => {
        // Fingerprint: Date + Name + Total + Branch + Items Count + First Item Name
        const dateStr = o.orderDate?.toDate().toISOString().split('T')[0];
        const name = o.orderer?.name || 'NoName';
        const total = o.summary?.total || 0;
        const branch = o.branchName || 'NoBranch';
        const itemsCount = o.items?.length || 0;
        const firstItem = (o.items && o.items[0]?.name) || 'NoItem';

        const fingerprint = `${dateStr}|${name}|${total}|${branch}|${itemsCount}|${firstItem}`;

        if (!groups.has(fingerprint)) groups.set(fingerprint, []);
        groups.get(fingerprint).push(o);
    });

    let totalDupeDocs = 0;
    groups.forEach((list, fp) => {
        if (list.length > 1) {
            totalDupeDocs += list.length;
            dupes.push({
                fingerprint: fp,
                count: list.length,
                orders: list.map(o => ({
                    id: o.id,
                    orderNumber: o.orderNumber,
                    status: o.status,
                    time: o.orderDate?.toDate().toISOString()
                }))
            });
        }
    });

    console.log(`Total Duplicate Groups: ${dupes.length}`);
    console.log(`Total Documents involved in Duplicates: ${totalDupeDocs}`);

    // Print top 20 suspicious groups
    console.log('\n--- Top 20 Suspicious Duplicate Groups ---');
    dupes.slice(0, 20).forEach((d, i) => {
        console.log(`${i + 1}. [${d.fingerprint}] (${d.count} docs)`);
        d.orders.forEach(o => console.log(`   - ID: ${o.id}, Num: ${o.orderNumber}, Status: ${o.status}, Time: ${o.time}`));
    });

    process.exit(0);
}

analyze();
