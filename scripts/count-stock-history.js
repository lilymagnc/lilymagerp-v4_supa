
import { db } from './src/lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';

async function countRecords() {
    const coll = collection(db, 'stockHistory');
    const snapshot = await getCountFromServer(coll);
    console.log('Total records in stockHistory:', snapshot.data().count);
}

countRecords();
