"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Recipient {
  id: string;
  name: string;
  contact: string;
  address: string;
  district: string;
  branchName: string;
  orderCount: number;
  lastOrderDate: string;
  email?: string;
  marketingConsent?: boolean;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useRecipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);

  const mapRowToRecipient = useCallback((row: any): Recipient => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    address: row.address,
    district: row.district,
    branchName: row.branch_name,
    orderCount: row.order_count,
    lastOrderDate: row.last_order_date,
    email: row.email,
    marketingConsent: row.marketing_consent,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }), []);

  const fetchRecipients = useCallback(async (branchName?: string) => {
    setLoading(true);
    try {
      let query = supabase.from('recipients').select('*');
      if (branchName) query = query.eq('branch_name', branchName);

      const { data, error } = await query.order('last_order_date', { ascending: false });
      if (error) throw error;
      setRecipients((data || []).map(mapRowToRecipient));
    } catch (error) {
      console.error('Error fetching recipients:', error);
    } finally {
      setLoading(false);
    }
  }, [mapRowToRecipient]);

  const getRecipientsByDistrict = useCallback(() => {
    const districtStats = recipients.reduce((acc, recipient) => {
      const district = recipient.district;
      if (!acc[district]) {
        acc[district] = { count: 0, totalOrders: 0, recipients: [] };
      }
      acc[district].count++;
      acc[district].totalOrders += Number(recipient.orderCount);
      acc[district].recipients.push(recipient);
      return acc;
    }, {} as Record<string, { count: number; totalOrders: number; recipients: Recipient[] }>);
    return districtStats;
  }, [recipients]);

  const getFrequentRecipients = useCallback(() => {
    return recipients.filter(recipient => Number(recipient.orderCount) >= 3);
  }, [recipients]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const updateRecipient = useCallback(async (recipientId: string, updatedData: Partial<Recipient>) => {
    try {
      const payload: any = {
        updated_at: new Date().toISOString()
      };
      if (updatedData.name) payload.name = updatedData.name;
      if (updatedData.contact) payload.contact = updatedData.contact;
      if (updatedData.address) payload.address = updatedData.address;
      if (updatedData.district) payload.district = updatedData.district;
      if (updatedData.branchName) payload.branch_name = updatedData.branchName;
      if (updatedData.orderCount !== undefined) payload.order_count = updatedData.orderCount;
      if (updatedData.lastOrderDate) payload.last_order_date = updatedData.lastOrderDate;
      if (updatedData.email !== undefined) payload.email = updatedData.email;
      if (updatedData.marketingConsent !== undefined) payload.marketing_consent = updatedData.marketing_consent;
      if (updatedData.source) payload.source = updatedData.source;

      const { error } = await supabase.from('recipients').update(payload).eq('id', recipientId);
      if (error) throw error;
      await fetchRecipients();
    } catch (error) {
      console.error('Error updating recipient:', error);
      throw error;
    }
  }, [fetchRecipients]);

  const deleteRecipient = useCallback(async (recipientId: string) => {
    try {
      const { error } = await supabase.from('recipients').delete().eq('id', recipientId);
      if (error) throw error;
      await fetchRecipients();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      throw error;
    }
  }, [fetchRecipients]);

  return {
    recipients, loading, fetchRecipients, getRecipientsByDistrict, getFrequentRecipients, updateRecipient, deleteRecipient
  };
}
