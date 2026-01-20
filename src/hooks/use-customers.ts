
"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, addDoc, serverTimestamp, query, where, deleteDoc, orderBy, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

// Supabase 고객 동기화 도우미 함수

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // 실시간 고객 데이터 리스너
  useEffect(() => {
    setLoading(true);
    const customersCollection = collection(db, 'customers');

    const unsubscribe = onSnapshot(customersCollection, (querySnapshot) => {
      try {
        // 삭제되지 않은 고객만 필터링 (클라이언트 사이드에서 처리)
        const customersData = querySnapshot.docs
          .filter(doc => {
            const data = doc.data();
            return !data.isDeleted;
          })
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
        // 개발 환경에서만 콘솔에 출력
        if (process.env.NODE_ENV === 'development') {
          console.error("Error processing customers data: ", error);
        }
        toast({
          variant: 'destructive',
          title: '오류',
          description: '고객 정보를 처리하는 중 오류가 발생했습니다.',
        });
      } finally {
        setLoading(false);
      }
    }, (error) => {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("Error fetching customers: ", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  // 기존 fetchCustomers 함수는 수동 새로고침용으로 유지
  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const customersCollection = collection(db, 'customers');
      const querySnapshot = await getDocs(customersCollection);
      // 삭제되지 않은 고객만 필터링 (클라이언트 사이드에서 처리)
      const customersData = querySnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return !data.isDeleted;
        })
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
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("Error fetching customers: ", error);
      }
      toast({
        variant: 'destructive',
        title: '오류',
        description: '고객 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  // 전 지점에서 고객 검색 (연락처 기준)
  const findCustomerByContact = useCallback(async (contact: string) => {
    try {
      const q = query(collection(db, 'customers'), where('contact', '==', contact));
      const querySnapshot = await getDocs(q);
      const existingCustomers = querySnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return !data.isDeleted;
        })
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            lastOrderDate: data.lastOrderDate?.toDate ? data.lastOrderDate.toDate().toISOString() : data.lastOrderDate,
          } as Customer;
        });
      return existingCustomers.length > 0 ? existingCustomers[0] : null;
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('Error finding customer by contact:', error);
      }
      return null;
    }
  }, []);
  // 고객 등록 (통합 관리)
  const addCustomer = async (data: CustomerFormValues) => {
    setLoading(true);
    try {
      const { contact } = data;
      // 전 지점에서 동일 연락처 고객 검색
      const existingCustomer = await findCustomerByContact(contact);
      if (existingCustomer) {
        // 기존 고객이면 현재 지점에 등록
        const currentBranch = data.branch || '';
        await updateDoc(doc(db, 'customers', existingCustomer.id), {
          [`branches.${currentBranch}`]: {
            registeredAt: serverTimestamp(),
            grade: data.grade,
            notes: data.memo
          }
        });
        toast({ title: "성공", description: "기존 고객이 현재 지점에 등록되었습니다." });
      } else {
        // 새 고객 생성
        const currentBranch = data.branch || '';
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
        await addDoc(collection(db, 'customers'), customerWithTimestamp);
        toast({ title: "성공", description: "새 고객이 추가되었습니다." });
      }
      await fetchCustomers();


    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("Error adding customer:", error);
      }
      toast({ variant: 'destructive', title: '오류', description: '고객 추가 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };
  const updateCustomer = async (id: string, data: CustomerFormValues) => {
    setLoading(true);
    try {
      const customerDocRef = doc(db, 'customers', id);
      await setDoc(customerDocRef, data, { merge: true });
      toast({ title: "성공", description: "고객 정보가 수정되었습니다." });
      await fetchCustomers();


    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error("Error updating customer:", error);
      }
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

      // 고객 포인트 업데이트
      await updateDoc(customerRef, {
        points: newPoints
      });

      // 포인트 수정 이력 저장
      const pointHistoryData = {
        customerId,
        previousPoints: currentPoints,
        newPoints,
        difference,
        reason,
        modifier,
        timestamp: serverTimestamp(),
        customerName: customerDoc.data().name,
        customerContact: customerDoc.data().contact
      };

      await addDoc(collection(db, 'pointHistory'), pointHistoryData);



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
      const customerDocRef = doc(db, 'customers', id);
      await updateDoc(customerDocRef, { isDeleted: true });
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
            points: Number(row.points || row.포인트 || 0) || 0,
            // 고객유형 처리
            type: (row.type || row.고객유형 || 'personal') === '기업' || (row.type || row.고객유형 || 'personal') === 'company' ? 'company' : 'personal',
            // 기념일 정보
            birthday: String(row.birthday || row.생일 || '').trim(),
            weddingAnniversary: String(row.weddingAnniversary || row.결혼기념일 || '').trim(),
            foundingAnniversary: String(row.foundingAnniversary || row.창립기념일 || '').trim(),
            firstVisitDate: String(row.firstVisitDate || row.첫방문일 || '').trim(),
            otherAnniversaryName: String(row.otherAnniversaryName || row.기타기념일명 || '').trim(),
            otherAnniversary: String(row.otherAnniversary || row.기타기념일 || '').trim(),
            totalSpent: 0,
            orderCount: 0,
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

          // 생성일 처리 (한글 헤더 추가 지원)
          if (row.createdAt || row.생성일) {
            customerData.createdAt = new Date(row.createdAt || row.생성일);
          } else {
            customerData.createdAt = serverTimestamp();
          }

          // 빈 문자열 필드들 정리
          Object.keys(customerData).forEach(key => {
            if (typeof customerData[key] === 'string' && customerData[key] === '') {
              delete customerData[key];
            }
          });

          // 중복 체크: 이름과 연락처가 모두 같을 경우 중복 처리
          const duplicateQuery = query(
            collection(db, "customers"),
            where("name", "==", customerData.name),
            where("contact", "==", customerData.contact)
          );
          const duplicateSnapshot = await getDocs(duplicateQuery);
          const existingCustomers = duplicateSnapshot.docs.filter(doc => !doc.data().isDeleted);

          if (existingCustomers.length > 0) {
            // 기존 고객이면 정보 업데이트 (포인트 포함)
            const existingCustomer = existingCustomers[0];
            const updateData: any = {};

            // 새로운 정보가 있으면 업데이트
            if (customerData.type) updateData.type = customerData.type;
            if (customerData.companyName) updateData.companyName = customerData.companyName;
            if (customerData.address) updateData.address = customerData.address;
            if (customerData.email) updateData.email = customerData.email;
            if (customerData.memo) updateData.memo = customerData.memo;
            if (customerData.points > 0) updateData.points = customerData.points;
            // 기념일 정보 업데이트
            if (customerData.birthday) updateData.birthday = customerData.birthday;
            if (customerData.weddingAnniversary) updateData.weddingAnniversary = customerData.weddingAnniversary;
            if (customerData.foundingAnniversary) updateData.foundingAnniversary = customerData.foundingAnniversary;
            if (customerData.firstVisitDate) updateData.firstVisitDate = customerData.firstVisitDate;
            if (customerData.otherAnniversaryName) updateData.otherAnniversaryName = customerData.otherAnniversaryName;
            if (customerData.otherAnniversary) updateData.otherAnniversary = customerData.otherAnniversary;

            // 지점 정보 업데이트
            if (customerData.branch) {
              updateData[`branches.${customerData.branch}`] = {
                registeredAt: serverTimestamp(),
                grade: customerData.grade,
                notes: customerData.memo || `엑셀 업로드로 업데이트 - ${new Date().toLocaleDateString()}`
              };
            }

            if (Object.keys(updateData).length > 0) {
              await updateDoc(doc(db, 'customers', existingCustomer.id), updateData);
            }
            duplicateCount++;
          } else {
            // 새 고객 생성
            const newCustomerData = {
              ...customerData,
              branches: {
                [customerData.branch || '']: {
                  registeredAt: serverTimestamp(),
                  grade: customerData.grade,
                  notes: customerData.memo || `엑셀 업로드로 등록 - ${new Date().toLocaleDateString()}`
                }
              },
              primaryBranch: customerData.branch
            };

            const docRef = await addDoc(collection(db, "customers"), newCustomerData);
            newCount++;
          }
        } catch (error) {
          // 개발 환경에서만 콘솔에 출력
          if (process.env.NODE_ENV === 'development') {
            console.error("Error processing row:", row, error);
          }
          errorCount++;
        }
      }

      // 결과 메시지 구성
      let description = `신규 고객 ${newCount}명 추가, 기존 고객 ${duplicateCount}명 업데이트`;
      if (skippedCount > 0) {
        description += `, ${skippedCount}개 항목 건너뜀 (이름, 연락처 또는 지점 정보 없음)`;
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
    try {
      const q = query(collection(db, 'customers'), where('contact', '==', contact));
      const querySnapshot = await getDocs(q);
      // 삭제되지 않은 고객만 반환
      return querySnapshot.docs
        .filter(doc => {
          const data = doc.data();
          return !data.isDeleted;
        })
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            lastOrderDate: data.lastOrderDate?.toDate ? data.lastOrderDate.toDate().toISOString() : data.lastOrderDate,
          } as Customer;
        });
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('Error finding customers by contact:', error);
      }
      return [];
    }
  }, []);
  // 포인트 조회 (전 지점 공유)
  const getCustomerPoints = useCallback(async (contact: string) => {
    try {
      const customer = await findCustomerByContact(contact);
      return customer ? (customer.points || 0) : 0;
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('Error getting customer points:', error);
      }
      return 0;
    }
  }, [findCustomerByContact]);
  // 포인트 차감 (전 지점 공유)
  const deductCustomerPoints = useCallback(async (contact: string, pointsToDeduct: number) => {
    try {
      const customer = await findCustomerByContact(contact);
      if (customer) {
        const currentPoints = customer.points || 0;
        const newPoints = Math.max(0, currentPoints - pointsToDeduct);
        await updateDoc(doc(db, 'customers', customer.id), {
          points: newPoints,
          lastUpdated: serverTimestamp(),
        });



        return newPoints;
      }
      return 0;
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deducting customer points:', error);
      }
      return 0;
    }
  }, [findCustomerByContact]);
  // 포인트 적립 (전 지점 공유)
  const addCustomerPoints = useCallback(async (contact: string, pointsToAdd: number) => {
    try {
      const customer = await findCustomerByContact(contact);
      if (customer) {
        const currentPoints = customer.points || 0;
        const newPoints = currentPoints + pointsToAdd;
        await updateDoc(doc(db, 'customers', customer.id), {
          points: newPoints,
          lastUpdated: serverTimestamp(),
        });



        return newPoints;
      }
      return 0;
    } catch (error) {
      // 개발 환경에서만 콘솔에 출력
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding customer points:', error);
      }
      return 0;
    }
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
