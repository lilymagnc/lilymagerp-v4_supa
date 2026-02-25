require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    // 1. branches 테이블 전체 조회
    const { data: branches, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== ALL BRANCHES ===');
    console.log(`Total: ${branches.length}개\n`);

    branches.forEach(b => {
        console.log(`ID: ${b.id}`);
        console.log(`  Name: ${b.name}`);
        console.log(`  Type: ${b.type || 'N/A'}`);
        console.log(`  Address: ${b.address || 'N/A'}`);
        console.log(`  Phone: ${b.phone || 'N/A'}`);
        console.log(`  Created: ${b.created_at}`);
        console.log('---');
    });

    // 2. 이름별 중복 체크
    const nameCount = {};
    branches.forEach(b => {
        nameCount[b.name] = (nameCount[b.name] || []);
        nameCount[b.name].push(b.id);
    });

    console.log('\n=== DUPLICATE CHECK ===');
    Object.entries(nameCount).forEach(([name, ids]) => {
        if (ids.length > 1) {
            console.log(`❌ DUPLICATE: "${name}" - ${ids.length}개 (IDs: ${ids.join(', ')})`);
        } else {
            console.log(`✅ OK: "${name}" - 1개`);
        }
    });

    // 3. material_requests에서 사용중인 branch_id 확인
    const { data: usedBranches } = await supabase
        .from('material_requests')
        .select('branch_id, branch_name')
        .order('created_at', { ascending: false });

    console.log('\n=== BRANCH IDs USED IN MATERIAL REQUESTS ===');
    const usedIds = {};
    usedBranches?.forEach(r => {
        const key = `${r.branch_name} (${r.branch_id})`;
        usedIds[key] = (usedIds[key] || 0) + 1;
    });
    Object.entries(usedIds).forEach(([key, count]) => {
        console.log(`${key}: ${count}건`);
    });

    // 4. orders에서 사용중인 branch 확인
    const { data: usedInOrders } = await supabase
        .from('orders')
        .select('branch')
        .limit(100);

    const orderBranches = {};
    usedInOrders?.forEach(o => {
        orderBranches[o.branch] = (orderBranches[o.branch] || 0) + 1;
    });
    console.log('\n=== BRANCH NAMES USED IN ORDERS (sample) ===');
    Object.entries(orderBranches).forEach(([name, count]) => {
        console.log(`${name}: ${count}건`);
    });
})();
