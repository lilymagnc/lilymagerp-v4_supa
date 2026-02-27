/**
 * 자재 마이그레이션 스크립트
 * 1) 기존 materials 전체 삭제
 * 2) Google Sheet 데이터 파싱 → 새 ID 체계 적용
 * 3) 4개 지점 복제 후 bulk insert
 * 4) categories 테이블 업데이트
 *
 * ID 형식: [대분류2자리][중분류1자리][순번4자리][지점코드1자리] = 8자리
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── 지점 코드 ──
const BRANCHES = [
    { code: '1', name: '릴리맥여의도점' },
    { code: '2', name: '릴리맥여의도2호점' },
    { code: '3', name: '릴리맥광화문점' },
    { code: '4', name: '릴리맥NC이스트폴점' },
];

// ── 대분류 → 접두어 매핑 ──
const MAIN_CAT_PREFIX = {
    '생화': 'MF',
    '식물': 'MP',
    '바구니 / 화기': 'MB',
    '바구니  / 화기': 'MB',
    '바구니 및 부자재': 'MB',
    '소모품 및 부자재': 'MM',
    '소포품 및 부자재': 'MM',
    '조화': 'MA',
    '프리저브드': 'MR',
    '원재료': 'MF', // 원재료는 생화로 재분류
};

// ── 대분류 정규화 ──
const NORMALIZE_MAIN = {
    '바구니  / 화기': '바구니 / 화기',
    '바구니 및 부자재': '바구니 / 화기',
    '소포품 및 부자재': '소모품 및 부자재',
    '원재료': '생화',
};

// ── 중분류 → 코드 매핑 ──
const MID_CAT_CODE = {
    'MF': { '장미류': '1', '거베라류': '2', '폼플라워': '3', '필러플라워': '4', '라인플라워': '5', '소재(그린)': '6', '국화류': '7', '카네이션류': '8', '리시안서스류': '9' },
    'MP': { '관엽소형': '1', '관엽중형': '2', '관엽대형': '3', '관엽소품': '4', '관엽중품': '5', '서양란': '6', '동양란': '7', '선인장': '8' },
    'MB': { '바구니': '1', '도자기': '2', '유리': '3', '테라조': '4' },
    'MM': { '원예자재': '1', '데코자재': '2', '포장재': '3', '리본/텍': '4', '기타': '5' },
    'MA': { '트리류': '1', '소재(그린)': '2' },
    'MR': { '폼플라워': '1' },
};

// ── 중분류 정규화 ──
function normalizeMidCat(mid) {
    if (!mid) return '기타';
    let m = mid.trim();
    if (m === '필러') m = '필러플라워';
    // 리본/텍 with trailing comma fix
    if (m.startsWith('리본/텍')) m = '리본/텍';
    return m;
}

// ── CSV 파싱 (간단한 파서) ──
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// ── 메인 ──
async function main() {
    console.log('=== 자재 마이그레이션 시작 ===\n');

    // 1) CSV 데이터 로드
    const csvPath = path.join(__dirname, 'materials-sheet-data.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('materials-sheet-data.csv 파일이 없습니다. 먼저 다운로드해주세요.');
        process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());

    // 첫줄은 헤더
    const header = parseCSVLine(lines[0]);
    console.log('헤더:', header);

    // 데이터 파싱
    const rawItems = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        // cols: 번호, 자재ID, 자재명, 대분류, 중분류, 단위, 규격, 가격, 색상, 재고, 공급업체, 지점, 메모
        const name = (cols[2] || '').trim();
        if (!name) continue;

        let mainCat = (cols[3] || '').trim();
        let midCat = normalizeMidCat(cols[4]);
        const unit = (cols[5] || '').trim();
        const spec = (cols[6] || '').trim();
        let price = parseInt((cols[7] || '0').replace(/[^0-9.-]/g, '')) || 0;
        const color = (cols[8] || '').trim();
        let stock = parseInt((cols[9] || '0').replace(/[^0-9]/g, '')) || 0;
        const supplier = (cols[10] || '').trim();
        const memo = (cols[12] || '').trim();

        // 대분류 정규화
        if (NORMALIZE_MAIN[mainCat]) mainCat = NORMALIZE_MAIN[mainCat];

        // 소모품 및 부자재 > 바구니 → 바구니/화기로 이동
        if (mainCat === '소모품 및 부자재' && midCat === '바구니') {
            mainCat = '바구니 / 화기';
        }

        // 생화 > 기타 → 폼플라워로 분류 (fallback)
        const prefix = MAIN_CAT_PREFIX[mainCat];
        if (!prefix) {
            console.warn(`  [SKIP] 알 수 없는 대분류: "${mainCat}" (자재: ${name})`);
            continue;
        }

        // 중분류 코드 확인, 없으면 새로 생성
        if (!MID_CAT_CODE[prefix][midCat]) {
            // 자동 할당: 다음 번호
            const existingCodes = Object.values(MID_CAT_CODE[prefix]);
            const maxCode = Math.max(0, ...existingCodes.map(Number));
            const newCode = String(maxCode + 1);
            MID_CAT_CODE[prefix][midCat] = newCode;
            console.log(`  [NEW MID_CAT] ${prefix} / ${midCat} → 코드 ${newCode}`);
        }

        rawItems.push({ name, mainCat, midCat, unit, spec, price, color, stock, supplier, memo });
    }

    console.log(`\n파싱된 자재 수: ${rawItems.length}개\n`);

    // 2) 중복 제거 (같은 이름 + 같은 대분류 + 같은 중분류 → 하나만)
    const seen = new Map();
    const uniqueItems = [];
    for (const item of rawItems) {
        const key = `${item.name}||${item.mainCat}||${item.midCat}`;
        if (seen.has(key)) {
            // 기존 것에 재고 합산
            const existing = seen.get(key);
            existing.stock += item.stock;
            // 가격은 최신으로
            if (item.price > 0) existing.price = item.price;
            if (item.supplier && item.supplier !== '미지정') existing.supplier = item.supplier;
        } else {
            const copy = { ...item };
            seen.set(key, copy);
            uniqueItems.push(copy);
        }
    }
    console.log(`중복 제거 후 자재 수: ${uniqueItems.length}개\n`);

    // 3) ID 생성 + 지점별 복제
    // 각 prefix+midCode 조합별 순번 카운터
    const counters = {};
    const allMaterials = [];

    for (const item of uniqueItems) {
        const prefix = MAIN_CAT_PREFIX[item.mainCat];
        const midCode = MID_CAT_CODE[prefix][item.midCat];
        const counterKey = `${prefix}${midCode}`;

        if (!counters[counterKey]) counters[counterKey] = 0;
        counters[counterKey]++;
        const seq = String(counters[counterKey]).padStart(4, '0');
        const baseId = `${prefix}${midCode}${seq}`; // 7자리

        for (const branch of BRANCHES) {
            const id = `${baseId}${branch.code}`; // 8자리
            allMaterials.push({
                id,
                name: item.name,
                main_category: item.mainCat,
                mid_category: item.midCat,
                unit: item.unit || null,
                spec: item.spec || null,
                price: item.price,
                stock: branch.code === '1' ? item.stock : 0, // 여의도점만 기존 재고
                color: item.color || null,
                supplier: item.supplier || null,
                branch: branch.name,
                memo: item.memo || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
        }
    }

    console.log(`총 생성 레코드 수: ${allMaterials.length}개 (${uniqueItems.length} 자재 × 4 지점)\n`);

    // ID 충돌 체크
    const idSet = new Set();
    let dupes = 0;
    for (const m of allMaterials) {
        if (idSet.has(m.id)) { dupes++; console.error(`ID 중복: ${m.id} (${m.name})`); }
        idSet.add(m.id);
    }
    if (dupes > 0) { console.error(`\n${dupes}개 ID 충돌 발견! 중단합니다.`); process.exit(1); }

    // 샘플 출력
    console.log('--- 샘플 데이터 (처음 12개) ---');
    for (const m of allMaterials.slice(0, 12)) {
        console.log(`  ${m.id} | ${m.name} | ${m.main_category} > ${m.mid_category} | ${m.branch} | stock:${m.stock}`);
    }
    console.log('');

    // 4) 기존 materials 삭제
    console.log('기존 materials 데이터 삭제 중...');
    // 전체 삭제: id != '' 조건
    const { error: delErr } = await supabase.from('materials').delete().neq('id', '___NEVER___');
    if (delErr) {
        console.error('삭제 실패:', delErr.message);
        process.exit(1);
    }
    console.log('기존 데이터 삭제 완료!\n');

    // 5) 새 데이터 삽입 (100개씩 배치)
    console.log('새 데이터 삽입 중...');
    const BATCH = 100;
    let inserted = 0;
    for (let i = 0; i < allMaterials.length; i += BATCH) {
        const batch = allMaterials.slice(i, i + BATCH);
        const { error: insErr } = await supabase.from('materials').insert(batch);
        if (insErr) {
            console.error(`배치 ${i}-${i + batch.length} 삽입 실패:`, insErr.message);
            // 개별 삽입 시도
            for (const item of batch) {
                const { error: singleErr } = await supabase.from('materials').insert([item]);
                if (singleErr) {
                    console.error(`  개별 실패: ${item.id} ${item.name} - ${singleErr.message}`);
                } else {
                    inserted++;
                }
            }
        } else {
            inserted += batch.length;
        }
        if ((i + BATCH) % 500 === 0 || i + BATCH >= allMaterials.length) {
            console.log(`  진행: ${Math.min(i + BATCH, allMaterials.length)}/${allMaterials.length}`);
        }
    }
    console.log(`삽입 완료: ${inserted}개\n`);

    // 6) categories 테이블 업데이트
    console.log('카테고리 테이블 업데이트 중...');
    const allCategories = [];

    // 대분류
    const mainCats = new Set(uniqueItems.map(i => i.mainCat));
    for (const mc of mainCats) {
        allCategories.push({ id: `main_${mc}`, name: mc, type: 'main', parent_category: null });
    }

    // 중분류
    const midCatSet = new Set();
    for (const item of uniqueItems) {
        const key = `${item.mainCat}||${item.midCat}`;
        if (!midCatSet.has(key)) {
            midCatSet.add(key);
            allCategories.push({ id: `mid_${item.mainCat}_${item.midCat}`, name: item.midCat, type: 'mid', parent_category: item.mainCat });
        }
    }

    for (const cat of allCategories) {
        const { error } = await supabase.from('categories').upsert(cat, { onConflict: 'id' });
        if (error) console.warn(`  카테고리 upsert 실패: ${cat.name} - ${error.message}`);
    }
    console.log(`카테고리 ${allCategories.length}개 처리 완료\n`);

    // 7) 통계 요약
    console.log('=== 마이그레이션 완료 ===');
    console.log(`총 자재 종류: ${uniqueItems.length}개`);
    console.log(`총 레코드 수: ${inserted}개 (4지점)`);
    console.log('\n대분류별 자재 수:');
    const mainStats = {};
    for (const item of uniqueItems) {
        mainStats[item.mainCat] = (mainStats[item.mainCat] || 0) + 1;
    }
    for (const [cat, count] of Object.entries(mainStats).sort((a, b) => b[1] - a[1])) {
        const prefix = MAIN_CAT_PREFIX[cat] || '??';
        console.log(`  ${prefix} ${cat}: ${count}개`);
    }

    console.log('\n중분류 코드 매핑 (최종):');
    for (const [prefix, midMap] of Object.entries(MID_CAT_CODE)) {
        if (Object.keys(midMap).length === 0) continue;
        console.log(`  [${prefix}]`);
        for (const [name, code] of Object.entries(midMap)) {
            console.log(`    ${code}: ${name}`);
        }
    }
}

main().catch(err => {
    console.error('치명적 오류:', err);
    process.exit(1);
});
