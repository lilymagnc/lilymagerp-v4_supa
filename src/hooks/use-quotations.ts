import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    orderBy,
    addDoc,
    updateDoc,
    getDoc,
    getDocs,
    deleteDoc,
    doc,
    Timestamp,
    where
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { Quotation } from '@/types/quotation';
import { ExpenseRequest, Budget, MaterialRequest, ExpenseCategory } from '@/types';
import { EXPENSE_CATEGORY_LABELS } from '@/types/expense';
import { useToast } from '@/hooks/use-toast';

export function useQuotations(branchId?: string) {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchQuotations = async () => {
            setLoading(true);
            try {
                // [Supabase 우선 조회]
                let queryBuilder = supabase
                    .from('quotations')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (branchId) {
                    queryBuilder = queryBuilder.eq('branch_id', branchId);
                }

                const { data: supabaseQuotations, error: supabaseError } = await queryBuilder;

                if (!supabaseError && supabaseQuotations) {
                    const mappedQuotations = supabaseQuotations.map(q => ({
                        id: q.id,
                        quotationNumber: q.quotation_number,
                        customer: typeof q.customer === 'string' ? JSON.parse(q.customer) : q.customer || {
                            id: q.customer_id,
                            name: q.customer_name,
                            contact: q.customer_contact,
                            email: q.customer_email,
                            companyName: q.customer_company_name,
                            address: q.customer_address
                        },
                        branchId: q.branch_id,
                        branchName: q.branch_name,
                        items: q.items,
                        summary: typeof q.summary === 'string' ? JSON.parse(q.summary) : q.summary || {
                            subtotal: q.total_amount || 0,
                            discountAmount: 0,
                            taxAmount: 0,
                            totalAmount: q.total_amount || 0,
                            includeVat: false
                        },
                        status: q.status as any,
                        notes: q.notes,
                        terms: q.terms,
                        provider: q.provider || {},
                        createdBy: q.created_by,
                        validUntil: q.expiry_date ? Timestamp.fromDate(new Date(q.expiry_date)) : Timestamp.fromDate(new Date()),
                        createdAt: Timestamp.fromDate(new Date(q.created_at)),
                        updatedAt: Timestamp.fromDate(new Date(q.updated_at))
                    })) as unknown as Quotation[];
                    setQuotations(mappedQuotations);
                    setLoading(false);
                    return;
                }

                // Fallback: Firebase
                let q = query(collection(db, 'quotations'), orderBy('createdAt', 'desc'));
                if (branchId) {
                    q = query(collection(db, 'quotations'), where('branchId', '==', branchId), orderBy('createdAt', 'desc'));
                }
                const snapshot = await getDocs(q);
                const quotationData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Quotation[];
                setQuotations(quotationData);
            } catch (error) {
                console.error("Error fetching quotations:", error);
                toast({
                    variant: "destructive",
                    title: "견적서 로딩 실패",
                    description: "견적서 목록을 불러오는데 실패했습니다.",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchQuotations();
    }, [branchId, toast]);

    const addQuotation = useCallback(async (quotationData: Omit<Quotation, 'id'>) => {
        try {
            const docRef = await addDoc(collection(db, 'quotations'), {
                ...quotationData,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            // [이중 저장: Supabase]
            await supabase.from('quotations').insert([{
                id: docRef.id,
                quotation_number: quotationData.quotationNumber,
                customer_id: quotationData.customer?.id,
                customer_name: quotationData.customer?.name,
                customer_contact: quotationData.customer?.contact,
                customer_email: quotationData.customer?.email,
                customer_company_name: quotationData.customer?.companyName,
                customer_address: quotationData.customer?.address,
                branch_id: quotationData.branchId,
                branch_name: quotationData.branchName,
                items: quotationData.items,
                summary: quotationData.summary,
                total_amount: quotationData.summary?.totalAmount,
                expiry_date: quotationData.validUntil ? (quotationData.validUntil instanceof Timestamp ? quotationData.validUntil.toDate().toISOString() : new Date(quotationData.validUntil as any).toISOString()) : null,
                status: quotationData.status,
                notes: quotationData.notes,
                terms: quotationData.terms,
                provider: quotationData.provider,
                created_by: quotationData.createdBy,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }]);

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

            // [이중 저장: Supabase]
            const supabaseUpdates: any = {};
            if (quotationData.quotationNumber) supabaseUpdates.quotation_number = quotationData.quotationNumber;
            if (quotationData.customer) {
                if (quotationData.customer.id) supabaseUpdates.customer_id = quotationData.customer.id;
                if (quotationData.customer.name) supabaseUpdates.customer_name = quotationData.customer.name;
                if (quotationData.customer.contact) supabaseUpdates.customer_contact = quotationData.customer.contact;
                if (quotationData.customer.email) supabaseUpdates.customer_email = quotationData.customer.email;
                if (quotationData.customer.companyName) supabaseUpdates.customer_company_name = quotationData.customer.companyName;
                if (quotationData.customer.address) supabaseUpdates.customer_address = quotationData.customer.address;
            }
            if (quotationData.items) supabaseUpdates.items = quotationData.items;
            if (quotationData.summary) {
                supabaseUpdates.summary = quotationData.summary;
                supabaseUpdates.total_amount = quotationData.summary.totalAmount;
            }
            if (quotationData.validUntil) supabaseUpdates.expiry_date = (quotationData.validUntil instanceof Timestamp ? quotationData.validUntil.toDate().toISOString() : new Date(quotationData.validUntil as any).toISOString());
            if (quotationData.status) supabaseUpdates.status = quotationData.status;
            if (quotationData.notes !== undefined) supabaseUpdates.notes = quotationData.notes;
            if (quotationData.terms !== undefined) supabaseUpdates.terms = quotationData.terms;
            if (quotationData.provider) supabaseUpdates.provider = quotationData.provider;
            supabaseUpdates.updated_at = new Date().toISOString();

            await supabase.from('quotations').update(supabaseUpdates).eq('id', id);
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

            // [이중 저장: Supabase]
            await supabase.from('quotations').delete().eq('id', id);
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
