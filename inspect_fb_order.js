
const admin = require('firebase-admin');
const firebaseServiceAccount = require('./firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(firebaseServiceAccount)
    });
}
const db = admin.firestore();

async function inspect() {
    const snap = await db.collection('orders').limit(1).get();
    snap.forEach(doc => {
        console.log('ID:', doc.id);
        console.log('Keys:', Object.keys(doc.data()));
        console.log('orderDate:', doc.data().orderDate);
        console.log('createdAt:', doc.data().createdAt);
    });
    process.exit(0);
}

inspect();
