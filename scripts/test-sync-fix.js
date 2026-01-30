const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: 'lilymagerp-fs1'
});

const adminDb = admin.firestore();
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function testSync() {
    console.log('--- Testing Sync for 1 Order ---');
    try {
        const snapshot = await adminDb.collection('orders')
            .orderBy('orderDate', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.log('No orders found in Firebase');
            return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();
        console.log(`Found Firebase Order: ${doc.id}, Date: ${data.orderDate?.toDate?.()?.toISOString() || data.orderDate}`);

        const payload = {
            id: doc.id,
            order_date: data.orderDate?.toDate?.()?.toISOString() || data.orderDate,
            // adding more fields to match schema if needed
        };

        const { error } = await supabaseAdmin.from('orders').upsert(payload);
        if (error) console.error('Supabase Error:', error.message);
        else console.log('Successfully synced 1 order to Supabase!');

    } catch (err) {
        console.error('Error:', err);
    }
}

testSync();
