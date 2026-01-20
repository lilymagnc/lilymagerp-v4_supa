const { initializeApp } = require("firebase/app");
const {
    getFirestore,
    collection,
    getDocs,
    setDoc,
    doc,
    Timestamp
} = require("firebase/firestore");

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

async function bootstrap() {
    console.log("Fetching all orders...");
    const ordersSnapshot = await getDocs(collection(db, "orders"));
    console.log(`Found ${ordersSnapshot.docs.length} orders.`);

    const dailyStats = {};

    ordersSnapshot.docs.forEach((orderDoc) => {
        const data = orderDoc.data();
        if (data.status === 'canceled') return;

        let date;
        if (data.orderDate instanceof Timestamp) {
            date = data.orderDate.toDate();
        } else if (data.orderDate && data.orderDate.seconds) {
            date = new Timestamp(data.orderDate.seconds, data.orderDate.nanoseconds).toDate();
        } else {
            date = new Date(data.orderDate);
        }

        if (isNaN(date.getTime())) return;

        const dateStr = date.toISOString().split('T')[0];
        const branchName = data.branchName || "Unknown";
        const revenue = data.summary?.total || 0;
        const isSettled = data.payment?.status === 'paid' || data.payment?.status === 'completed';

        if (!dailyStats[dateStr]) {
            dailyStats[dateStr] = {
                date: dateStr,
                totalRevenue: 0,
                totalOrderCount: 0,
                totalSettledAmount: 0,
                branches: {}
            };
        }

        dailyStats[dateStr].totalRevenue += revenue;
        dailyStats[dateStr].totalOrderCount += 1;
        if (isSettled) {
            dailyStats[dateStr].totalSettledAmount += revenue;
        }

        const branchKey = branchName.replace(/\./g, '_');
        if (!dailyStats[dateStr].branches[branchKey]) {
            dailyStats[dateStr].branches[branchKey] = {
                revenue: 0,
                orderCount: 0,
                settledAmount: 0
            };
        }

        dailyStats[dateStr].branches[branchKey].revenue += revenue;
        dailyStats[dateStr].branches[branchKey].orderCount += 1;
        if (isSettled) {
            dailyStats[dateStr].branches[branchKey].settledAmount += revenue;
        }
    });

    console.log(`Computed stats for ${Object.keys(dailyStats).length} days.`);

    for (const dateStr in dailyStats) {
        const stats = dailyStats[dateStr];
        stats.lastUpdated = new Date();
        await setDoc(doc(db, "dailyStats", dateStr), stats);
        console.log(`Saved stats for ${dateStr}`);
    }

    console.log("Bootstrap complete!");
}

bootstrap().catch(console.error);
