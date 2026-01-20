"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
      branches.forEach(branch => {
        if (branch.deliveryFees) {
          branch.deliveryFees.forEach((fee: any) => {
            const docRef = doc(collection(db, 'deliveryFees'));
            batch.set(docRef, {
              branchId: branch.id,
              branchName: branch.name,
              district: fee.district,
              fee: fee.fee,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          });
        }
      });
      await batch.commit();
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
