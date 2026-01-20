"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
  defaultMarginPercent?: number; // 신규: 외부 발주 시 기본 마진율
  createdAt?: any;
  updatedAt?: any;
}

export function usePartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPartners = useCallback(async () => {
    try {
      setLoading(true);
      const partnersRef = collection(db, 'partners');
      const q = query(partnersRef, orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);

      const partnersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Partner[];

      setPartners(partnersData);
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
      const partnersRef = collection(db, 'partners');
      const newPartner = {
        ...partnerData,
        defaultMarginPercent: partnerData.defaultMarginPercent ?? 20,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(partnersRef, newPartner);
      await fetchPartners();
      toast({ title: '성공', description: '새 파트너가 등록되었습니다.' });
      return docRef.id;
    } catch (error) {
      console.error('파트너 등록 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '파트너 등록 중 오류가 발생했습니다.' });
      return null;
    }
  };

  const updatePartner = async (id: string, partnerData: Partial<Partner>) => {
    try {
      const partnerRef = doc(db, 'partners', id);
      await updateDoc(partnerRef, {
        ...partnerData,
        updatedAt: serverTimestamp()
      });
      await fetchPartners();
      toast({ title: '성공', description: '파트너 정보가 수정되었습니다.' });
    } catch (error) {
      console.error('파트너 수정 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '파트너 수정 중 오류가 발생했습니다.' });
    }
  };

  const deletePartner = async (id: string) => {
    try {
      const partnerRef = doc(db, 'partners', id);
      await deleteDoc(partnerRef);
      await fetchPartners();
      toast({ title: '성공', description: '파트너가 삭제되었습니다.' });
    } catch (error) {
      console.error('파트너 삭제 오류:', error);
      toast({ variant: 'destructive', title: '오류', description: '파트너 삭제 중 오류가 발생했습니다.' });
    }
  };

  const bulkAddPartners = async (partnersData: any[]) => {
    try {
      const batch = writeBatch(db);
      const partnersRef = collection(db, 'partners');

      partnersData.forEach((data) => {
        const docRef = doc(partnersRef);
        batch.set(docRef, {
          ...data,
          defaultMarginPercent: data.defaultMarginPercent ?? 20,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      await fetchPartners();
      return true;
    } catch (error) {
      console.error('Bulk add error:', error);
      throw error;
    }
  };

  return {
    partners,
    loading,
    fetchPartners,
    addPartner,
    updatePartner,
    deletePartner,
    bulkAddPartners
  };
}
