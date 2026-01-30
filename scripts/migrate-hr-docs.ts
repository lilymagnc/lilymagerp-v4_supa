
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

// Configuration
const FIREBASE_SERVICE_ACCOUNT = path.resolve(process.cwd(), 'firebase-service-account.json');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FIREBASE_BUCKET_NAME = 'lilymagerp-fs1.firebasestorage.app';

// Initialize Firebase
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: FIREBASE_BUCKET_NAME
    });
}
const db = admin.firestore();
const firebaseBucket = admin.storage().bucket();

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const convertValue = (val: any): any => {
    if (!val) return val;
    if (val.toDate && typeof val.toDate === 'function') {
        return val.toDate().toISOString();
    }
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) return val.map(convertValue);
    if (typeof val === 'object' && val !== null) {
        if (val._seconds !== undefined) {
            return new Date(val._seconds * 1000).toISOString();
        }
        const newObj: any = {};
        for (const key in val) {
            newObj[key] = convertValue(val[key]);
        }
        return newObj;
    }
    return val;
};

// Function to generate a deterministic UUID from a string
function toUUID(str: string): string {
    if (!str) return '00000000-0000-0000-0000-000000000000';
    // Check if already a valid UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
        return str;
    }

    // Create a deterministic hash
    const hash = crypto.createHash('md5').update(str).digest('hex');

    // Format as UUID (8-4-4-4-12)
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        '4' + hash.substring(13, 16), // Version 4 (approximate)
        'a' + hash.substring(17, 20), // Variant (approximate)
        hash.substring(20, 32)
    ].join('-');
}

async function migrateHRDocuments() {
    console.log('🚀 Starting HR Documents Migration (Deterministic UUID version)...');

    try {
        const snapshot = await db.collection('hr_documents').get();
        console.log(`Found ${snapshot.size} documents in Firestore.`);

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const id = doc.id;

            console.log(`\nProcessing document: ${id} (${data.userName})`);

            const payload: any = {
                id: toUUID(id),
                user_id: data.userId ? toUUID(data.userId) : null,
                user_name: data.userName,
                document_type: data.documentType,
                submission_date: convertValue(data.submissionDate),
                status: data.status,
                original_file_name: data.originalFileName,
                submission_method: data.submissionMethod,
                contents: convertValue(data.contents),
                extracted_from_file: data.extractedFromFile,
                created_at: convertValue(data.createdAt || data.submissionDate),
                updated_at: convertValue(data.updatedAt || data.submissionDate)
            };

            let finalFileUrl = data.fileUrl;

            if (data.fileUrl && data.fileUrl.includes('firebasestorage')) {
                try {
                    const decodedUrl = decodeURIComponent(data.fileUrl);
                    const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
                    if (pathMatch && pathMatch[1]) {
                        const firebasePath = pathMatch[1];
                        console.log(`  - Migrating file: ${firebasePath}`);

                        const file = firebaseBucket.file(firebasePath);
                        const [exists] = await file.exists();

                        if (exists) {
                            const [buffer] = await file.download();
                            const [metadata] = await file.getMetadata();

                            const fileName = path.basename(firebasePath);
                            const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                            const targetPath = sanitizedFileName;
                            const targetBucket = 'hr-submissions';

                            const { error: uploadError } = await supabase.storage
                                .from(targetBucket)
                                .upload(targetPath, buffer, {
                                    contentType: metadata.contentType || 'application/octet-stream',
                                    upsert: true
                                });

                            if (!uploadError) {
                                const { data: { publicUrl } } = supabase.storage
                                    .from(targetBucket)
                                    .getPublicUrl(targetPath);

                                finalFileUrl = publicUrl;
                                console.log(`  ✅ File migrated: ${publicUrl}`);
                            } else {
                                console.error(`  ❌ Storage Error: ${uploadError.message}`);
                            }
                        }
                    }
                } catch (err: any) {
                    console.error(`  ❌ File Error for ${id}: ${err.message}`);
                }
            }

            payload.file_url = finalFileUrl;

            // Upsert into Supabase
            const { error: upsertError } = await supabase
                .from('hr_documents')
                .upsert(payload);

            if (upsertError) {
                console.error(`  ❌ DB Error for ${id}: ${upsertError.message}`);
                // If it's a foreign key error on user_id, try setting it to null
                if (upsertError.message.includes('foreign key constraint')) {
                    console.log('  ⚠️ Foreign key constraint failed. Retrying with user_id = null...');
                    payload.user_id = null;
                    const { error: retryError } = await supabase.from('hr_documents').upsert(payload);
                    if (retryError) {
                        console.error(`  ❌ Still failed: ${retryError.message}`);
                    } else {
                        console.log('  ✅ Migrated with user_id set to NULL.');
                    }
                }
            } else {
                console.log(`  ✅ Document migrated.`);
            }
        }

        console.log('\n--- HR Migration Finished ---');

    } catch (error: any) {
        console.error('❌ Fatal error:', error.message);
    }
}

migrateHRDocuments();
