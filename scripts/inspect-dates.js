
const admin = require('firebase-admin');
const serviceAccount = require('../lilymagerp-fs1-firebase-adminsdk-fbsvc-a55fb8f1d5.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function inspect() {
    const ordersSnapshot = await db.collection('orders')
        .where('outsourceInfo.isOutsourced', '==', true)
        .get();

    console.log(`Orders Dates:`);
    ordersSnapshot.forEach(d => {
        console.log(d.data().orderDate.toDate().toISOString().split('T')[0]);
    });
    process.exit(0);
}

inspect().catch(console.error);
