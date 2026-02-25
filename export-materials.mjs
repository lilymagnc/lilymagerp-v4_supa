import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchAll(table, select = '*') {
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
        if (error) { console.error(`Error:`, error); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        from += 1000;
    }
    return all;
}

async function main() {
    console.log('자재 데이터 전체 로딩 중...');
    const all = await fetchAll('materials', 'id,name,main_category,mid_category,unit,spec,price,stock,size,branch,memo');
    console.log(`총 ${all.length}개 로드 완료`);

    // 엑셀용 데이터 변환
    const rows = all.map((m, idx) => ({
        '번호': idx + 1,
        '현재ID': m.id,
        '자재명': m.name,
        '대분류': m.main_category || '',
        '중분류': m.mid_category || '',
        '단위': m.unit || '',
        '규격': m.spec || '',
        '가격': m.price || 0,
        '재고': m.stock || 0,
        '사이즈': m.size || '',
        '지점': m.branch || '',
        '메모': m.memo || '',
    }));

    // 엑셀 워크북 생성
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // 열 너비 조정
    ws['!cols'] = [
        { wch: 6 },   // 번호
        { wch: 22 },  // 현재ID
        { wch: 35 },  // 자재명
        { wch: 12 },  // 대분류
        { wch: 15 },  // 중분류
        { wch: 8 },   // 단위
        { wch: 12 },  // 규격
        { wch: 10 },  // 가격
        { wch: 8 },   // 재고
        { wch: 10 },  // 사이즈
        { wch: 20 },  // 지점
        { wch: 25 },  // 메모
    ];

    XLSX.utils.book_append_sheet(wb, ws, '전체자재목록');

    const filename = '전체자재목록_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(wb, filename);
    console.log(`\n✅ 엑셀 파일 생성 완료: ${filename}`);
    console.log(`   총 ${rows.length}개 자재가 포함되어 있습니다.`);
}

main().catch(console.error);
