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

// simple csv parser handling quotes
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
    console.log('Downloading CSV from Google Sheets...');
    const csvData = await fetchCsv(sheetUrl);

    // Parse CSV
    const rows = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
    console.log(`Downloaded ${rows.length} rows.`);

    const keepIds = new Set<string>();
    let parsedCount = 0;

    for (const row of rows) {
        if (!row.trim()) continue;
        const columns = parseCsvLine(row);

        // CSV columns from snapshot:
        // col 0: NO
        // col 1: id
        // col 2: name
        const id = columns[1];
        if (id && id.trim()) {
            keepIds.add(id.trim());
            parsedCount++;
        }
    }

    console.log(`Found ${keepIds.size} unique IDs to KEEP.`);

    console.log('Fetching all materials from Supabase...');
    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .range(from, from + step - 1);

        if (error) {
            console.error(error);
            return;
        }
        if (!materials || materials.length === 0) break;
        allMaterials = allMaterials.concat(materials);
        from += step;
    }

    console.log(`Total materials in DB: ${allMaterials.length}`);

    // Identify materials to delete
    const toDelete = allMaterials.filter(m => !keepIds.has(m.id));

    console.log(`Identified ${toDelete.length} materials to DELETE.`);

    if (toDelete.length === 0) {
        console.log('Nothing to delete.');
        return;
    }

    console.log('\nPreviewing first 10 items to delete:');
    for (let i = 0; i < Math.min(10, toDelete.length); i++) {
        console.log(`  - [${toDelete[i].id}] ${toDelete[i].name}`);
    }

    // Delete in batches
    console.log('\nStarting deletion...');
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const idsToDelete = batch.map(item => item.id);

        const { error: deleteError } = await supabase
            .from('materials')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) {
            console.error(`Error deleting batch starting at ${i}:`, deleteError);
        } else {
            totalDeleted += batch.length;
            console.log(`...Deleted ${totalDeleted} / ${toDelete.length}...`);
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials deleted this run: ${totalDeleted}`);
}

run().catch(console.error);
