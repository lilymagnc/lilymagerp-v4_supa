"use client";
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from './use-toast';
import { CustomerFormValues } from '@/app/dashboard/customers/components/customer-form';

export interface Customer extends CustomerFormValues {
  id: string;
  createdAt: string;
  lastOrderDate?: string;
  totalSpent?: number;
  orderCount?: number;
  points?: number;
  address?: string;
  companyName?: string;
  birthday?: string;
  weddingAnniversary?: string;
  foundingAnniversary?: string;
  firstVisitDate?: string;
  otherAnniversary?: string;
  otherAnniversaryName?: string;
  specialNotes?: string;
  monthlyPaymentDay?: string;
  branches?: {
    [branchId: string]: {
      registeredAt: string;
      grade?: string;
      notes?: string;
    }
  };
  primaryBranch?: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const mapRowToCustomer = (row: any): Customer => ({
    id: row.id,
    name: row.name,
    contact: row.contact,
    companyName: row.company_name,
    address: row.address,
    email: row.email,
    grade: row.grade,
    memo: row.memo,
    points: row.points,
    totalSpent: row.total_spent,
    orderCount: row.order_count,
    createdAt: row.created_at,
    lastOrderDate: row.last_order_date,
    birthday: row.birthday,
    weddingAnniversary: row.wedding_anniversary,
    foundingAnniversary: row.founding_anniversary,
    firstVisitDate: row.first_visit_date,
    otherAnniversary: row.other_anniversary,
    otherAnniversaryName: row.other_anniversary_name,
    specialNotes: row.special_notes,
    monthlyPaymentDay: row.monthly_payment_day,
    branches: row.branches,
    primaryBranch: row.primary_branch,
    branch: row.branch,
    type: row.type || 'personal'
  });

