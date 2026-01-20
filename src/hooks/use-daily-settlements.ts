"use client";

import { useState, useCallback } from 'react';
import {
    doc,
    getDoc,
    setDoc,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
import { DailySettlementRecord } from '@/types/daily-settlement';

export function useDailySettlements() {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const getSettlement = useCallback(async (branchId: string, date: string): Promise<DailySettlementRecord | null> => {
        if (!branchId || !date) return null;
        setLoading(true);
        try {
            const docId = `${branchId}_${date}`;
            const docRef = doc(db, 'dailySettlements', docId);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                return { id: snapshot.id, ...snapshot.data() } as DailySettlementRecord;
            }
            return null;
        } catch (error) {
            console.error('Error fetching daily settlement:', error);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const saveSettlement = useCallback(async (data: Partial<DailySettlementRecord>) => {
        if (!data.branchId || !data.date) return false;
        setLoading(true);
        try {
            const docId = `${data.branchId}_${data.date}`;
            const docRef = doc(db, 'dailySettlements', docId);

            const payload = {
                ...data,
                updatedAt: serverTimestamp(),
            };

            if (!data.createdAt) {
                (payload as any).createdAt = serverTimestamp();
            }

            await setDoc(docRef, payload, { merge: true });

            toast({
                title: "정산 완료",
                description: `${data.date} 정산 정보가 저장되었습니다.`,
            });
            return true;
        } catch (error) {
            console.error('Error saving daily settlement:', error);
            toast({
                variant: "destructive",
                title: "저장 실패",
                description: "정산 정보 저장 중 오류가 발생했습니다.",
            });
            return false;
        } finally {
            setLoading(false);
        }
    }, [toast]);

    return {
        loading,
        getSettlement,
        saveSettlement
    };
}
