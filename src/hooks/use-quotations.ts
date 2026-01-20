import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    Timestamp,
    where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Quotation } from '@/types/quotation';
import { useToast } from '@/hooks/use-toast';

export function useQuotations(branchId?: string) {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        let q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));

        if (branchId) {
            q = query(collection(db, 'quotations'), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const quotationData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Quotation[];
            setQuotations(quotationData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching quotations:", error);
            setLoading(false);
            toast({
                variant: "destructive",
                title: "견적서 로딩 실패",
                description: "견적서 목록을 불러오는데 실패했습니다.",
            });
        });

        return () => unsubscribe();
    }, [branchId, toast]);

    const addQuotation = useCallback(async (quotationData: Omit<Quotation, 'id'>) => {
        try {
            const docRef = await addDoc(collection(db, 'quotations'), {
                ...quotationData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            toast({
                title: "견적서 생성 완료",
                description: "새로운 견적서가 생성되었습니다.",
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding quotation:", error);
            toast({
                variant: "destructive",
                title: "견적서 생성 실패",
                description: "견적서를 생성하는 중 오류가 발생했습니다.",
            });
            throw error;
        }
    }, [toast]);

    const updateQuotation = useCallback(async (id: string, quotationData: Partial<Quotation>) => {
        try {
            const docRef = doc(db, 'quotations', id);
            await updateDoc(docRef, {
                ...quotationData,
                updatedAt: Timestamp.now(),
            });
            toast({
                title: "견적서 수정 완료",
                description: "견적서가 수정되었습니다.",
            });
        } catch (error) {
            console.error("Error updating quotation:", error);
            toast({
                variant: "destructive",
                title: "견적서 수정 실패",
                description: "견적서를 수정하는 중 오류가 발생했습니다.",
            });
            throw error;
        }
    }, [toast]);

    const deleteQuotation = useCallback(async (id: string) => {
        try {
            await deleteDoc(doc(db, 'quotations', id));
            toast({
                title: "견적서 삭제 완료",
                description: "견적서가 삭제되었습니다.",
            });
        } catch (error) {
            console.error("Error deleting quotation:", error);
            toast({
                variant: "destructive",
                title: "견적서 삭제 실패",
                description: "견적서를 삭제하는 중 오류가 발생했습니다.",
            });
            throw error;
        }
    }, [toast]);

    return {
        quotations,
        loading,
        addQuotation,
        updateQuotation,
        deleteQuotation
    };
}
