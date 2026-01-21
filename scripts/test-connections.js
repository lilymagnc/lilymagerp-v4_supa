const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testConnections() {
    console.log('--- Testing Connections ---');

    // 1. Firebase Test
    try {
        const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
        if (!fs.existsSync(serviceAccountPath)) {
            throw new Error(`Service account file not found at ${serviceAccountPath}`);
        }
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        console.log(`Connecting to Firebase project: ${serviceAccount.project_id}`);

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        const db = admin.firestore();
        const collections = await db.listCollections();
        console.log('✅ Firebase Connected Successfully!');
        console.log('Found collections:', collections.map(c => c.id).join(', '));
    } catch (error) {
        console.error('❌ Firebase Connection Failed!');
        console.error('Error Details:', error.message);
        if (error.stack) console.error(error.stack);
    }

    // 2. Supabase Test
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase URL or Service Role Key is missing in .env.local');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const tables = ['branches', 'customers', 'products', 'materials', 'orders', 'order_transfers', 'expense_requests', 'simple_expenses'];
        console.log('--- Checking Supabase Tables ---');
        for (const table of tables) {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`❌ Table "${table}" check failed: ${error.message} (${error.code})`);
            } else {
                console.log(`✅ Table "${table}" exists. Count: ${count}`);
            }
        }


        // Test storage access
        const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
        if (storageError) {
            console.log('⚠️ Supabase Storage access issue:', storageError.message);
        } else {
            console.log('✅ Supabase Storage Connected. Found', buckets.length, 'buckets.');
        }

    } catch (error) {
        console.error('❌ Supabase Connection Failed:', error.message);
    }
}

testConnections();
