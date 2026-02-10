
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const ORDER_ID = 'i0LhZ0qiSsFov30VMfwT';

async function inspectOrder() {
    console.log(`Inspecting order ${ORDER_ID}...`);

    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', ORDER_ID)
        .single();

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }

    if (!order) {
        console.log('Order not found.');
        return;
    }

    console.log('Order Data:');
    console.log(JSON.stringify(order, null, 2));

    // Check relevant fields for "Future Schedule"
    console.log('\n--- Analysis ---');
    console.log('Order Date (order_date):', order.order_date);
    console.log('Status:', order.status);
    console.log('Receipt Type:', order.receipt_type);

    let eventDate = null;
    if (order.receipt_type === 'delivery' || order.receipt_type === 'delivery_reservation') {
        eventDate = order.delivery_info?.date;
        console.log('Delivery Date:', eventDate);
    } else if (order.receipt_type === 'pickup' || order.receipt_type === 'pickup_reservation') {
        eventDate = order.pickup_info?.date;
        console.log('Pickup Date:', eventDate);
    } else {
        console.log('Other Receipt Type:', order.receipt_type);
        // Fallback or immediate?
    }

    const today = new Date().toISOString().split('T')[0];
    console.log('Today:', today);

    if (eventDate) {
        if (eventDate < today) {
            console.log('Is Past:', true);
        } else {
            console.log('Is Future/Today:', true);
        }
    } else {
        console.log('No specific event date found in delivery/pickup info.');
    }
}

inspectOrder();
