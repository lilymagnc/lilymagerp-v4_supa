require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
    // 여의도점 branch_id 조회
    const { data: yeouido } = await supabase
        .from('branches')
        .select('id, name')
        .ilike('name', '%여의도%')
        .limit(1)
        .maybeSingle();

    console.log('여의도점 정보:', yeouido);

    if (!yeouido) {
        console.error('여의도점을 찾을 수 없습니다.');
        return;
    }

    // REQ-20260225-168355 (광화문점 두 번째 건)를 여의도점으로 변경
    const targetRequestNumber = 'REQ-20260225-168355';

    const { data, error } = await supabase
        .from('material_requests')
        .update({
            branch_id: yeouido.id,
            branch_name: yeouido.name
        })
        .eq('request_number', targetRequestNumber)
        .select('id, request_number, branch_name, branch_id');

    if (error) {
        console.error('Error updating:', error);
    } else {
        console.log('Updated successfully:', data);
    }

    // 확인
    const { data: verify } = await supabase
        .from('material_requests')
        .select('request_number, branch_name, branch_id, status')
        .in('status', ['submitted', 'reviewing'])
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('\n=== Active Requests (submitted/reviewing) ===');
    verify?.forEach(r => {
        console.log(`${r.request_number} | ${r.branch_name} | ${r.status}`);
    });
})();
