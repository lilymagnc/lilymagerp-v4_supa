"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
export interface DeliveryFeeData {
  id: string;
  branchId: string;
  branchName: string;
  district: string;
  fee: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export function useDeliveryFees() {
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFeeData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const fetchDeliveryFees = useCallback(async () => {
    try {
      setLoading(true);

      // [Supabase 우선 조회]
      const { data: supabaseFees, error: supabaseError } = await supabase
        .from('delivery_fees')
        .select('*')
        .eq('is_active', true);

      if (!supabaseError && supabaseFees) {
        const mappedFees = supabaseFees.map(f => ({
          id: f.id,
          branchId: f.branch_id,
          branchName: f.branch_name,
          district: f.district,
          fee: f.fee,
          isActive: f.is_active,
          createdAt: new Date(f.created_at),
          updatedAt: new Date(f.updated_at),
        } as DeliveryFeeData));
        setDeliveryFees(mappedFees);
        setLoading(false);
        return;
      }

      // Fallback: Firebase
      const deliveryFeesCollection = collection(db, 'deliveryFees');
      const q = query(deliveryFeesCollection, where("isActive", "==", true));
      const querySnapshot = await getDocs(q);
      const feesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as DeliveryFeeData));
      setDeliveryFees(feesData);
    } catch (error) {
      console.error("Error fetching delivery fees:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  const getDeliveryFeesByBranch = useCallback((branchId: string) => {
    return deliveryFees.filter(fee => fee.branchId === branchId);
  }, [deliveryFees]);
  const updateDeliveryFee = async (feeId: string, updates: Partial<DeliveryFeeData>) => {
    try {
      const feeDoc = doc(db, 'deliveryFees', feeId);
      await setDoc(feeDoc, {
        ...updates,
        updatedAt: new Date()
      }, { merge: true });

      // [이중 저장: Supabase]
      const supabaseUpdates: any = {};
      if (updates.branchId) supabaseUpdates.branch_id = updates.branchId;
      if (updates.branchName) supabaseUpdates.branch_name = updates.branchName;
      if (updates.district) supabaseUpdates.district = updates.district;
      if (updates.fee !== undefined) supabaseUpdates.fee = updates.fee;
      if (updates.isActive !== undefined) supabaseUpdates.is_active = updates.isActive;
      supabaseUpdates.updated_at = new Date().toISOString();

      await supabase.from('delivery_fees').update(supabaseUpdates).eq('id', feeId);

      toast({
        title: '성공',
        description: '배송비가 성공적으로 수정되었습니다.',
      });
      await fetchDeliveryFees();
    } catch (error) {
      console.error("Error updating delivery fee:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 수정 중 오류가 발생했습니다.',
      });
    }
  };
  const initializeDeliveryFees = async (branches: any[]) => {
    try {
      const batch = writeBatch(db);
      const supabaseBatch: any[] = [];
      branches.forEach(branch => {
        if (branch.deliveryFees) {
          branch.deliveryFees.forEach((fee: any) => {
            const docRef = doc(collection(db, 'deliveryFees'));
            const feeId = docRef.id;
            const now = new Date();

            batch.set(docRef, {
              branchId: branch.id,
              branchName: branch.name,
              district: fee.district,
              fee: fee.fee,
              isActive: true,
              createdAt: now,
              updatedAt: now
            });

            supabaseBatch.push({
              id: feeId,
              branch_id: branch.id,
              branch_name: branch.name,
              district: fee.district,
              fee: fee.fee,
              is_active: true,
              created_at: now.toISOString(),
              updated_at: now.toISOString()
            });
          });
        }
      });
      await batch.commit();

      // [이중 저장: Supabase]
      if (supabaseBatch.length > 0) {
        await supabase.from('delivery_fees').insert(supabaseBatch);
      }
      await fetchDeliveryFees();
      toast({
        title: '성공',
        description: '배송비 데이터가 초기화되었습니다.',
      });
    } catch (error) {
      console.error("Error initializing delivery fees:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '배송비 초기화 중 오류가 발생했습니다.',
      });
    }
  };
  useEffect(() => {
    fetchDeliveryFees();
  }, [fetchDeliveryFees]);
  return {
    deliveryFees,
    loading,
    getDeliveryFeesByBranch,
    updateDeliveryFee,
    initializeDeliveryFees,
    refetch: fetchDeliveryFees
  };
}
