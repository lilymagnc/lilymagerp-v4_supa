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

// Prefix for generating IDs (matching project code)
const categoryPrefixMap: Record<string, string> = {
    '생화': 'MF',
    '식물': 'MP',
    '바구니 / 화기': 'MB',
    '소모품 및 부자재': 'MS',
    '기타': 'MO',
    '조화': 'MA', // adding 'MA' for 조화(Artificial) just as fallback
};

async function insertMissingIds() {
    console.log('Downloading CSV from Google Sheets...');
    const csvData = await fetchCsv(sheetUrl);

    const rows = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);

    const itemsToInsert = [];

    // Using current timestamp to make unique IDs
    let timeCounter = Date.now();

    for (const row of rows) {
        if (!row.trim()) continue;
        const columns = parseCsvLine(row);

        const no = columns[0];
        const id = columns[1];

        if (!id || id.trim() === '') {
            const name = (columns[2] || '').trim();
            if (!name) continue; // Skip if there is no name

            const mainCategory = columns[3] || '기타';
            const midCategory = columns[4] || '기타';
            const size = columns[5] || '';
            const color = columns[6] || '';
            const price = parseInt(columns[7]) || 0;
            const supplier = columns[8] || '';
            const stock = parseInt(columns[9]) || 0;
            const branch = columns[11] || '릴리맥여의도점'; // Default to Yeouido if empty

            // generate prefix ID
            const prefix = categoryPrefixMap[mainCategory] || 'MO';
            const newId = `${prefix}${timeCounter++}`;

            itemsToInsert.push({
                id: newId,
                name: name,
                main_category: mainCategory.trim(),
                mid_category: midCategory.trim(),
                size: size.trim(),
                color: color.trim(),
                price: price,
                supplier: supplier.trim(),
                stock: stock,
                branch: branch.trim(),
            });
        }
    }

    console.log(`Found ${itemsToInsert.length} items without ID in the sheet.`);

    if (itemsToInsert.length === 0) {
        console.log('No new items to insert.');
        return;
    }

    console.log('Previewing 5 items to insert:');
    for (let i = 0; i < Math.min(5, itemsToInsert.length); i++) {
        console.log(`  - [${itemsToInsert[i].id}] ${itemsToInsert[i].name} (${itemsToInsert[i].main_category} / ${itemsToInsert[i].mid_category} | ${itemsToInsert[i].branch})`);
    }

    // Insert to DB
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
    console.log(`Job Complete. Total materials created & inserted this run: ${totalInserted}`);
}

insertMissingIds().catch(console.error);
