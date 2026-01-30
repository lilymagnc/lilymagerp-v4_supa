const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration (URL or Service Role Key)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStorage() {
    console.log('--- Analyzing Supabase Storage Usage ---');
    try {
        // 1. List all buckets
        const { data: buckets, error: bError } = await supabase.storage.listBuckets();
        if (bError) throw bError;

        if (!buckets || buckets.length === 0) {
            console.log('No buckets found.');
            return;
        }

        let totalSizeBytes = 0;
        const bucketStats = [];

        for (const bucket of buckets) {
            console.log(`\nChecking bucket: ${bucket.name}...`);
            let bucketSize = 0;
            let fileCount = 0;

            // Recurse function to list all files in a bucket
            async function listAllFiles(pathPrefix = '') {
                const { data: files, error: fError } = await supabase.storage.from(bucket.name).list(pathPrefix, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' }
                });

                if (fError) {
                    console.error(`Error listing files in ${bucket.name}/${pathPrefix}:`, fError.message);
                    return;
                }

                for (const file of files) {
                    if (file.id === null) {
                        // This is a folder
                        await listAllFiles(pathPrefix ? `${pathPrefix}/${file.name}` : file.name);
                    } else {
                        // This is a file
                        bucketSize += file.metadata.size || 0;
                        fileCount++;
                    }
                }
            }

            await listAllFiles();

            totalSizeBytes += bucketSize;
            bucketStats.push({
                Bucket: bucket.name,
                Files: fileCount,
                SizeMB: (bucketSize / (1024 * 1024)).toFixed(2),
                SizeBytes: bucketSize
            });
        }

        console.log('\n--- Summary ---');
        console.table(bucketStats);
        console.log(`\nTotal Storage Used: ${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB (${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(3)} GB)`);

        // Find the top 10 largest files
        console.log('\nScanning for top 10 largest files...');
        const allFiles = [];

        for (const bucket of buckets) {
            async function collectFiles(pathPrefix = '') {
                const { data: list, error: e } = await supabase.storage.from(bucket.name).list(pathPrefix);
                if (e) return;
                for (const item of list) {
                    if (item.id) {
                        allFiles.push({
                            name: item.name,
                            path: pathPrefix ? `${pathPrefix}/${item.name}` : item.name,
                            bucket: bucket.name,
                            size: item.metadata.size || 0,
                            sizeMB: (item.metadata.size / (1024 * 1024)).toFixed(2) + ' MB'
                        });
                    } else {
                        await collectFiles(pathPrefix ? `${pathPrefix}/${item.name}` : item.name);
                    }
                }
            }
            await collectFiles();
        }

        const topFiles = allFiles.sort((a, b) => b.size - a.size).slice(0, 10);
        console.log('\nTop 10 Largest Files:');
        console.table(topFiles.map(f => ({
            Bucket: f.bucket,
            Path: f.path,
            Size: f.sizeMB
        })));

    } catch (err) {
        console.error('Storage analysis failed:', err);
    }
}

checkStorage();
