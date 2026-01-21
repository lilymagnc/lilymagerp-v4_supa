"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';

export interface Partner {
  id: string;
  name: string;
  type?: string;
  category?: 'wholesale' | 'florist';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  businessNumber?: string;
  ceoName?: string;
  bankAccount?: string;
  items?: string;
  memo?: string;
  branch?: string;
  defaultMarginPercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const mapRowToPartner = (row: any): Partner => ({
    id: row.id,
    name: row.name,
    type: row.type,
    category: row.category,
    contactPerson: row.contact_person,
    phone: row.contact,
    email: row.email,
    address: row.address,
    businessNumber: row.business_number,
    ceoName: row.ceo_name,
    bankAccount: row.bank_account,
    items: row.items,
    memo: row.memo,
    branch: row.branch,
    defaultMarginPercent: row.default_margin_percent,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('partners').select('*').order('name', { ascending: true });
      if (error) throw error;
      setPartners((data || []).map(mapRowToPartner));
    } catch (error) {
      console.error('파트너 목록 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const addPartner = async (partnerData: Omit<Partner, 'id'>) => {
    try {
      const id = crypto.randomUUID();
      const payload = {
        id,
        name: partnerData.name,
        type: partnerData.type,
        category: partnerData.category,
        contact_person: partnerData.contactPerson,
        contact: partnerData.phone,
        email: partnerData.email,
        address: partnerData.address,
        business_number: partnerData.businessNumber,
        ceo_name: partnerData.ceoName,
        bank_account: partnerData.bankAccount,
        branch: partnerData.branch,
        items: partnerData.items,
        memo: partnerData.memo,
        default_margin_percent: partnerData.defaultMarginPercent ?? 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('partners').insert([payload]);
      if (error) throw error;

      await fetchPartners();
      toast({ title: '성공', description: '새 파트너가 등록되었습니다.' });
      return id;
    } catch (error) {
      console.error('파트너 등록 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '파트너 등록 중 오류가 발생했습니다.' });
      return null;
    }
  };

  const updatePartner = async (id: string, partnerData: Partial<Partner>) => {
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };

      if (partnerData.name) payload.name = partnerData.name;
      if (partnerData.type) payload.type = partnerData.type;
      if (partnerData.category) payload.category = partnerData.category;
      if (partnerData.contactPerson) payload.contact_person = partnerData.contactPerson;
      if (partnerData.phone) payload.contact = partnerData.phone;
      if (partnerData.email) payload.email = partnerData.email;
      if (partnerData.address) payload.address = partnerData.address;
      if (partnerData.businessNumber) payload.business_number = partnerData.businessNumber;
      if (partnerData.ceoName) payload.ceo_name = partnerData.ceoName;
      if (partnerData.bankAccount) payload.bank_account = partnerData.bankAccount;
      if (partnerData.items) payload.items = partnerData.items;
      if (partnerData.memo) payload.memo = partnerData.memo;
      if (partnerData.branch) payload.branch = partnerData.branch;
      if (partnerData.defaultMarginPercent !== undefined) payload.default_margin_percent = partnerData.defaultMarginPercent;

      const { error } = await supabase.from('partners').update(payload).eq('id', id);
      if (error) throw error;

      await fetchPartners();
      toast({ title: '성공', description: '파트너 정보가 수정되었습니다.' });
    } catch (error) {
      console.error('파트너 수정 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '파트너 수정 중 오류가 발생했습니다.' });
    }
  };

  const deletePartner = async (id: string) => {
    try {
      const { error } = await supabase.from('partners').delete().eq('id', id);
      if (error) throw error;
      await fetchPartners();
      toast({ title: '성공', description: '파트너가 삭제되었습니다.' });
    } catch (error) {
      console.error('파트너 삭제 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '파트너 삭제 중 오류가 발생했습니다.' });
    }
  };

  const bulkAddPartners = async (partnersData: any[]) => {
    try {
      const payloads = partnersData.map(data => ({
        id: crypto.randomUUID(),
        name: data.name,
        type: data.type,
        category: data.category,
        contact_person: data.contactPerson,
        contact: data.phone,
        email: data.email,
        address: data.address,
        business_number: data.businessNumber,
        ceo_name: data.ceoName,
        bank_account: data.bankAccount,
        branch: data.branch,
        items: data.items,
        memo: data.memo,
        default_margin_percent: data.defaultMarginPercent ?? 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase.from('partners').insert(payloads);
      if (error) throw error;

      await fetchPartners();
      return true;
    } catch (error) {
      console.error('Bulk add error:', error);
      throw error;
    }
  };

  return {
    partners, loading, fetchPartners, addPartner, updatePartner, deletePartner, bulkAddPartners
  };
}
