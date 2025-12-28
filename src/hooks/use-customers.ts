"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, deleteDoc, orderBy, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
import { CustomerFormValues } from '@/app/dashboard/customers/components/customer-form';
export interface Customer extends CustomerFormValues {
  id: string;
  createdAt: string | any;
  lastOrderDate?: string | any;
  totalSpent?: number;
  orderCount?: number;
  points?: number;
  address?: string;
  companyName?: string;
  // 기념일 정보
  birthday?: string;
  weddingAnniversary?: string;
  foundingAnniversary?: string;
  firstVisitDate?: string;
  otherAnniversary?: string;
  otherAnniversaryName?: string;
  // 특이사항 및 월결제일 정보
  specialNotes?: string;
  monthlyPaymentDay?: string;
  // 지점별 정보 (새로 추가)
  branches?: {
    [branchId: string]: {
      registeredAt: string | any;
      grade?: string;
      notes?: string;
    }
  };
  // 주 거래 지점 (가장 많이 주문한 지점)
  primaryBranch?: string;
}
export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // [기존 실시간 리스너 유지: 데이터 정합성 보장]
  // 조회 로직을 Supabase 우선으로 하되, 실시간 업데이트는 Firebase 리스너가 담당하도록 하여 안정적 전이를 도모합니다.
  useEffect(() => {
    setLoading(true);
    const customersCollection = collection(db, 'customers');

    const unsubscribe = onSnapshot(customersCollection, (querySnapshot) => {
      try {
        const customersData = querySnapshot.docs
          .filter(doc => !doc.data().isDeleted)
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
              lastOrderDate: data.lastOrderDate?.toDate ? data.lastOrderDate.toDate().toISOString() : data.lastOrderDate,
            } as Customer;
          });
        setCustomers(customersData);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') console.error("Error processing customers:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      // [Supabase 우선 조회]
      const { data: supabaseCustomers, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('is_deleted', false)
        .order('name');

      if (!supabaseError && supabaseCustomers) {
        const mappedCustomers = supabaseCustomers.map(c => {
          // branches 필드 매핑
          const mappedBranches: any = {};
          if (c.branches) {
            Object.entries(c.branches).forEach(([branchId, info]: [string, any]) => {
              mappedBranches[branchId] = {
                registeredAt: info.registered_at,
                grade: info.grade,
                notes: info.notes
              };
            });
          }

          return {
            id: c.id,
            name: c.name,
            contact: c.contact,
            companyName: c.company_name,
            address: c.address,
            email: c.email,
            grade: c.grade,
            memo: c.memo,
            points: c.points,
            type: c.type,
            birthday: c.birthday,
            weddingAnniversary: c.wedding_anniversary,
            foundingAnniversary: c.founding_anniversary,
            firstVisitDate: c.first_visit_date,
            otherAnniversaryName: c.other_anniversary_name,
            otherAnniversary: c.other_anniversary,
            specialNotes: c.special_notes,
            monthlyPaymentDay: c.monthly_payment_day,
            totalSpent: c.total_spent,
            orderCount: c.order_count,
            primaryBranch: c.primary_branch,
            branches: mappedBranches,
            createdAt: c.created_at,
            lastOrderDate: c.last_order_date,
          } as Customer;
        });

        setCustomers(mappedCustomers);
        setLoading(false);
        return;
      }

      // Fallback: Firebase
      const customersCollection = collection(db, 'customers');
      const querySnapshot = await getDocs(customersCollection);
      const customersData = querySnapshot.docs
        .filter(doc => !doc.data().isDeleted)
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            lastOrderDate: data.lastOrderDate?.toDate ? data.lastOrderDate.toDate().toISOString() : data.lastOrderDate,
          } as Customer;
        });
      setCustomers(customersData);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const findCustomerByContact = useCallback(async (contact: string) => {
    try {
      // Supabase에서 먼저 검색
      const { data: supabaseData, error: supabaseError } = await supabase
        .from('customers')
        .select('*')
        .eq('contact', contact)
        .eq('is_deleted', false)
        .single();

      if (!supabaseError && supabaseData) {
        const c = supabaseData;
        const mappedBranches: any = {};
        if (c.branches) {
          Object.entries(c.branches).forEach(([branchId, info]: [string, any]) => {
            mappedBranches[branchId] = {
              registeredAt: info.registered_at,
              grade: info.grade,
              notes: info.notes
            };
          });
        }

        return {
          id: c.id,
          name: c.name,
          contact: c.contact,
          companyName: c.company_name,
          address: c.address,
          email: c.email,
          grade: c.grade,
          memo: c.memo,
          points: c.points,
          type: c.type,
          birthday: c.birthday,
          weddingAnniversary: c.wedding_anniversary,
          foundingAnniversary: c.founding_anniversary,
          firstVisitDate: c.first_visit_date,
          otherAnniversaryName: c.other_anniversary_name,
          otherAnniversary: c.other_anniversary,
          specialNotes: c.special_notes,
          monthlyPaymentDay: c.monthly_payment_day,
          totalSpent: c.total_spent,
          orderCount: c.order_count,
          primaryBranch: c.primary_branch,
          branches: mappedBranches,
          createdAt: c.created_at,
          lastOrderDate: c.last_order_date,
        } as Customer;
      }

      // Fallback: Firebase
      const q = query(collection(db, 'customers'), where('contact', '==', contact));
      const querySnapshot = await getDocs(q);
      const existingCustomers = querySnapshot.docs
        .filter(doc => !doc.data().isDeleted)
        .map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      return existingCustomers.length > 0 ? existingCustomers[0] : null;
    } catch (error) {
      return null;
    }
  }, []);

  const addCustomer = async (data: CustomerFormValues) => {
    setLoading(true);
    try {
      const { contact } = data;
      const existingCustomer = await findCustomerByContact(contact);
      const currentBranch = data.branch || '';

      if (existingCustomer) {
        // [이중 저장: Firebase]
        await updateDoc(doc(db, 'customers', existingCustomer.id), {
          [`branches.${currentBranch}`]: {
            registeredAt: serverTimestamp(),
            grade: data.grade,
            notes: data.memo
          }
        });

        // [이중 저장: Supabase]
        const supabaseBranches: any = {};
        if (existingCustomer.branches) {
          Object.entries(existingCustomer.branches).forEach(([bId, info]: [string, any]) => {
            supabaseBranches[bId] = {
              registered_at: info.registeredAt || info.registered_at,
              grade: info.grade,
              notes: info.notes
            };
          });
        }
        supabaseBranches[currentBranch] = {
          registered_at: new Date().toISOString(),
          grade: data.grade,
          notes: data.memo
        };

        const { error: supabaseError } = await supabase.from('customers').update({
          branches: supabaseBranches
        }).eq('id', existingCustomer.id);

        if (supabaseError) console.error('Supabase Sync Error:', supabaseError);
        toast({ title: "성공", description: "기존 고객이 현재 지점에 등록되었습니다." });
      } else {
        // [이중 저장: Firebase]
        const customerWithTimestamp = {
          ...data,
          createdAt: serverTimestamp(),
          totalSpent: 0,
          orderCount: 0,
          points: 0,
          branches: {
            [currentBranch]: {
              registeredAt: serverTimestamp(),
              grade: data.grade,
              notes: data.memo
            }
          },
          primaryBranch: currentBranch
        };
        const docRef = await addDoc(collection(db, 'customers'), customerWithTimestamp);

        // [이중 저장: Supabase]
        const { error: supabaseError } = await supabase.from('customers').insert([{
          id: docRef.id,
          name: data.name,
          contact: data.contact,
          company_name: data.companyName,
          address: (data as any).address,
          email: data.email,
          grade: data.grade,
          memo: data.memo,
          points: 0,
          type: data.type,
          birthday: data.birthday,
          wedding_anniversary: data.weddingAnniversary,
          founding_anniversary: data.foundingAnniversary,
          first_visit_date: data.firstVisitDate,
          other_anniversary_name: data.otherAnniversaryName,
          other_anniversary: data.otherAnniversary,
          special_notes: data.specialNotes,
          monthly_payment_day: data.monthlyPaymentDay,
          total_spent: 0,
          order_count: 0,
          primary_branch: currentBranch,
          branch: currentBranch,
          branches: {
            [currentBranch]: { registered_at: new Date().toISOString(), grade: data.grade, notes: data.memo }
          }
        }]);

        if (supabaseError) console.error('Supabase Sync Error:', supabaseError);
        toast({ title: "성공", description: "새 고객이 추가되었습니다." });
      }
      await fetchCustomers();
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '고객 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const updateCustomer = async (id: string, data: CustomerFormValues) => {
    setLoading(true);
    try {
      // [이중 저장: Firebase]
      const customerDocRef = doc(db, 'customers', id);
      await setDoc(customerDocRef, data, { merge: true });

      // [이중 저장: Supabase]
      const { error: supabaseError } = await supabase.from('customers').update({
        name: data.name,
        contact: data.contact,
        company_name: data.companyName,
        address: (data as any).address,
        email: data.email,
        grade: data.grade,
        memo: data.memo,
        type: data.type,
        birthday: data.birthday,
        wedding_anniversary: data.weddingAnniversary,
        founding_anniversary: data.foundingAnniversary,
        first_visit_date: data.firstVisitDate,
        other_anniversary_name: data.otherAnniversaryName,
        other_anniversary: data.otherAnniversary,
        special_notes: data.specialNotes,
        monthly_payment_day: data.monthlyPaymentDay,
      }).eq('id', id);

      if (supabaseError) console.error('Supabase Sync Error:', supabaseError);

      toast({ title: "성공", description: "고객 정보가 수정되었습니다." });
      await fetchCustomers();
    } catch (error) {
      toast({ variant: 'destructive', title: '오류', description: '고객 정보 수정 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  // 포인트 업데이트 함수 (이력 포함)
  const updateCustomerPoints = async (customerId: string, newPoints: number, reason: string, modifier: string) => {
    try {
      const customerRef = doc(db, 'customers', customerId);
      const customerDoc = await getDoc(customerRef);

      if (!customerDoc.exists()) {
        throw new Error('Customer not found');
      }

      const currentPoints = customerDoc.data().points || 0;
      const difference = newPoints - currentPoints;

      // [이중 저장: Firebase] - 포인트 및 이력
      await updateDoc(customerRef, { points: newPoints });
      const pointHistoryRef = await addDoc(collection(db, 'pointHistory'), {
        customerId,
        previousPoints: currentPoints,
        newPoints,
        difference,
        reason,
        modifier,
        timestamp: serverTimestamp(),
        customerName: customerDoc.data().name,
        customerContact: customerDoc.data().contact
      });

      // [이중 저장: Supabase]
      await supabase.from('customers').update({ points: newPoints }).eq('id', customerId);
      await supabase.from('point_history').insert([{
        id: pointHistoryRef.id,
        customer_id: customerId,
        customer_name: customerDoc.data().name,
        customer_contact: customerDoc.data().contact,
        previous_points: currentPoints,
        new_points: newPoints,
        difference,
        reason,
        modifier
      }]);

      return { success: true, difference };
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("Error updating customer points:", error);
      }
      throw error;
    }
  };
  const deleteCustomer = async (id: string) => {
    setLoading(true);
    try {
      // [이중 저장: Firebase]
      const customerDocRef = doc(db, 'customers', id);
      await updateDoc(customerDocRef, { isDeleted: true });

      // [이중 저장: Supabase]
      await supabase.from('customers').update({ is_deleted: true }).eq('id', id);

      toast({ title: "성공", description: "고객 정보가 삭제되었습니다." });
      await fetchCustomers();
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("Error deleting customer:", error);
      }
      toast({ variant: 'destructive', title: '오류', description: '고객 삭제 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };
  const bulkAddCustomers = async (data: any[], selectedBranch?: string) => {
    // 일괄 등록은 Firebase 로컬 로직 기반으로 처리하되 성공 시 Supabase와 동기화하는 로직 필요
    // 복잡도가 높으므로 우선 기존 addDoc/updateDoc 호출을 통해 간접적으로 Supabase 싱크 유도
    setLoading(true);
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      for (const row of data) {
        try {
          // 필수 필드 검증 - 한글/영문 헤더 모두 지원
          const hasName = row.name || row.고객명;
          const hasContact = row.contact || row.연락처;

          if (!hasName || !hasContact) {
            skippedCount++;
            continue;
          }

          // 엑셀 필드 매핑 (한글/영문 필드명 모두 지원)
          const customerData: any = {
            name: String(row.name || row.고객명 || '').trim(),
            contact: String(row.contact || row.연락처 || '').trim(),
            companyName: String(row.companyName || row.회사명 || '').trim(),
            address: String(row.address || row.주소 || '').trim(),
            email: String(row.email || row.이메일 || '').trim(),
            grade: String(row.grade || row.등급 || '신규').trim(),
            memo: String(row.memo || row.메모 || '').trim(),
            // 고객유형 처리
            type: (row.type || row.고객유형 || 'personal') === '기업' || (row.type || row.고객유형 || 'personal') === 'company' ? 'company' : 'personal',
            // 기념일 정보
            birthday: String(row.birthday || row.생일 || '').trim(),
            weddingAnniversary: String(row.weddingAnniversary || row.결혼기념일 || '').trim(),
            foundingAnniversary: String(row.foundingAnniversary || row.창립기념일 || '').trim(),
            firstVisitDate: String(row.firstVisitDate || row.첫방문일 || '').trim(),
            otherAnniversaryName: String(row.otherAnniversaryName || row.기타기념일명 || '').trim(),
            otherAnniversary: String(row.otherAnniversary || row.기타기념일 || '').trim(),
          };

          // 지점 처리 로직
          const excelBranch = String(row.branch || row.지점 || '').trim();
          let finalBranch = excelBranch;

          // 엑셀에 지점 정보가 없으면 selectedBranch 사용 (단, "all"이 아닌 경우만)
          if (!finalBranch && selectedBranch && selectedBranch !== "all") {
            finalBranch = selectedBranch;
          }

          // 지점 정보가 여전히 없으면 건너뛰기
          if (!finalBranch) {
            skippedCount++;
            continue;
          }

          customerData.branch = finalBranch;

          // 빈 문자열 필드들 정리
          Object.keys(customerData).forEach(key => {
            if (typeof (customerData as any)[key] === 'string' && (customerData as any)[key] === '') {
              delete (customerData as any)[key];
            }
          });

          // addCustomer 함수를 호출하여 개별 고객 등록/업데이트 처리
          // addCustomer 내부에서 Firebase와 Supabase 이중 저장 로직이 처리됨
          await addCustomer(customerData as any);
          newCount++; // addCustomer가 내부적으로 기존 고객 업데이트도 처리하므로, 여기서는 단순히 처리된 항목 수로 간주
        } catch (error) {
          // 개발 환경에서만 콘솔에 출력
          if (process.env.NODE_ENV === 'development') {
            console.error("Error processing row:", row, error);
          }
          errorCount++;
        }
      }

      // 결과 메시지 구성
      let description = `총 ${newCount}개 항목 처리 완료`;
      if (skippedCount > 0) {
        description += `, ${skippedCount}개 항목 건너옴 (이름, 연락처 또는 지점 정보 없음)`;
      }
      if (errorCount > 0) {
        description += `, ${errorCount}개 항목 처리 중 오류 발생`;
      }

      if (errorCount > 0) {
        toast({
          variant: 'destructive',
          title: '일부 처리 오류',
          description: `${errorCount}개 항목 처리 중 오류가 발생했습니다.`
        });
      }

      toast({
        title: '처리 완료',
        description
      });

      await fetchCustomers();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '일괄 등록 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };
  // findCustomersByContact 함수 (기존 호환성 유지)
  const findCustomersByContact = useCallback(async (contact: string) => {
    // findCustomerByContact를 배열 형태로 래핑하여 호환성 유지
    const customer = await findCustomerByContact(contact);
    return customer ? [customer] : [];
  }, [findCustomerByContact]);
  // 포인트 조회 (전 지점 공유)
  const getCustomerPoints = useCallback(async (contact: string) => {
    const customer = await findCustomerByContact(contact);
    return customer ? (customer.points || 0) : 0;
  }, [findCustomerByContact]);
  // 포인트 차감 (전 지점 공유)
  const deductCustomerPoints = useCallback(async (contact: string, pointsToDeduct: number) => {
    const customer = await findCustomerByContact(contact);
    if (customer) {
      const newPoints = Math.max(0, (customer.points || 0) - pointsToDeduct);
      await updateCustomerPoints(customer.id, newPoints, '주문 시 포인트 사용', 'system');
      return newPoints;
    }
    return 0;
  }, [findCustomerByContact]);
  // 포인트 적립 (전 지점 공유)
  const addCustomerPoints = useCallback(async (contact: string, pointsToAdd: number) => {
    const customer = await findCustomerByContact(contact);
    if (customer) {
      const newPoints = (customer.points || 0) + pointsToAdd;
      await updateCustomerPoints(customer.id, newPoints, '주문 적립', 'system');
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
    addCustomerPoints
  };
}
