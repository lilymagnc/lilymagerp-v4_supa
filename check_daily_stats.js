
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStats() {
    console.log('--- Checking Supabase daily_stats for January 2026 ---');
    const { data, error } = await supabase
        .from('daily_stats')
        .select('*')
        .gte('date', '2026-01-01')
        .lte('date', '2026-01-31')
        .order('date', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    let totalRevenue = 0;
    data.forEach(row => {
        console.log(`${row.date}: ${row.total_revenue?.toLocaleString()}`);
        totalRevenue += (row.total_revenue || 0);
    });

    console.log(`\nTotal revenue from daily_stats: ${totalRevenue.toLocaleString()}`);
    process.exit(0);
}

checkStats();
