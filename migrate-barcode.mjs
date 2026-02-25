import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchAll(table, select = 'id') {
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
        if (error) { console.error(`Error fetching ${table}:`, error); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        from += 1000;
    }
    return all;
}

async function main() {
    console.log('=== 바코드(ID) 단축 마이그레이션 시작 ===\n');

    // 1. 모든 materials 가져오기
    const allMaterials = await fetchAll('materials', 'id,name');
    console.log(`총 자재 수: ${allMaterials.length}`);

    // 2. 긴 ID만 필터링 (6자 초과)
    const longIdMaterials = allMaterials.filter(m => m.id.length > 6);
    console.log(`변환 대상 (긴 ID): ${longIdMaterials.length}개`);

    if (longIdMaterials.length === 0) {
        console.log('변환할 긴 ID가 없습니다. 완료!');
        return;
    }

    // 3. 현재 최대 M번호 찾기
    const shortIds = allMaterials
        .filter(m => /^M\d+$/.test(m.id))
        .map(m => parseInt(m.id.replace('M', '')));
    let nextNum = shortIds.length > 0 ? Math.max(...shortIds) + 1 : 1;
    console.log(`다음 번호 시작: M${String(nextNum).padStart(5, '0')}\n`);

    // 4. stock_history의 item_id 매핑 미리 로드
    const allHistory = await fetchAll('stock_history', 'id,item_id');
    console.log(`재고 변동 기록 수: ${allHistory.length}`);

    // 5. 배치 처리 (한 번에 1개씩 - 기본키 변경이라 INSERT + DELETE 방식)
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < longIdMaterials.length; i++) {
        const mat = longIdMaterials[i];
        const oldId = mat.id;
        const newId = `M${String(nextNum).padStart(5, '0')}`;

        try {
            // A. 기존 자재 데이터 전체 가져오기
            const { data: fullRow, error: fetchErr } = await supabase
                .from('materials')
                .select('*')
                .eq('id', oldId)
                .single();

            if (fetchErr || !fullRow) {
                console.error(`  ❌ [${i + 1}] ${oldId} 조회 실패`);
                errorCount++;
                continue;
            }

            // B. 새 ID로 INSERT
            const newRow = { ...fullRow, id: newId, updated_at: new Date().toISOString() };
            const { error: insertErr } = await supabase.from('materials').insert([newRow]);
            if (insertErr) {
                console.error(`  ❌ [${i + 1}] ${oldId} → ${newId} INSERT 실패:`, insertErr.message);
                errorCount++;
                continue;
            }

            // C. 기존 row 삭제
            const { error: deleteErr } = await supabase.from('materials').delete().eq('id', oldId);
            if (deleteErr) {
                console.error(`  ❌ [${i + 1}] ${oldId} DELETE 실패:`, deleteErr.message);
                // rollback: 새로 넣은거 삭제
                await supabase.from('materials').delete().eq('id', newId);
                errorCount++;
                continue;
            }

            // D. stock_history에서 item_id 업데이트
            const relatedHistory = allHistory.filter(h => h.item_id === oldId);
            if (relatedHistory.length > 0) {
                const { error: histErr } = await supabase
                    .from('stock_history')
                    .update({ item_id: newId })
                    .eq('item_id', oldId);
                if (histErr) {
                    console.error(`  ⚠️ [${i + 1}] stock_history 업데이트 실패:`, histErr.message);
                }
            }

            successCount++;
            nextNum++;

            // 진행상황 표시 (100건마다)
            if (successCount % 100 === 0) {
                console.log(`  ✅ ${successCount}/${longIdMaterials.length} 완료... (최근: ${oldId} → ${newId})`);
            }
        } catch (err) {
            console.error(`  ❌ [${i + 1}] 예외:`, err.message);
            errorCount++;
        }
    }

    console.log(`\n=== 마이그레이션 완료 ===`);
    console.log(`성공: ${successCount}건`);
    console.log(`실패: ${errorCount}건`);
    console.log(`새 ID 범위: M00007 ~ M${String(nextNum - 1).padStart(5, '0')}`);
}

main().catch(console.error);
