
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPaymentStatus() {
    console.log('--- Checking Payment Status for Jan 2026 Orders ---');

    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('id, payment, status')
            .gte('order_date', '2025-12-31T15:00:00Z')
            .lte('order_date', '2026-01-31T14:59:59Z')
            .range(from, from + 999);
        if (error) break;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }

    const payStats = {};
    all.forEach(o => {
        const pStatus = o.payment?.status || 'missing';
        payStats[pStatus] = (payStats[pStatus] || 0) + 1;
    });

    console.log(payStats);
    process.exit(0);
}

checkPaymentStatus();
