
const admin = require('firebase-admin');
const serviceAccount = require('../lilymagerp-fs1-firebase-adminsdk-fbsvc-a55fb8f1d5.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function check() {
    const s = await db.collection('orders').where('outsourceInfo.isOutsourced', '==', true).get();
    s.forEach(d => {
        const data = d.data();
        console.log(`BranchId: ${data.branchId}, BranchName: ${data.branchName}`);
    });
    process.exit(0);
}

check().catch(console.error);
