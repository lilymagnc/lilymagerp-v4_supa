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

async function run() {
    const csvData = await fetchCsv(sheetUrl);
    const rows = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);

    const sheetIds = new Set<string>();
    for (const row of rows) {
        if (!row.trim()) continue;
        const columns = parseCsvLine(row);
        const id = columns[1];
        if (id && id.trim()) {
            sheetIds.add(id.trim());
        }
    }

    console.log(`구글 시트의 ID 개수: ${sheetIds.size}`);

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .range(from, from + step - 1);
        if (error) return;
        if (!materials || materials.length === 0) break;
        allMaterials = allMaterials.concat(materials);
        from += step;
    }

    console.log(`현재 데이터베이스의 ID 개수: ${allMaterials.length}`);

    // How many of the sheet IDs are actually in the DB right now?
    const dbIds = new Set(allMaterials.map(m => m.id));

    let dbHasSheetIdCount = 0;
    sheetIds.forEach(id => {
        if (dbIds.has(id)) dbHasSheetIdCount++;
    });

    console.log(`구글 시트에 있는 ID 중, 현재 DB에 존재하는 ID 개수: ${dbHasSheetIdCount}`);
}

run().catch(console.error);