  const fetchCustomers = useCallback(async () => {
    try {
      if (customers.length === 0) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      let allCustomers: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('customers')
          .select('*')
          .eq('is_deleted', false)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allCustomers = [...allCustomers, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }

        // Safety break
        if (allCustomers.length >= 10000) break;
      }

      setCustomers(allCustomers.map(mapRowToCustomer));
    } catch (error: any) {
      console.error("Error fetching customers: ", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      toast({
        variant: 'destructive',
        title: '오류',
        description: '고객 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCustomers();

    // 실시간 구독
    const subscription = supabase
      .channel('customers_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [fetchCustomers]);

  const findCustomerByContact = useCallback(async (contact: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('contact', contact)
        .eq('is_deleted', false)
        .maybeSingle();

      if (error) throw error;
      return data ? mapRowToCustomer(data) : null;
    } catch (error) {
      console.error('Error finding customer by contact:', error);
      return null;
    }
  }, []);

  const addCustomer = async (data: CustomerFormValues) => {
    setLoading(true);
    try {
      const existingCustomer = await findCustomerByContact(data.contact);

      if (existingCustomer) {
        const currentBranch = data.branch || '';
        const updatedBranches = {
          ...(existingCustomer.branches || {}),
          [currentBranch]: {
            registeredAt: new Date().toISOString(),
            grade: data.grade,
            notes: data.memo
          }
        };

        const { error } = await supabase
          .from('customers')
          .update({ branches: updatedBranches })
          .eq('id', existingCustomer.id);

        if (error) throw error;
        toast({ title: "성공", description: "기존 고객이 현재 지점에 등록되었습니다." });
      } else {
        const currentBranch = data.branch || '';
        const { error } = await supabase
          .from('customers')
          .insert([{
            id: crypto.randomUUID(),
            name: data.name,
            contact: data.contact,
            company_name: data.companyName,
            address: data.address,
            email: data.email,
            grade: data.grade,
            memo: data.memo,
            points: 0,
            total_spent: 0,
            order_count: 0,
            branches: {
              [currentBranch]: {
                registeredAt: new Date().toISOString(),
                grade: data.grade,
                notes: data.memo
              }
            },
            primary_branch: currentBranch,
            type: data.type || 'personal',
            is_deleted: false
          }]);

        if (error) throw error;
        toast({ title: "성공", description: "새 고객이 추가되었습니다." });
      }
      await fetchCustomers();
    } catch (error) {
      console.error("Error adding customer:", error);
      toast({ variant: 'destructive', title: '오류', description: '고객 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const updateCustomer = async (id: string, data: CustomerFormValues) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: data.name,
          contact: data.contact,
          company_name: data.companyName,
          address: data.address,
          email: data.email,
          grade: data.grade,
          memo: data.memo,
          type: data.type
        })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "성공", description: "고객 정보가 수정되었습니다." });
      await fetchCustomers();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast({ variant: 'destructive', title: '오류', description: '고객 정보 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const updateCustomerPoints = async (customerId: string, newPoints: number, reason: string, modifier: string) => {
    try {
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('points, name, contact')
        .eq('id', customerId)
        .single();

      if (fetchError || !customer) throw new Error('Customer not found');

      const currentPoints = customer.points || 0;
      const difference = newPoints - currentPoints;

      const { error: updateError } = await supabase
        .from('customers')
        .update({ points: newPoints })
        .eq('id', customerId);

      if (updateError) throw updateError;

      await supabase
        .from('point_history')
        .insert([{
          id: crypto.randomUUID(),
          customer_id: customerId,
          previous_points: currentPoints,
          new_points: newPoints,
          difference,
          reason,
          modifier,
          customer_name: customer.name,
          customer_contact: customer.contact,
          created_at: new Date().toISOString()
        }]);

      return { success: true, difference };
    } catch (error) {
      console.error("Error updating customer points:", error);
      throw error;
    }
  };

  const deleteCustomer = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_deleted: true })
        .eq('id', id);

      if (error) throw error;
      toast({ title: "성공", description: "고객 정보가 삭제되었습니다." });
      await fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast({ variant: 'destructive', title: '오류', description: '고객 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkAddCustomers = async (data: any[], selectedBranch?: string) => {
    setLoading(true);
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      for (const row of data) {
        try {
          const name = String(row.name || row.고객명 || '').trim();
          const contact = String(row.contact || row.연락처 || '').trim();

          if (!name || !contact) {
            skippedCount++;
            continue;
          }

          const customerData = {
            name,
            contact,
            company_name: String(row.companyName || row.회사명 || '').trim(),
            address: String(row.address || row.주소 || '').trim(),
            email: String(row.email || row.이메일 || '').trim(),
            grade: String(row.grade || row.등급 || '신규').trim(),
            memo: String(row.memo || row.메모 || '').trim(),
            points: Number(row.points || row.포인트 || 0) || 0,
            type: (row.type || row.고객유형 || 'personal') === '기업' ? 'company' : 'personal',
            birthday: String(row.birthday || row.생일 || '').trim(),
            wedding_anniversary: String(row.weddingAnniversary || row.결혼기념일 || '').trim(),
            founding_anniversary: String(row.foundingAnniversary || row.창립기념일 || '').trim(),
            first_visit_date: String(row.firstVisitDate || row.첫방문일 || '').trim(),
            other_anniversary_name: String(row.otherAnniversaryName || row.기타기념일명 || '').trim(),
            other_anniversary: String(row.otherAnniversary || row.기타기념일 || '').trim(),
          };

          const branch = String(row.branch || row.지점 || selectedBranch || '').trim();
          if (!branch || branch === 'all') {
            skippedCount++;
            continue;
          }

          const existing = await findCustomerByContact(contact);

          if (existing) {
            const updatedBranches = {
              ...(existing.branches || {}),
              [branch]: {
                registeredAt: new Date().toISOString(),
                grade: customerData.grade,
                notes: customerData.memo || '엑셀 업로드 업데이트'
              }
            };

            await supabase
              .from('customers')
              .update({ ...customerData, branches: updatedBranches })
              .eq('id', existing.id);
            duplicateCount++;
          } else {
            await supabase
              .from('customers')
              .insert([{
                id: crypto.randomUUID(),
                ...customerData,
                branches: {
                  [branch]: {
                    registeredAt: new Date().toISOString(),
                    grade: customerData.grade,
                    notes: customerData.memo || '엑셀 업로드 등록'
                  }
                },
                primary_branch: branch,
                is_deleted: false
              }]);
            newCount++;
          }
        } catch (e) {
          errorCount++;
        }
      }
      toast({ title: '처리 완료', description: `신규 ${newCount}, 업데이트 ${duplicateCount}, 실패 ${errorCount}` });
      await fetchCustomers();
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '일괄 등록 중 오류 발생' });
    } finally {
      setLoading(false);
    }
  };

  const findCustomersByContact = useCallback(async (contact: string) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('contact', contact)
        .eq('is_deleted', false);

      if (error) throw error;
      return (data || []).map(mapRowToCustomer);
    } catch (error) {
      return [];
    }
  }, []);

  const getCustomerPoints = useCallback(async (contact: string) => {
    const customer = await findCustomerByContact(contact);
    return customer ? (customer.points || 0) : 0;
  }, [findCustomerByContact]);

  const addCustomerPoints = useCallback(async (contact: string, pointsToAdd: number) => {
    const customer = await findCustomerByContact(contact);
    if (customer) {
      const newPoints = (customer.points || 0) + pointsToAdd;
      await supabase.from('customers').update({ points: newPoints }).eq('id', customer.id);
      return newPoints;
    }
    return 0;
  }, [findCustomerByContact]);

  const deductCustomerPoints = useCallback(async (contact: string, pointsToDeduct: number) => {
    const customer = await findCustomerByContact(contact);
    if (customer) {
      const newPoints = Math.max(0, (customer.points || 0) - pointsToDeduct);
      await supabase.from('customers').update({ points: newPoints }).eq('id', customer.id);
      return newPoints;
    }
    return 0;
  }, [findCustomerByContact]);

  return {
    customers,
    loading,
    addCustomer,
    updateCustomer,
    updateCustomerPoints,
    deleteCustomer,
    bulkAddCustomers,
    findCustomersByContact,
    findCustomerByContact,
    getCustomerPoints,
    deductCustomerPoints,
    addCustomerPoints,
    isRefreshing
  };
}

