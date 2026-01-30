const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.resolve(__dirname, '../firebase-service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('Service account file not found');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    projectId: 'lilymagerp-fs1'
});

const db = admin.firestore();

async function checkFirebase() {
    console.log('--- Checking Firebase Data ---');
    try {
        const snapshot = await db.collection('orders')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        console.log(`Latest 5 orders in Firebase:`);
        const orders = snapshot.docs.map(doc => ({
            id: doc.id,
            orderNumber: doc.data().orderNumber,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
        }));
        console.table(orders);
    } catch (err) {
        console.error('Firebase error:', err);
    }
}

checkFirebase();
