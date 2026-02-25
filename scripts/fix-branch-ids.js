require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 매핑: 잘못된 과거 ID → 올바른 현재 ID
const branchIdFixes = [
    // 광화문점
    { oldId: 'LN2M42Z2IEG8kFFALbJ2', newId: 'thiLOPFWSRgKKtwNcPCn', name: '릴리맥광화문점' },
    { oldId: 'branch-001', newId: 'thiLOPFWSRgKKtwNcPCn', name: '릴리맥광화문점' },
    // NC이스트폴점
    { oldId: 'Uja495fBk1FgwY2m86AX', newId: 'suJfVzUmP9n3umm8Qv5O', name: '릴리맥NC이스트폴점' },
    // 여의도점
    { oldId: '9HASGq6nsLhsLz2edAB8', newId: 'ztewxOfLrno5mEzTKSNT', name: '릴리맥여의도점' },
];

(async () => {
    console.log('=== Fixing branch IDs in material_requests ===\n');

    for (const fix of branchIdFixes) {
        // 해당 old ID를 가진 레코드 수 확인
        const { count } = await supabase
            .from('material_requests')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', fix.oldId);

        console.log(`${fix.name}: ${fix.oldId} → ${fix.newId} (${count}건 대상)`);

        if (count > 0) {
            const { data, error } = await supabase
                .from('material_requests')
                .update({ branch_id: fix.newId })
                .eq('branch_id', fix.oldId)
                .select('request_number, branch_name, branch_id');

            if (error) {
                console.log(`  ❌ Error: ${error.message}`);
            } else {
                console.log(`  ✅ Updated ${data.length}건`);
                data.forEach(r => console.log(`    - ${r.request_number} → ${r.branch_id}`));
            }
        } else {
            console.log(`  ⏭️ Skip (no records)`);
        }
    }

    // 최종 확인
    console.log('\n=== VERIFICATION ===');
    const { data: verify } = await supabase
        .from('material_requests')
        .select('branch_id, branch_name')
        .order('created_at', { ascending: false });

    const result = {};
    verify?.forEach(r => {
        const key = `${r.branch_name} (${r.branch_id})`;
        result[key] = (result[key] || 0) + 1;
    });
    Object.entries(result).forEach(([key, count]) => {
        console.log(`${key}: ${count}건`);
    });
})();
