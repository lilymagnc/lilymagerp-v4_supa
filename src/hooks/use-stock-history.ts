"use client";
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from './use-toast';
export interface StockHistory {
  id: string;
  date: string;
  type: "in" | "out" | "manual_update";
  itemType: "product" | "material";
  itemName: string;
  quantity: number;
  fromStock?: number;
  toStock?: number;
  resultingStock: number;
  branch: string;
  operator: string;
  supplier?: string;
  price?: number;
  totalAmount?: number;
}
export function useStockHistory() {
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "stockHistory"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const historyData: StockHistory[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        historyData.push({
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate().toISOString() : new Date().toISOString(),
        } as StockHistory);
      });
      setHistory(historyData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching stock history:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "재고 기록을 불러오는 중 오류가 발생했습니다."
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast]);
  const deleteHistoryRecord = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'stockHistory', id));
      toast({
        title: "성공",
        description: "재고 변동 기록이 삭제되었습니다."
      });
    } catch (error) {
      console.error("Error deleting stock history record:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "재고 변동 기록 삭제 중 오류가 발생했습니다."
      });
    }
  };
  return {
    history,
    loading,
    deleteHistoryRecord
  };
}
