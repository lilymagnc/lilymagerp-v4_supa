const admin = require('firebase-admin');
const serviceAccount = require('C:/Users/lilym_bf6lm6p/Downloads/lilymagerp-fs1-firebase-adminsdk-fbsvc-a55fb8f1d5.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function standardizeSurcharges() {
    console.log('Starting standardized surcharge update for all branches...');

    const branchesRef = db.collection('branches');
    const snapshot = await branchesRef.get();

    if (snapshot.empty) {
        console.log('No branches found.');
        return;
    }

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
        if (doc.id === '_initialized') return;

        const data = doc.data();
        console.log(`Updating branch: ${data.name || doc.id}`);

        batch.update(doc.ref, {
            surcharges: {
                mediumItem: 3000,
                largeItem: 5000,
                express: 10000
            }
        });
        count++;
    });

    await batch.commit();
    console.log(`Successfully updated ${count} branches with standardized surcharges (3k/5k/10k).`);
}

standardizeSurcharges().catch(console.error);
