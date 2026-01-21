"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

  const mapRowToHistory = useCallback((row: any): StockHistory => ({
    id: row.id,
    date: row.occurred_at,
    type: row.type,
    itemType: row.item_type,
    itemName: row.item_name,
    quantity: row.quantity,
    fromStock: row.from_stock,
    toStock: row.to_stock,
    resultingStock: row.resulting_stock,
    branch: row.branch,
    operator: row.operator,
    supplier: row.supplier,
    price: row.price,
    totalAmount: row.total_amount
  }), []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('stock_history')
        .select('*')
        .order('occurred_at', { ascending: false });

      if (error) throw error;
      setHistory((data || []).map(mapRowToHistory));
    } catch (error) {
      console.error("Error fetching stock history:", error);
      toast({
        variant: "destructive",
        title: "오류",
        description: "재고 기록을 불러오는 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  }, [toast, mapRowToHistory]);

  useEffect(() => {
    fetchHistory();

    const channel = supabase.channel('stock_history_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_history' }, () => {
        fetchHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHistory]);

  const deleteHistoryRecord = async (id: string) => {
    try {
      const { error } = await supabase.from('stock_history').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: "성공",
        description: "재고 변동 기록이 삭제되었습니다."
      });
      await fetchHistory();
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
