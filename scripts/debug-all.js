
const admin = require('firebase-admin');
const serviceAccount = require('../lilymagerp-fs1-firebase-adminsdk-fbsvc-a55fb8f1d5.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function debug() {
    console.log('--- BRANCHES ---');
    const bSnap = await db.collection('branches').get();
    const branchMap = {};
    bSnap.forEach(d => {
        const data = d.data();
        branchMap[d.id] = data;
        console.log(`ID: ${d.id}, Name: ${data.name}, Type: ${data.type}`);
    });

    console.log('\n--- EXPENSES (Start with 외부발주:) ---');
    const eSnap = await db.collection('simpleExpenses')
        .where('description', '>=', '외부발주:')
        .where('description', '<', '외부발주:\uf8ff')
        .get();

    console.log(`Total Found: ${eSnap.size}`);
    eSnap.forEach(d => {
        const data = d.data();
        const dateStr = data.date?.toDate().toISOString().split('T')[0];
        console.log(`ID: ${d.id}, Branch: ${data.branchName} (${data.branchId}), Date: ${dateStr}, Supplier: ${data.supplier}, Desc: ${data.description}`);
    });

    process.exit(0);
}

debug().catch(console.error);
