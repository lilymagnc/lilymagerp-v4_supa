require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    const { data, error } = await supabase
        .from('material_requests')
        .select('id, request_number, branch_id, branch_name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== Recent Material Requests ===');
    data.forEach(r => {
        console.log(`${r.request_number} | ${r.branch_name} (${r.branch_id}) | ${r.status} | ${r.created_at}`);
    });

    // Check for duplicate branch names
    const branchCounts = {};
    data.forEach(r => {
        branchCounts[r.branch_name] = (branchCounts[r.branch_name] || 0) + 1;
    });
    console.log('\n=== Branch Counts ===');
    Object.entries(branchCounts).forEach(([name, count]) => {
        console.log(`${name}: ${count}건`);
    });
})();
