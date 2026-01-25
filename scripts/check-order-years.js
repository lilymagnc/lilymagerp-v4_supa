const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error('.env.local file not found');
    process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderYears() {
    console.log('Checking order distribution by year...');

    // Fetch all order dates
    const { data, error } = await supabase
        .from('orders')
        .select('order_date');

    if (error) {
        console.error('Error fetching orders:', error);
        return;
    }

    console.log(`Total orders found: ${data.length}`);

    const yearCounts = {};
    const invalidDates = [];

    data.forEach(order => {
        if (!order.order_date) {
            yearCounts['null'] = (yearCounts['null'] || 0) + 1;
            return;
        }

        try {
            const date = new Date(order.order_date);
            if (isNaN(date.getTime())) {
                invalidDates.push(order.order_date);
            } else {
                const year = date.getFullYear();
                yearCounts[year] = (yearCounts[year] || 0) + 1;
            }
        } catch (e) {
            invalidDates.push(order.order_date);
        }
    });

    console.log('\nOrders per Year:');
    Object.keys(yearCounts).sort().forEach(year => {
        console.log(`${year}: ${yearCounts[year]} orders`);
    });

    if (invalidDates.length > 0) {
        console.log(`\nInvalid dates found (${invalidDates.length}):`);
        console.log(invalidDates.slice(0, 5));
    }
}

checkOrderYears();
