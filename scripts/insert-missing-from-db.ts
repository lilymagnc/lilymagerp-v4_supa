import https from 'https';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const sheetUrl = 'https://docs.google.com/spreadsheets/d/1zORDeAfYC-bEtCcLp6xKOESoz9khQvQW/export?format=csv&gid=594653964';

function fetchCsv(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(fetchCsv(res.headers.location));
            } else {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }
        }).on('error', reject);
    });
}

function parseCsvLine(text: string) {
    let ret = [];
    let inQuote = false;
    let value = '';
    for (let i = 0; i < text.length; i++) {
        let char = text[i];
        if (inQuote) {
            if (char === '"') {
                if (i < text.length - 1 && text[i + 1] === '"') {
                    value += '"';
                    i++;
                } else {
                    inQuote = false;
                }
            } else {
                value += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                ret.push(value);
                value = '';
            } else {
                value += char;
            }
        }
    }
    ret.push(value);
    return ret;
}

const categoryPrefixMap: Record<string, string> = {
    '생화': 'MF',
    '식물': 'MP',
    '바구니 / 화기': 'MB',
    '소모품 및 부자재': 'MS',
    '조화': 'MA',
    '기타': 'MO',
};

async function insertMissingFromDB() {
    console.log('Downloading CSV from Google Sheets...');
    const csvData = await fetchCsv(sheetUrl);

    // DB의 모든 ID를 가져오기
    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id')
            .range(from, from + step - 1);
        if (error) return;
        if (!materials || materials.length === 0) break;
        allMaterials = allMaterials.concat(materials);
        from += step;
    }
    const dbIds = new Set(allMaterials.map(m => m.id));

    const rows = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
    const itemsToInsert = [];
    let timeCounter = Date.now();

    for (const row of rows) {
        if (!row.trim()) continue;
        const columns = parseCsvLine(row);

        let id = columns[1]?.trim();
        const name = (columns[2] || '').trim();

        if (!name) continue; // 이름이 없으면 스킵

        let isMissingId = false;

        // 1. 시트에 아예 ID가 없는 경우
        if (!id) {
            isMissingId = true;
        }
        // 2. 시트에 ID가 있지만, 현재 DB에는 없는 경우
        else if (!dbIds.has(id)) {
            isMissingId = true;
        }

        if (isMissingId) {
            const mainCategory = columns[3] || '기타';
            const midCategory = columns[4] || '기타';
            const size = columns[5] || '';
            const color = columns[6] || '';
            const price = parseInt(columns[7]) || 0;
            const supplier = columns[8] || '';
            const stock = parseInt(columns[9]) || 0;
            const branch = columns[11] || '릴리맥여의도점';

            // ID가 원래 없었거나, 있었지만 재발급해도 무방한 경우 (어차피 DB에 없으므로)
            // 지시대로 "id 없는 것들은 새로운 아이디를 만들어서"에 따라,
            // 완전히 새로운 ID를 발급해서 넣어주겠습니다.
            const prefix = categoryPrefixMap[mainCategory] || 'MO';
            const finalId = id ? id : `${prefix}${timeCounter++}`;

            itemsToInsert.push({
                id: finalId, // 원래 시트에 있던 ID가 있으면 그거 쓰고, 없으면 새로 만든거 사용.
                name: name,
                main_category: mainCategory.trim(),
                mid_category: midCategory.trim(),
                size: size.trim(),
                color: color.trim(),
                price: price,
                supplier: supplier.trim(),
                stock: stock,
                branch: branch.trim()
            });
        }
    }

    console.log(`구글 시트 품목 중 DB에 없어서 새로 생성 및 추가할 항목 수: ${itemsToInsert.length}건`);

    if (itemsToInsert.length === 0) {
        console.log('No new items to insert.');
        return;
    }

    console.log('\nPreviewing 5 items to insert:');
    for (let i = 0; i < Math.min(5, itemsToInsert.length); i++) {
        console.log(`  - [${itemsToInsert[i].id}] ${itemsToInsert[i].name} (${itemsToInsert[i].main_category})`);
    }

    console.log('\nInserting...');
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < itemsToInsert.length; i += batchSize) {
        const batch = itemsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
            .from('materials')
            .insert(batch);

        if (insertError) {
            console.error(`Error inserting batch starting at ${i}:`, insertError);
        } else {
            totalInserted += batch.length;
            console.log(`...Inserted ${totalInserted} / ${itemsToInsert.length}...`);
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials inserted this run: ${totalInserted}`);
}

insertMissingFromDB().catch(console.error);
