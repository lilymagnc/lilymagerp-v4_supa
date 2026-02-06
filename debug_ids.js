
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const firebaseServiceAccount = require('./firebase-service-account.json');
const supabaseUrl = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseServiceAccount)
    });
}
const db = admin.firestore();
const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
    const fbId = 'fnmBWOlHe6j04kyXG0RP';
    const sbId = 'RHTYLMWDGhbvNHA4MSNJ';

    console.log('--- Checking Firebase ID in both ---');
    const fbDoc = await db.collection('orders').doc(fbId).get();
    if (fbDoc.exists) {
        console.log('Firebase ID exists in Firebase:', fbDoc.data().orderer?.name, fbDoc.data().orderDate?.toDate().toISOString(), fbDoc.data().summary?.total);
    } else {
        console.log('Firebase ID does NOT exist in Firebase');
    }

    const { data: fbInSb } = await supabase.from('orders').select('*').eq('id', fbId).single();
    if (fbInSb) {
        console.log('Firebase ID exists in Supabase:', fbInSb.orderer?.name, fbInSb.order_date, fbInSb.summary?.total);
    } else {
        console.log('Firebase ID does NOT exist in Supabase');
    }

    console.log('\n--- Checking Supabase ID in both ---');
    const sbDoc = await db.collection('orders').doc(sbId).get();
    if (sbDoc.exists) {
        console.log('Supabase ID exists in Firebase:', sbDoc.data().orderer?.name, sbDoc.data().orderDate?.toDate().toISOString(), sbDoc.data().summary?.total);
    } else {
        console.log('Supabase ID does NOT exist in Firebase');
    }

    const { data: sbInSb } = await supabase.from('orders').select('*').eq('id', sbId).single();
    if (sbInSb) {
        console.log('Supabase ID exists in Supabase:', sbInSb.orderer?.name, sbInSb.order_date, sbInSb.summary?.total);
    } else {
        console.log('Supabase ID does NOT exist in Supabase');
    }

    process.exit(0);
}

debug();
