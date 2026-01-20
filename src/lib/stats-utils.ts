import { db } from '@/lib/firebase';
import {
    doc,
    runTransaction,
    serverTimestamp,
    increment,
    Timestamp,
    collection,
    query,
    where,
    orderBy,
    getDocs
} from 'firebase/firestore';

export async function updateDailyStats(
    orderDate: Date | Timestamp | string,
    branchName: string,
    change: {
        revenueDelta: number;
        orderCountDelta: number;
        settledAmountDelta: number;
    }
) {
    if (!orderDate || !branchName) return;

    const date = orderDate instanceof Date
        ? orderDate
        : orderDate instanceof Timestamp
            ? orderDate.toDate()
            : new Date(orderDate);

    const dateStr = date.toISOString().split('T')[0];
    const statsRef = doc(db, 'dailyStats', dateStr);

    try {
        await runTransaction(db, async (transaction) => {
            const statsDoc = await transaction.get(statsRef);

            const updateData: any = {
                date: dateStr,
                lastUpdated: serverTimestamp(),
                totalRevenue: increment(change.revenueDelta),
                totalOrderCount: increment(change.orderCountDelta),
                totalSettledAmount: increment(change.settledAmountDelta),
            };

            // Branch specific stats
            const branchKey = `branches.${branchName.replace(/\./g, '_')}`;
            updateData[`${branchKey}.revenue`] = increment(change.revenueDelta);
            updateData[`${branchKey}.orderCount`] = increment(change.orderCountDelta);
            updateData[`${branchKey}.settledAmount`] = increment(change.settledAmountDelta);

            if (!statsDoc.exists()) {
                transaction.set(statsRef, {
                    date: dateStr,
                    lastUpdated: serverTimestamp(),
                    totalRevenue: change.revenueDelta,
                    totalOrderCount: change.orderCountDelta,
                    totalSettledAmount: change.settledAmountDelta,
                    branches: {
                        [branchName.replace(/\./g, '_')]: {
                            revenue: change.revenueDelta,
                            orderCount: change.orderCountDelta,
                            settledAmount: change.settledAmountDelta
                        }
                    }
                });
            } else {
                transaction.update(statsRef, updateData);
            }
        });
    } catch (error) {
        console.error('Error updating daily stats:', error);
    }
}

/**
 * 특정 기간의 일별 통계를 가져옵니다.
 */
export async function fetchDailyStats(startDate: string, endDate: string) {
    try {
        const statsRef = collection(db, 'dailyStats');
        const q = query(
            statsRef,
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error fetching daily stats:', error);
        return [];
    }
}
