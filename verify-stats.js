const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, orderBy, limit } = require("firebase/firestore");

const firebaseConfig = {
    apiKey: "AIzaSyApy5zme7H15h1UZd1B9hBDOOWgpbvOLJ4",
    authDomain: "lilymagerp-fs1.firebaseapp.com",
    projectId: "lilymagerp-fs1",
    storageBucket: "lilymagerp-fs1.firebasestorage.app",
    messagingSenderId: "1069828102888",
    appId: "1:1069828102888:web:24927eab4719f3e75d475d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStats() {
    console.log("Checking dailyStats collection...");
    try {
        const q = query(collection(db, "dailyStats"), orderBy("date", "desc"), limit(5));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            console.log("No dailyStats found!");
            return;
        }

        console.log(`Found ${snapshot.docs.length} dailyStats documents.`);
        snapshot.forEach(doc => {
            console.log(`\nDate: ${doc.id}`);
            const data = doc.data();
            console.log(`Total Revenue: ${data.totalRevenue}`);
            console.log(`Total Order Count: ${data.totalOrderCount}`);
            console.log(`Branches: ${Object.keys(data.branches || {}).join(", ")}`);
        });
    } catch (error) {
        console.error("Error fetching stats:", error);
    }
}

checkStats().catch(console.error);
