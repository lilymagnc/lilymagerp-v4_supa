const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, limit, query } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyApy5zme7H15h1UZd1B9hBDOOWgpbvOLJ4",
    authDomain: "lilymagerp-fs1.firebaseapp.com",
    projectId: "lilymagerp-fs1",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
    try {
        const q = query(collection(db, 'branches'), limit(1));
        const snapshot = await getDocs(q);
        console.log('Firebase success, found docs:', snapshot.size);
    } catch (e) {
        console.error('Firebase error:', e);
    }
}

test();
