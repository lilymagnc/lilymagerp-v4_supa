import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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
    const log = [];
    const p = (...args) => { const line = args.join(' '); console.log(line); log.push(line); };

    const all = await fetchAll('materials', 'id,name,main_category,mid_category,stock,branch,price');
    p('총 자재:', all.length);

    // 1. 대분류별 현황
    const cats = {};
    all.forEach(m => {
        const cat = m.main_category || '미분류';
        if (!cats[cat]) cats[cat] = 0;
        cats[cat]++;
    });
    p('\n=== 대분류별 현황 ===');
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => p(`  ${k}: ${v}개`));

    // 2. 같은 이름 중복 자재 (다른 지점 포함)
    const names = {};
    all.forEach(m => {
        const key = m.name?.trim();
        if (!names[key]) names[key] = [];
        names[key].push(m);
    });
    const dupes = Object.entries(names).filter(([k, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
    p(`\n=== 같은 이름 중복 자재: ${dupes.length}종 ===`);
    dupes.forEach(([name, items]) => {
        const branches = [...new Set(items.map(i => i.branch || '?'))].join(', ');
        const catInfo = items[0].main_category || '미분류';
        p(`  "${name}" × ${items.length}개 [${catInfo}] 지점: ${branches}`);
    });

    // 3. 바코드 접두어 매핑 제안
    p('\n=== 바코드 접두어 매핑 제안 ===');
    const prefixMap = {
        '생화': 'MF',
        '식물': 'MP',
        '분화': 'MP',
        '자재': 'MM',
        '원재료': 'MR',
        '기타자재': 'MX',
        '소모품': 'MS',
    };
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        const prefix = prefixMap[cat] || 'MX';
        p(`  ${cat} (${count}개) → ${prefix}000001 ~`);
    });

    // 4. 중분류별 현황 (대분류 > 중분류)
    const subCats = {};
    all.forEach(m => {
        const key = `${m.main_category || '미분류'} > ${m.mid_category || '미분류'}`;
        if (!subCats[key]) subCats[key] = 0;
        subCats[key]++;
    });
    p('\n=== 대분류 > 중분류 현황 ===');
    Object.entries(subCats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => p(`  ${k}: ${v}개`));

    fs.writeFileSync('result_log.txt', log.join('\n'), 'utf8');
    console.log('\n✅ 결과가 result_log.txt에 저장되었습니다.');
}

main().catch(console.error);
