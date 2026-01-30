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
        type: row.type || 'quotation',
        quotationNumber: row.quotation_number,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        validUntil: new Date(row.valid_until || row.expiry_date),
        customer: row.customer || {
            id: row.customer_id,
            name: row.customer_name || "",
            contact: row.customer_contact || "",
        },
        items: row.items || [],
        summary: row.summary || {
            subtotal: row.total_amount || 0,
            discountAmount: 0,
            taxAmount: 0,
            totalAmount: row.total_amount || 0,
            includeVat: true
        },
        status: row.status,
        notes: row.notes,
        terms: row.terms,
        branchId: row.branch_id,
        branchName: row.branch_name,
        provider: row.provider,
        createdBy: row.created_by
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

    const fetchQuotationById = useCallback(async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('quotations')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return mapRowToQuotation(data);
        } catch (error) {
            console.error("Error fetching quotation:", error);
            return null;
        }
    }, []);

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
                type: quotationData.type || 'quotation',
                quotation_number: quotationData.quotationNumber,
                created_at: new Date(quotationData.createdAt as any).toISOString(),
                updated_at: new Date().toISOString(),
                valid_until: new Date(quotationData.validUntil as any).toISOString(),
                customer: quotationData.customer,
                customer_id: quotationData.customer.id,
                customer_name: quotationData.customer.name,
                customer_contact: quotationData.customer.contact,
                items: quotationData.items,
                summary: quotationData.summary,
                total_amount: quotationData.summary.totalAmount,
                status: quotationData.status,
                notes: quotationData.notes,
                terms: quotationData.terms,
                branch_id: quotationData.branchId,
                branch_name: quotationData.branchName,
                provider: quotationData.provider,
                created_by: quotationData.createdBy
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

            if (quotationData.type) payload.type = quotationData.type;
            if (quotationData.quotationNumber) payload.quotation_number = quotationData.quotationNumber;
            if (quotationData.customer) {
                payload.customer = quotationData.customer;
                payload.customer_id = quotationData.customer.id;
                payload.customer_name = quotationData.customer.name;
                payload.customer_contact = quotationData.customer.contact;
            }
            if (quotationData.items) payload.items = quotationData.items;
            if (quotationData.summary) {
                payload.summary = quotationData.summary;
                payload.total_amount = quotationData.summary.totalAmount;
            }
            if (quotationData.validUntil) payload.valid_until = new Date(quotationData.validUntil as any).toISOString();
            if (quotationData.status) payload.status = quotationData.status;
            if (quotationData.notes) payload.notes = quotationData.notes;
            if (quotationData.terms) payload.terms = quotationData.terms;
            if (quotationData.branchId) payload.branch_id = quotationData.branchId;
            if (quotationData.branchName) payload.branch_name = quotationData.branchName;
            if (quotationData.provider) payload.provider = quotationData.provider;

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
        quotations, loading, fetchQuotationById, addQuotation, updateQuotation, deleteQuotation
    };
}
