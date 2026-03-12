import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const MAIN_CAT_PREFIX: Record<string, string> = {
    '생화': 'MF', '식물': 'MP', '바구니 / 화기': 'MB',
    '소모품 및 부자재': 'MM', '조화': 'MA', '프리저브드': 'MR',
};

const MID_CAT_CODE: Record<string, Record<string, string>> = {
    'MF': { '장미류': '1', '거베라류': '2', '폼플라워': '3', '필러플라워': '4', '라인플라워': '5', '소재(그린)': '6', '국화류': '7', '카네이션류': '8', '리시안서스류': '9', '기타': '0', '매스플라워': 'A' },
    'MP': { '관엽소형': '1', '관엽중형': '2', '관엽대형': '3', '서양란': '6', '동양란': '7', '기타식물': 'D', '다육/선인장소형': '8', '다육/선인장중형': '9', '다육/선인장대형': '0', '다육선인장소형': '8', '다육선인장중형': '9', '다육선인장대형': '0' },
    'MB': { '바구니': '1', '도자기': '2', '유리': '3', '테라조': '4', '테라코타(토분)': '5', '플라스틱': '6', '기타': '7' },
    'MM': { '원예자재': '1', '데코자재': '2', '포장재': '3', '리본/텍': '4', '기타': '5', '제작도구': '6' },
    'MA': { '장미류': '1', '카네이션류': '2', '리시안서스류': '3', '국화류': '4', '거베라류': '5', '폼플라워': '6', '라인플라워': '7', '필러플라워': '8', '소재(그린)': '9', '트리류': '0', '매스플라워': 'A' },
    'MR': { '플라워': '1', '잎소재': '2', '열매': '3', '폼플라워': '4', '기타': '5' },
};

const BRANCHES = [
    { name: '릴리맥여의도점', code: '1' },
    { name: '릴리맥여의도2호점', code: '2' },
    { name: '릴리맥광화문점', code: '3' },
    { name: '릴리맥NC이스트폴점', code: '4' }
];

function parseCsv(data: string) {
    const lines = data.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // header: 번호,자재ID,자재명,대분류,중분류,단위,규격,가격,색상,재고,공급업체,지점,메모
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        let inQuotes = false;
        let field = '';
        const fields = [];
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(field);
                field = '';
            } else {
                field += char;
            }
        }
        fields.push(field);
        rows.push(fields);
    }
    return rows;
}

async function main() {
    try {
        console.log("1. Deleting fresh_flower_batches...");
        const { error: err1 } = await supabase.from('fresh_flower_batches').delete().not('id', 'is', null);
        if (err1) throw err1;

        console.log("2. Deleting pending material_requests...");
        const { error: err2 } = await supabase.from('material_requests').delete().neq('status', 'completed');
        if (err2) throw err2;

        console.log("3. Deleting all materials...");
        const { error: err3 } = await supabase.from('materials').delete().not('id', 'is', null);
        if (err3) throw err3;

        console.log("4. Reading CSV...");
        const csvData = fs.readFileSync('materials.csv', 'utf-8');
        const rows = parseCsv(csvData);

        const records = rows.map(r => ({
            '자재명': r[2] || '',
            '대분류': r[3] || '',
            '중분류': r[4] || '',
            '단위': r[5] || '',
            '규격': r[6] || '',
            '가격': r[7] || '',
            '색상': r[8] || '',
            '재고': r[9] || '',
            '공급업체': r[10] || '',
            '지점': r[11] || '',
            '메모': r[12] || ''
        })).filter(r => r['자재명'] !== '');

        // Sort by 대분류, 중분류, 자재명
        records.sort((a, b) => {
            if (a['대분류'] !== b['대분류']) return a['대분류'].localeCompare(b['대분류'], 'ko-KR');
            if (a['중분류'] !== b['중분류']) return a['중분류'].localeCompare(b['중분류'], 'ko-KR');
            return a['자재명'].localeCompare(b['자재명'], 'ko-KR');
        });

        const newMaterials = [];
        
        // Use a Map to track sequence per pattern globally
        const seqMap = new Map<string, number>();

        for (const record of records) {
            const mainCat = record['대분류'] || '소모품 및 부자재';
            const midCat = record['중분류'] || '기타';

            const prefix = MAIN_CAT_PREFIX[mainCat] || 'MM';
            const midCode = (MID_CAT_CODE[prefix]?.[midCat]) || '0';
            const pattern = `${prefix}${midCode}`;

            const seq = (seqMap.get(pattern) || 0) + 1;
            seqMap.set(pattern, seq);

            const seqStr = String(seq).padStart(4, '0');

            for (const branch of BRANCHES) {
                const materialId = `${pattern}${seqStr}${branch.code}`;
                
                newMaterials.push({
                    id: materialId,
                    name: record['자재명'],
                    main_category: mainCat,
                    mid_category: midCat,
                    unit: record['단위'] || null,
                    spec: record['규격'] || null,
                    price: record['가격'] ? Number(record['가격'].replace(/[^0-9]/g, '')) : 0,
                    stock: record['재고'] ? Number(record['재고'].replace(/[^0-9-]/g, '')) : 0,
                    color: record['색상'] || null,
                    supplier: record['공급업체'] || '미지정',
                    branch: branch.name,
                    memo: record['메모'] || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            }
        }

        console.log(`Prepared ${newMaterials.length} records. Inserting...`);
        
        let successCount = 0;
        // Insert in smaller batches to avoid losing 100 on a single conflict
        for (let i = 0; i < newMaterials.length; i += 50) {
            const batch = newMaterials.slice(i, i + 50);
            const { error: errInsert, data } = await supabase.from('materials').insert(batch).select('id');
            if (errInsert) {
                console.error("Insert error:", errInsert);
            } else if (data) {
                successCount += data.length;
            }
        }
        
        console.log(`Successfully inserted ${successCount} records.`);
        
        console.log("5. Deduplicating and syncing categories...");
        // Rebuild categories
        const categoriesMap = new Map();
        for (const item of newMaterials) {
            categoriesMap.set(`${item.main_category}|${item.mid_category}`, { main: item.main_category, mid: item.mid_category });
        }
        
        for (const {main, mid} of Array.from(categoriesMap.values())) {
            const { data: existingMain } = await supabase.from('categories').select('id').eq('name', main).eq('type', 'main').maybeSingle();
            if (!existingMain) {
                await supabase.from('categories').insert([{ id: crypto.randomUUID(), name: main, type: 'main', created_at: new Date().toISOString() }]);
            }
            const { data: existingMid } = await supabase.from('categories').select('id').eq('name', mid).eq('type', 'mid').eq('parent_category', main).maybeSingle();
            if (!existingMid) {
                await supabase.from('categories').insert([{ id: crypto.randomUUID(), name: mid, type: 'mid', parent_category: main, created_at: new Date().toISOString() }]);
            }
        }

        console.log("Done!");
    } catch(e) {
        console.error("Script failed:", e);
    }
}

main();
