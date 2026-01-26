
"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface Recipient {
  id: string;
  name: string;
  contact: string;
  address: string;
  detailAddress: string;
  district?: string;
  zipCode?: string;
  branchName: string;
  orderCount: number;
  lastOrderDate: string;
  memo?: string;
  email?: string;
  marketingConsent?: boolean;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useRecipients() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRecipients = useCallback(async (branchName?: string) => {
    try {
      setLoading(true);

      // 'recipients' 테이블 대신 'orders' 테이블에서 배송 정보를 추출하여 집계합니다.
      // 성능을 위해 최근 2000건만 분석 (필요시 늘릴 수 있음)
      let query = supabase
        .from('orders')
        .select('id, delivery_info, order_date, branch_name')
        .not('delivery_info', 'is', null)
        .order('order_date', { ascending: false })
        .limit(2000);

      if (branchName && branchName !== 'all') {
        query = query.eq('branch_name', branchName);
      }

      const { data: orders, error } = await query;

      if (error) {
        // 테이블이 없다는 에러(42P01)는 무시하고 빈 배열 처리
        if (error.code !== '42P01') throw error;
      }

      const recipientMap = new Map<string, Recipient>();

      if (orders) {
        orders.forEach((order) => {
          const info = order.delivery_info;
          // 수령자 이름이 없으면 스킵
          if (!info || !info.recipientName) return;

          // 고유 키: 이름 + 연락처 (공백 제거하여 비교)
          const cleanName = info.recipientName.trim();
          const cleanContact = (info.recipientContact || '').replace(/-/g, '').trim();
          const key = `${cleanName}-${cleanContact}`;

          if (!recipientMap.has(key)) {
            recipientMap.set(key, {
              id: order.id, // 대표 ID (최신 주문 ID)
              name: info.recipientName,
              contact: info.recipientContact || '',
              address: info.address || '',
              detailAddress: info.detailAddress || info.district || '', // 상세주소 매핑
              district: info.district || (info.address ? info.address.split(' ')[1] : ''),
              zipCode: '',
              branchName: order.branch_name,
              memo: '',
              lastOrderDate: order.order_date,
              orderCount: 1,
              createdAt: order.order_date,
              updatedAt: order.order_date
            });
          } else {
            const existing = recipientMap.get(key)!;
            existing.orderCount += 1;
            // 이미 최신순 정렬이므로 주소 등은 최신 정보로 유지 (첫 발견이 최신)
          }
        });
      }

      setRecipients(Array.from(recipientMap.values()));
    } catch (error) {
      console.error('Error fetching recipients from orders:', error);
      toast({
        title: '알림',
        description: '주문 내역에서 수령자 정보를 분석해 왔습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const getRecipientsByDistrict = useCallback(() => {
    const districtStats = recipients.reduce((acc, recipient) => {
      // 주소에서 '구' 추출 (예: 서울특별시 종로구...)
      const district = recipient.address.split(' ')[1] || '기타';
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
    return recipients.filter(recipient => Number(recipient.orderCount) >= 2);
  }, [recipients]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  // 가상 뷰이므로 수정/삭제는 제한적입니다.
  const updateRecipient = useCallback(async (recipientId: string, updatedData: Partial<Recipient>) => {
    toast({
      title: '수정 불가',
      description: '주문 내역에서 자동 집계된 정보이므로 직접 수정할 수 없습니다.',
      variant: 'destructive',
    });
  }, [toast]);

  const deleteRecipient = useCallback(async (recipientId: string) => {
    toast({
      title: '삭제 불가',
      description: '주문 데이터가 삭제되면 자동으로 목록에서 사라집니다.',
      variant: 'destructive',
    });
  }, [toast]);

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
