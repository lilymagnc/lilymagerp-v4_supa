
const admin = require('firebase-admin');
const serviceAccount = require('../lilymagerp-fs1-firebase-adminsdk-fbsvc-a55fb8f1d5.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function check() {
    const s = await db.collection('orders').get();
    let outsourcedCount = 0;
    s.forEach(d => {
        const data = d.data();
        if (data.outsourceInfo && data.outsourceInfo.partnerName) {
            outsourcedCount++;
            console.log(`Order: ${data.orderNumber}, Outsourced: ${data.outsourceInfo.isOutsourced}, Partner: ${data.outsourceInfo.partnerName}`);
        }
    });
    console.log(`Total orders with partner: ${outsourcedCount}`);
    process.exit(0);
}

check().catch(console.error);
