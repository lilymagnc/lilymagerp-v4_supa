const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const FIREBASE_SERVICE_ACCOUNT = path.resolve(__dirname, '../firebase-service-account.json');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIREBASE_BUCKET_NAME = 'lilymagerp-fs1.firebasestorage.app';

// Initialize Firebase
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: FIREBASE_BUCKET_NAME
    });
}
const firebaseBucket = admin.storage().bucket();

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateFiles() {
    console.log('🚀 Starting Storage Migration...');

    try {
        const [files] = await firebaseBucket.getFiles();
        console.log(`Found ${files.length} files in Firebase Storage.`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        const concurrency = 10;
        for (let i = 0; i < files.length; i += concurrency) {
            const chunk = files.slice(i, i + concurrency);

            console.log(`Processing ${i}-${i + chunk.length}/${files.length}... (Success: ${successCount}, Error: ${errorCount})`);

            await Promise.all(chunk.map(async (file) => {
                const fileName = file.name;
                let targetBucket = 'general';
                let targetPath = fileName;

                if (fileName.startsWith('sample-albums/')) {
                    targetBucket = 'sample-albums';
                    targetPath = fileName.replace('sample-albums/', '');
                } else if (fileName.startsWith('photos/')) {
                    targetBucket = 'photos';
                    targetPath = fileName.replace('photos/', '');
                } else if (fileName.startsWith('receipts/')) {
                    targetBucket = 'receipts';
                    targetPath = fileName.replace('receipts/', '');
                } else if (fileName.startsWith('hr_submissions/')) {
                    targetBucket = 'hr-submissions';
                    targetPath = fileName.replace('hr_submissions/', '');
                } else if (fileName.startsWith('backups/')) {
                    targetBucket = 'backups';
                    targetPath = fileName.replace('backups/', '');
                }

                // Sanitize path for Supabase (remove special characters that might cause 'Invalid key' errors)
                targetPath = targetPath.split('/').map(part =>
                    part.replace(/[^a-zA-Z0-9.\-_]/g, '_')
                ).join('/');

                try {
                    const [buffer] = await file.download();
                    const [metadata] = await file.getMetadata();
                    const contentType = metadata.contentType || 'application/octet-stream';

                    const { error: uploadError } = await supabase.storage
                        .from(targetBucket)
                        .upload(targetPath, buffer, {
                            contentType,
                            upsert: true
                        });

                    if (uploadError) {
                        console.error(`❌ Failed to upload ${fileName}:`, uploadError.message);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                } catch (err) {
                    console.error(`❌ Failed to process ${fileName}:`, err.message);
                    errorCount++;
                }
            }));
        }


        console.log('\n--- Migration Finished ---');
        console.log(`Total: ${files.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log(`Skipped: ${skipCount}`);

    } catch (error) {
        console.error('❌ Fatal error during storage migration:', error.message);
    }
}

migrateFiles();
