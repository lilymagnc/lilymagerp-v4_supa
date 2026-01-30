
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { format } from 'date-fns';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findDuplicates() {
    console.log('Fetching orders for January 2026...');

    const start = '2026-01-01T00:00:00';
    const end = '2026-01-31T23:59:59';

    let allOrders: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .gte('order_date', start)
            .lte('order_date', end)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching orders:', error);
            return;
        }

        if (data && data.length > 0) {
            allOrders = [...allOrders, ...data];
            if (data.length < pageSize) hasMore = false;
            else page++;
        } else {
            hasMore = false;
        }
    }

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Identification logic
    // Potential duplicates: Same branch, same orderer name, same total price, and close order_date (within 2 mins)
    const groups: Record<string, any[]> = {};

    allOrders.forEach(order => {
        const ordererName = order.orderer?.name || 'Unknown';
        const totalPrice = order.summary?.total || 0;
        const branch = order.branch_name || 'Unknown';
        const itemsDescription = (order.items || []).map((i: any) => `${i.name}x${i.quantity}`).sort().join(',');

        // Key based on stable fields
        const key = `${branch}|${ordererName}|${totalPrice}|${itemsDescription}`;

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(order);
    });

    const duplicateCandidates: any[] = [];

    for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
            // Further filter by time proximity
            group.sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

            for (let i = 0; i < group.length - 1; i++) {
                const timeDiff = Math.abs(new Date(group[i].order_date).getTime() - new Date(group[i + 1].order_date).getTime());
                // If within 2 minutes (120,000 ms), consider it suspicious
                if (timeDiff <= 120000) {
                    duplicateCandidates.push({
                        reason: 'Similar content and close timing',
                        order1: { id: group[i].id, num: group[i].order_number, date: group[i].order_date, status: group[i].status },
                        order2: { id: group[i + 1].id, num: group[i + 1].order_number, date: group[i + 1].order_date, status: group[i + 1].status },
                        content: key
                    });
                }
            }
        }
    }

    // Also check for duplicate order_numbers if they exist
    const numMap: Record<string, any[]> = {};
    allOrders.forEach(order => {
        if (order.order_number) {
            if (!numMap[order.order_number]) numMap[order.order_number] = [];
            numMap[order.order_number].push(order);
        }
    });

    for (const num in numMap) {
        if (numMap[num].length > 1) {
            duplicateCandidates.push({
                reason: 'Duplicate order numbers',
                orders: numMap[num].map(o => ({ id: o.id, date: o.order_date, status: o.status }))
            });
        }
    }

    console.log('\n--- Duplicate Candidates Found ---');
    console.log(JSON.stringify(duplicateCandidates, null, 2));
}

findDuplicates();
