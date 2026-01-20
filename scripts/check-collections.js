const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkCollections() {
    try {
        console.log('Checking Firestore collections...\n');

        // List all collections
        const collections = await db.listCollections();
        console.log('Collections found:');
        for (const collection of collections) {
            const snapshot = await collection.count().get();
            console.log(`- ${collection.id}: ${snapshot.data().count} documents`);
        }

        // Check specifically for orders_2025
        const orders2025Ref = db.collection('orders_2025');
        const orders2025Count = await orders2025Ref.count().get();
        console.log(`\norders_2025: ${orders2025Count.data().count} documents`);

        // Check stats collections
        const statsRef = db.collection('stats');
        const statsSnapshot = await statsRef.listDocuments();
        console.log(`\nstats collection has ${statsSnapshot.length} top-level documents`);

        // Check branchStats
        const branchStatsRef = db.collection('branchStats');
        const branchStatsSnapshot = await branchStatsRef.listDocuments();
        console.log(`branchStats collection has ${branchStatsSnapshot.length} top-level documents`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkCollections();
