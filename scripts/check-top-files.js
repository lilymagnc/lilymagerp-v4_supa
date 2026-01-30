const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTopFiles() {
    console.log('--- Scanning for Top 20 Largest Files in Supabase Storage ---');
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const allFiles = [];

        for (const bucket of buckets) {
            async function collectFiles(pathPrefix = '') {
                const { data: list, error: e } = await supabase.storage.from(bucket.name).list(pathPrefix, { limit: 1000 });
                if (e) return;
                for (const item of list) {
                    if (item.id) {
                        allFiles.push({
                            bucket: bucket.name,
                            path: pathPrefix ? `${pathPrefix}/${item.name}` : item.name,
                            size: item.metadata.size || 0,
                            sizeMB: ((item.metadata.size || 0) / (1024 * 1024)).toFixed(2)
                        });
                    } else {
                        await collectFiles(pathPrefix ? `${pathPrefix}/${item.name}` : item.name);
                    }
                }
            }
            await collectFiles();
        }

        const topFiles = allFiles.sort((a, b) => b.size - a.size).slice(0, 20);
        console.table(topFiles.map(f => ({
            Bucket: f.bucket,
            Path: f.path,
            SizeMB: f.sizeMB
        })));

    } catch (err) {
        console.error(err);
    }
}

checkTopFiles();
