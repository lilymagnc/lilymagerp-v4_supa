
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkDuplicates() {
    console.log('Checking for potential duplicate orders in GWANGHWAMUN branch (Jan 2026)...');

    // 1. Fetch Jan 2026 orders for '광화문'
    // branch_name might vary, so we'll fetch all and filter or use ILIKE
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id, 
            order_date, 
            created_at, 
            branch_name, 
            summary, 
            orderer, 
            payment, 
            status, 
            items,
            receipt_type
        `)
        .gte('order_date', '2026-01-01')
        .lte('order_date', '2026-01-31')
        .not('status', 'in', '("cancelled","canceled","취소","주문취소")'); // Cancelled orders usually aren't counted as duplicates causing revenue issues

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    // Filter for Gwanghwamun
    const targetBranch = '광화문'; // You might need to adjust this if exact name is different e.g. '광화문점'
    const ghOrders = orders?.filter(o => (o.branch_name || '').includes(targetBranch)) || [];

    console.log(`Total orders found for ${targetBranch}: ${ghOrders.length}`);

    // 2. Analyze for duplicates
    // Criteria: Same orderer name AND Same Amount AND (Time diff < 5 mins OR Same Items)

    const suspects: any[] = [];

    // Sort by time to easily compare neighbors
    ghOrders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (let i = 0; i < ghOrders.length; i++) {
        const current = ghOrders[i];

        for (let j = i + 1; j < ghOrders.length; j++) {
            const next = ghOrders[j];

            // Time Check (e.g. within 10 minutes)
            const timeDiffMs = Math.abs(new Date(next.created_at).getTime() - new Date(current.created_at).getTime());
            const minutesDiff = timeDiffMs / (1000 * 60);

            if (minutesDiff > 60) break; // Optimization: Don't compare with orders far apart (e.g. > 1 hour)

            // Similarity Check
            const isSameName = current.orderer?.name === next.orderer?.name;
            const isSameAmount = (current.summary?.total || 0) === (next.summary?.total || 0);
            const isSameItemCount = (current.items?.length || 0) === (next.items?.length || 0);

            // Strong Suspicion: Name + Amount + Short Time
            if (isSameName && isSameAmount && minutesDiff < 10) {
                suspects.push({
                    type: 'High Probability (Same Name, Amount, <10min)',
                    diffMinutes: minutesDiff.toFixed(1),
                    order1: { id: current.id, time: current.created_at, name: current.orderer?.name, amount: current.summary?.total, items: current.items?.map((x: any) => x.name).join(', ') },
                    order2: { id: next.id, time: next.created_at, name: next.orderer?.name, amount: next.summary?.total, items: next.items?.map((x: any) => x.name).join(', ') }
                });
            }
            // Audit: Same Name + Same Amount (Any time - loop optimization broke this, but usually duplicates happen close together. 
            // If user meant "Double Entry" manually entered twice on different days, we should enable full scan.)
        }
    }

    // 3. Full Scan for "Double Entry" (Same Name + Same Amount + Same Items, regardless of time)
    // Only if not already caught

    // Let's just output what we found first
    if (suspects.length === 0) {
        console.log('No suspicious duplicate orders found within 10-minute windows.');
    } else {
        console.log(`Found ${suspects.length} potential duplicates!`);
        console.log(JSON.stringify(suspects, null, 2));
    }
}

checkDuplicates();
