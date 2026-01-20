
const admin = require('firebase-admin');
const serviceAccount = require('../lilymagerp-fs1-firebase-adminsdk-fbsvc-a55fb8f1d5.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function count() {
    const snapshot = await db.collection('simpleExpenses')
        .where('description', '>=', '외부발주:')
        .where('description', '<', '외부발주:\uf8ff')
        .get();

    console.log(`Count: ${snapshot.size}`);
    snapshot.forEach(d => {
        const data = d.data();
        console.log(`Branch: ${data.branchName}, Date: ${data.date?.toDate().toISOString().split('T')[0]}, Desc: ${data.description}`);
    });
    process.exit(0);
}

count().catch(console.error);
