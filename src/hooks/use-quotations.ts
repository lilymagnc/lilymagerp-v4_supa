"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Quotation } from '@/types/quotation';
import { useToast } from '@/hooks/use-toast';

export function useQuotations(branchId?: string) {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const mapRowToQuotation = (row: any): Quotation => ({
        id: row.id,
        quotationNumber: row.quotation_number,
        customerId: row.customer_id,
        customerName: row.customer_name,
        customerContact: row.customer_contact,
        branchId: row.branch_id,
        items: row.items || [],
        totalAmount: row.total_amount,
        expiryDate: row.expiry_date ? new Date(row.expiry_date) : undefined,
        status: row.status,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    });

    const fetchQuotations = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase.from('quotations').select('*').order('created_at', { ascending: false });
            if (branchId) query = query.eq('branch_id', branchId);

            const { data, error } = await query;
            if (error) throw error;

            setQuotations((data || []).map(mapRowToQuotation));
        } catch (error) {
            console.error("Error fetching quotations:", error);
            toast({ variant: "destructive", title: "견적서 로딩 실패", description: "견적서 목록을 불러오는데 실패했습니다." });
        } finally {
            setLoading(false);
        }
    }, [branchId, toast]);

    useEffect(() => {
        fetchQuotations();

        const channel = supabase.channel('quotations_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'quotations',
                filter: branchId ? `branch_id=eq.${branchId}` : undefined
            }, () => {
                fetchQuotations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [branchId, fetchQuotations]);

    const addQuotation = useCallback(async (quotationData: Omit<Quotation, 'id'>) => {
        try {
            const id = crypto.randomUUID();
            const payload = {
                id,
                quotation_number: quotationData.quotationNumber,
                customer_id: quotationData.customerId,
                customer_name: quotationData.customerName,
                customer_contact: quotationData.customerContact,
                branch_id: quotationData.branchId,
                items: quotationData.items,
                total_amount: quotationData.totalAmount,
                expiry_date: quotationData.expiryDate ? new Date(quotationData.expiryDate).toISOString() : null,
                status: quotationData.status,
                notes: quotationData.notes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase.from('quotations').insert([payload]);
            if (error) throw error;

            toast({ title: "견적서 생성 완료", description: "새로운 견적서가 생성되었습니다." });
            return id;
        } catch (error) {
            console.error("Error adding quotation:", error);
            toast({ variant: "destructive", title: "견적서 생성 실패", description: "오류가 발생했습니다." });
            throw error;
        }
    }, [toast]);

    const updateQuotation = useCallback(async (id: string, quotationData: Partial<Quotation>) => {
        try {
            const payload: any = {
                updated_at: new Date().toISOString()
            };

            if (quotationData.quotationNumber) payload.quotation_number = quotationData.quotationNumber;
            if (quotationData.customerId) payload.customer_id = quotationData.customerId;
            if (quotationData.customerName) payload.customer_name = quotationData.customerName;
            if (quotationData.customerContact) payload.customer_contact = quotationData.customerContact;
            if (quotationData.branchId) payload.branch_id = quotationData.branchId;
            if (quotationData.items) payload.items = quotationData.items;
            if (quotationData.totalAmount !== undefined) payload.total_amount = quotationData.totalAmount;
            if (quotationData.expiryDate) payload.expiry_date = new Date(quotationData.expiryDate).toISOString();
            if (quotationData.status) payload.status = quotationData.status;
            if (quotationData.notes) payload.notes = quotationData.notes;

            const { error } = await supabase.from('quotations').update(payload).eq('id', id);
            if (error) throw error;

            toast({ title: "견적서 수정 완료", description: "견적서가 수정되었습니다." });
        } catch (error) {
            console.error("Error updating quotation:", error);
            toast({ variant: "destructive", title: "견적서 수정 실패", description: "오류가 발생했습니다." });
            throw error;
        }
    }, [toast]);

    const deleteQuotation = useCallback(async (id: string) => {
        try {
            const { error } = await supabase.from('quotations').delete().eq('id', id);
            if (error) throw error;

            toast({ title: "견적서 삭제 완료", description: "견적서가 삭제되었습니다." });
        } catch (error) {
            console.error("Error deleting quotation:", error);
            toast({ variant: "destructive", title: "견적서 삭제 실패", description: "오류가 발생했습니다." });
            throw error;
        }
    }, [toast]);

    return {
        quotations, loading, addQuotation, updateQuotation, deleteQuotation
    };
}
