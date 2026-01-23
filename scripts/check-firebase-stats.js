const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getCountFromServer } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyApy5zme7H15h1UZd1B9hBDOOWgpbvOLJ4",
    authDomain: "lilymagerp-fs1.firebaseapp.com",
    databaseURL: "https://lilymagerp-fs1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "lilymagerp-fs1",
    storageBucket: "lilymagerp-fs1.firebasestorage.app",
    messagingSenderId: "1069828102888",
    appId: "1:1069828102888:web:24927eab4719f3e75d475d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTIONS = [
    'branches',
    'customers',
    'products',
    'materials',
    'orders',
    'orderTransfers',
    'expenseRequests',
    'simpleExpenses',
    'userRoles',
    'albums',
    'auditLogs',
    'notifications',
    'calendarEvents'
];

async function getStats() {
    console.log('📊 Firebase 데이터 통계 조회 중...\n');
    let totalDocs = 0;

    for (const collName of COLLECTIONS) {
        try {
            const coll = collection(db, collName);
            const snapshot = await getCountFromServer(coll);
            const count = snapshot.data().count;
            console.log(`${collName.padEnd(20)}: ${count.toLocaleString()} 개`);
            totalDocs += count;
        } catch (error) {
            console.log(`${collName.padEnd(20)}: 조회 실패 (컬렉션이 없거나 권한 부족)`);
        }
    }

    console.log('\n' + '='.repeat(30));
    console.log(`총 문서 수: ${totalDocs.toLocaleString()} 개`);
    console.log('='.repeat(30));
    console.log('\n* 참고: Firestore 클라이언트 SDK로는 데이터의 정확한 바이트 크기를 조회할 수 없습니다.');
    console.log('* 문서 수와 각 문서의 대략적인 크기를 기반으로 추정해야 합니다.');
}

getStats();
