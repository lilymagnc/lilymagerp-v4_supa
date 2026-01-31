
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Initialize Firebase
if (!admin.apps.length) {
    // Try to find the service account key
    const possiblePaths = [
        path.resolve(process.cwd(), 'secrets/firebase-admin-key.json'),
        path.resolve(process.cwd(), 'service-account.json'),
        process.env.GOOGLE_APPLICATION_CREDENTIALS
    ];

    let serviceAccountPath = possiblePaths.find(p => p && fs.existsSync(p));

    if (serviceAccountPath) {
        console.log(`Loading Firebase creds from: ${serviceAccountPath}`);
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else {
        console.error('No Firebase service account found!');
        process.exit(1);
    }
}

const db = admin.firestore();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function compareStats() {
    console.log('Starting Comparison: Firebase (v3) vs Supabase (v4)...');

    // 1. Firebase Stats (2026)
    console.log('\n--- Firebase (v3) Analysis (2026) ---');
    const fbSnapshot = await db.collection('orders').get();
    let fbTotalRevenue = 0;
    let fbOrderCount = 0;
    let fbPendingCount = 0;
    const fbOrderIds = new Set();

    // For customers
    const fbCustSnapshot = await db.collection('customers').where('isDeleted', '!=', true).get();
    const fbCustomerCount = fbCustSnapshot.size;

    fbSnapshot.docs.forEach(doc => {
        const data = doc.data();
        // Check date (2026 only)
        // Date format might be string YYYY-MM-DD or Timestamp
        let orderDate = '';
        if (data.orderDate) {
            if (typeof data.orderDate === 'string') orderDate = data.orderDate;
            else if (data.orderDate.toDate) orderDate = data.orderDate.toDate().toISOString().split('T')[0];
        }

        if (orderDate.startsWith('2026')) {
            const status = data.status || '';
            const total = (data.summary?.total) || 0;

            // Exclude cancelled/deleted?
            // Usually dashboard excludes cancelled but usually shows 'total orders' as all count
            // Let's assume 'Revenue' excludes cancelled.

            fbOrderCount++;
            fbOrderIds.add(doc.id);

            if (status !== 'cancelled' && status !== '취소') {
                fbTotalRevenue += Number(total);
            }

            if (['pending', '대기', 'processing', '처리중'].includes(status)) {
                fbPendingCount++;
            }
        }
    });

    console.log(`Firebase (2025):`);
    console.log(`- Revenue: ${fbTotalRevenue.toLocaleString()} (Excluding cancelled)`);
    console.log(`- Total Orders: ${fbOrderCount}`);
    console.log(`- Pending Orders: ${fbPendingCount}`);
    console.log(`- Active Customers: ${fbCustomerCount} (Total in DB)`);


    // 2. Supabase Stats (2026)
    console.log('\n--- Supabase (v4) Analysis (2026) ---');

    // Fetch all orders (pagination might be needed if huge, but let's try pushing limits)
    // Actually Supabase JS client default limit is 1000. We need more.
    let allSupaOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_date, status, summary, created_at')
            .gte('order_date', '2026-01-01')
            .lte('order_date', '2026-12-31')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching supabase orders:', error);
            break;
        }
        if (!data || data.length === 0) break;

        allSupaOrders = [...allSupaOrders, ...data];
        if (data.length < pageSize) break;
        page++;
    }

    let supaTotalRevenue = 0;
    let supaOrderCount = 0;
    let supaPendingCount = 0;
    const supaOrderIds = new Set();

    // Breakdown
    const revenueByStatus: Record<string, number> = {};
    const countByStatus: Record<string, number> = {};

    allSupaOrders.forEach(order => {
        const status = order.status || 'unknown';
        const total = (order.summary?.total) || 0;

        supaOrderCount++;
        supaOrderIds.add(order.id);

        // Track by status
        revenueByStatus[status] = (revenueByStatus[status] || 0) + Number(total);
        countByStatus[status] = (countByStatus[status] || 0) + 1;

        if (status !== 'cancelled' && status !== '취소') {
            supaTotalRevenue += Number(total);
        }

        if (['pending', '대기', 'processing', '처리중'].includes(status)) {
            supaPendingCount++;
        }
    });

    const { count: supaCustomerCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false);

    console.log(`Supabase (2026):`);
    console.log(`- Total Revenue (All except cancelled): ${supaTotalRevenue.toLocaleString()}`);
    console.log(`- Total Orders: ${supaOrderCount}`);

    console.log('\n--- Breakdown by Status ---');
    let completedOnly = 0;
    let processingOnly = 0;

    for (const [st, rev] of Object.entries(revenueByStatus)) {
        console.log(`- ${st}: ${rev.toLocaleString()} (${countByStatus[st]} orders)`);
        if (st === 'completed' || st === '완료') completedOnly += rev;
        if (st === 'processing' || st === '처리중') processingOnly += rev;
    }

    console.log(`\nSimulation:`);
    console.log(`- Completed Only: ${completedOnly.toLocaleString()}`);
    console.log(`- Completed + Processing: ${(completedOnly + processingOnly).toLocaleString()}`);
    console.log(`- All - Pending: ${(supaTotalRevenue - (revenueByStatus['pending'] || 0) - (revenueByStatus['대기'] || 0)).toLocaleString()}`);

    // 3. Comparison
    console.log('\n--- Diff ---');
    console.log(`Revenue Diff: ${(supaTotalRevenue - fbTotalRevenue).toLocaleString()}`);
    console.log(`Order Count Diff: ${supaOrderCount - fbOrderCount}`);

    // Find extra IDs in Supabase
    const extraInSupa = [...supaOrderIds].filter(id => !fbOrderIds.has(id));
    // Find missing IDs in Supabase
    const missingInSupa = [...fbOrderIds].filter(id => !supaOrderIds.has(id));

    if (extraInSupa.length > 0) {
        console.log(`\nids found only in Supabase (${extraInSupa.length}):`, extraInSupa.slice(0, 5), '...');
    }
    if (missingInSupa.length > 0) {
        console.log(`\nids missing in Supabase (${missingInSupa.length}):`, missingInSupa.slice(0, 5), '...');
    }
}

compareStats();
