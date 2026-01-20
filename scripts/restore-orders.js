const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc, getDoc } = require('firebase/firestore');

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyApy5zme7H15h1UZd1B9hBDOOWgpbvOLJ4",
    authDomain: "lilymagerp-fs1.firebaseapp.com",
    databaseURL: "https://lilymagerp-fs1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "lilymagerp-fs1",
    storageBucket: "lilymagerp-fs1.firebasestorage.app",
    messagingSenderId: "1069828102888",
    appId: "1:1069828102888:web:24927eab4719f3e75d475d",
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restoreOrders() {
    try {
        console.log('🔄 Starting order restoration process...\n');

        // 1. Get all orders from orders_2025
        const orders2025Ref = collection(db, 'orders_2025');
        const snapshot = await getDocs(orders2025Ref);

        console.log(`📦 Found ${snapshot.size} orders in orders_2025`);

        if (snapshot.size === 0) {
            console.log('✅ No orders to restore. orders_2025 is empty.');
            return 0;
        }

        // 2. Move them back to orders collection
        let count = 0;
        const batchSize = 500; // Firestore batch limit
        let currentBatch = writeBatch(db);
        let batchCount = 0;

        for (const docSnapshot of snapshot.docs) {
            const data = docSnapshot.data();

            // Remove archive-specific fields
            delete data.isArchived;
            delete data.archivedAt;

            // Add back to orders collection
            const orderRef = doc(db, 'orders', docSnapshot.id);
            currentBatch.set(orderRef, data);
            batchCount++;

            // Delete from orders_2025
            currentBatch.delete(docSnapshot.ref);
            batchCount++;

            count++;

            // Commit batch every 250 documents (500 operations = 250 set + 250 delete)
            if (batchCount >= 500) {
                await currentBatch.commit();
                console.log(`✅ Restored ${count} orders...`);
                currentBatch = writeBatch(db);
                batchCount = 0;
            }
        }

        // Commit remaining operations
        if (batchCount > 0) {
            await currentBatch.commit();
        }

        console.log(`\n✅ Successfully restored ${count} orders to orders collection`);
        console.log('🗑️  orders_2025 collection is now empty\n');

        return count;

    } catch (error) {
        console.error('❌ Error restoring orders:', error);
        throw error;
    }
}

async function deleteCollection(collectionName) {
    try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);

        if (snapshot.size === 0) {
            console.log(`✅ ${collectionName} is already empty`);
            return 0;
        }

        console.log(`🗑️  Deleting ${snapshot.size} documents from ${collectionName}...`);

        let deletedCount = 0;
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const docSnapshot of snapshot.docs) {
            batch.delete(docSnapshot.ref);
            batchCount++;
            deletedCount++;

            if (batchCount >= 500) {
                await batch.commit();
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
        return deletedCount;

    } catch (error) {
        console.error(`❌ Error deleting ${collectionName}:`, error);
        throw error;
    }
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  Firestore Data Restoration Tool');
    console.log('═══════════════════════════════════════\n');

    try {
        // Restore orders
        const restoredCount = await restoreOrders();

        // Note: We can't easily delete nested subcollections with client SDK
        // The stats and branchStats collections will need manual deletion or admin SDK
        console.log('\n⚠️  Note: stats and branchStats collections contain subcollections');
        console.log('   These need to be deleted manually from Firebase Console or with Admin SDK\n');

        console.log('═══════════════════════════════════════');
        console.log(`  ✅ Restored ${restoredCount} orders!`);
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('💥 Restoration failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

main();
