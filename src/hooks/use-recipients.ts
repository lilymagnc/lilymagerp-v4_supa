"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, where, orderBy, Timestamp, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
export interface Recipient {
  id: string;
  name: string;
  contact: string;
  address: string;
  district: string;
  branchName: string;
  orderCount: number;
  lastOrderDate: Timestamp;
  email?: string;
  marketingConsent?: boolean;
  source?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export function useRecipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchRecipients = useCallback(async (branchName?: string) => {
    setLoading(true);
    try {
      // [Supabase 우선 조회]
      let queryBuilder = supabase
        .from('recipients')
        .select('*')
        .order('last_order_date', { ascending: false });

      if (branchName) {
        queryBuilder = queryBuilder.eq('branch_name', branchName);
      }

      const { data: supabaseItems, error: supabaseError } = await queryBuilder;

      if (!supabaseError && supabaseItems) {
        const recipientsData = supabaseItems.map(item => ({
          id: item.id,
          name: item.name,
          contact: item.contact,
          address: item.address,
          district: item.district,
          branchName: item.branch_name,
          orderCount: item.order_count,
          lastOrderDate: item.last_order_date ? Timestamp.fromDate(new Date(item.last_order_date)) : undefined,
          email: item.email,
          marketingConsent: item.marketing_consent,
          source: item.source,
          createdAt: item.created_at ? Timestamp.fromDate(new Date(item.created_at)) : undefined,
          updatedAt: item.updated_at ? Timestamp.fromDate(new Date(item.updated_at)) : undefined
        } as Recipient));

        setRecipients(recipientsData);
        setLoading(false);
        return;
      }

      let recipientsQuery = query(
        collection(db, 'recipients')
      );
      // 이하 기존 Firebase 로직...
      if (branchName) {
        recipientsQuery = query(
          collection(db, 'recipients'),
          where('branchName', '==', branchName)
        );
      }
      const snapshot = await getDocs(recipientsQuery);
      const recipientsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Recipient[];
      // 클라이언트 사이드에서 정렬
      recipientsData.sort((a, b) => {
        if (!a.lastOrderDate || !b.lastOrderDate) return 0;
        return b.lastOrderDate.toMillis() - a.lastOrderDate.toMillis();
      });
      setRecipients(recipientsData);
    } catch (error) {
      console.error('Error fetching recipients:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  // 지역별 수령자 통계
  const getRecipientsByDistrict = useCallback(() => {
    const districtStats = recipients.reduce((acc, recipient) => {
      const district = recipient.district;
      if (!acc[district]) {
        acc[district] = {
          count: 0,
          totalOrders: 0,
          recipients: []
        };
      }
      acc[district].count++;
      acc[district].totalOrders += recipient.orderCount;
      acc[district].recipients.push(recipient);
      return acc;
    }, {} as Record<string, { count: number; totalOrders: number; recipients: Recipient[] }>);
    return districtStats;
  }, [recipients]);
  // 단골 수령자 (주문 횟수 3회 이상)
  const getFrequentRecipients = useCallback(() => {
    return recipients.filter(recipient => recipient.orderCount >= 3);
  }, [recipients]);
  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);
  // 수령자 정보 수정
  const updateRecipient = useCallback(async (recipientId: string, updatedData: Partial<Recipient>) => {
    try {
      const recipientRef = doc(db, 'recipients', recipientId);
      await updateDoc(recipientRef, {
        ...updatedData,
        updatedAt: serverTimestamp()
      });

      // [이중 저장: Supabase]
      const supabaseUpdateData: any = {};
      if (updatedData.name) supabaseUpdateData.name = updatedData.name;
      if (updatedData.contact) supabaseUpdateData.contact = updatedData.contact;
      if (updatedData.address) supabaseUpdateData.address = updatedData.address;
      if (updatedData.district) supabaseUpdateData.district = updatedData.district;
      if (updatedData.branchName) supabaseUpdateData.branch_name = updatedData.branchName;
      if (updatedData.orderCount !== undefined) supabaseUpdateData.order_count = updatedData.orderCount;
      if (updatedData.lastOrderDate) supabaseUpdateData.last_order_date = updatedData.lastOrderDate.toDate().toISOString();
      if (updatedData.email !== undefined) supabaseUpdateData.email = updatedData.email;
      if (updatedData.marketingConsent !== undefined) supabaseUpdateData.marketing_consent = updatedData.marketingConsent;
      if (updatedData.source) supabaseUpdateData.source = updatedData.source;
      supabaseUpdateData.updated_at = new Date().toISOString();

      await supabase.from('recipients').update(supabaseUpdateData).eq('id', recipientId);
      await fetchRecipients(); // 목록 새로고침
    } catch (error) {
      console.error('Error updating recipient:', error);
      throw error;
    }
  }, [fetchRecipients]);

  // 수령자 삭제
  const deleteRecipient = useCallback(async (recipientId: string) => {
    try {
      const recipientRef = doc(db, 'recipients', recipientId);
      await deleteDoc(recipientRef);

      // [이중 저장: Supabase]
      await supabase.from('recipients').delete().eq('id', recipientId);
      await fetchRecipients(); // 목록 새로고침
    } catch (error) {
      console.error('Error deleting recipient:', error);
      throw error;
    }
  }, [fetchRecipients]);

  return {
    recipients,
    loading,
    fetchRecipients,
    getRecipientsByDistrict,
    getFrequentRecipients,
    updateRecipient,
    deleteRecipient
  };
}
