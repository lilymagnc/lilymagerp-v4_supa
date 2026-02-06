
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

async function compareByCreatedAt() {
    console.log('Comparing January 2026 Orders by createdAt (KST)...');
    const start = new Date('2025-12-31T15:00:00Z');
    const end = new Date('2026-01-31T14:59:59Z');

    // FB
    const fbSnap = await db.collection('orders')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(end))
        .get();
    console.log(`Firebase Count (createdAt): ${fbSnap.size}`);

    // SB
    let sbAll = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from('orders')
            .select('id')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .range(from, from + 999);
        if (error || !data || data.length === 0) break;
        sbAll = sbAll.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }
    console.log(`Supabase Count (created_at): ${sbAll.length}`);
    process.exit(0);
}

compareByCreatedAt();
