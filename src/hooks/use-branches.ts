"use client";
import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase'; // 추가
import { useToast } from './use-toast';
import type { BranchFormValues } from '@/app/dashboard/branches/components/branch-form';
export interface DeliveryFee {
  district: string;
  fee: number;
}
export interface Surcharges {
  mediumItem?: number;
  largeItem?: number;
  express?: number;
}
export interface Branch extends BranchFormValues {
  id: string;
  deliveryFees?: DeliveryFee[];
  surcharges?: Surcharges;
}
export const initialBranches: Omit<Branch, 'id'>[] = [
  {
    name: "릴리맥광화문점",
    type: "직영점",
    address: "서울시 중구 세종대로 136 서울파이낸스빌딩 B2",
    phone: "010-2385-9518 / 010-2285-9518",
    account: "국민은행 407501-01-213500 이상원 (릴리맥 광화문점)",
    manager: "이상원",
    businessNumber: "123-45-67890",
    employeeCount: 5,
    deliveryFees: [
      { district: "종로구", fee: 10000 }, { district: "동작구", fee: 18000 },
      { district: "중구", fee: 10000 }, { district: "광진구", fee: 18000 },
      { district: "서대문구", fee: 13000 }, { district: "중랑구", fee: 18000 },
      { district: "성북구", fee: 13000 }, { district: "강북구", fee: 20000 },
      { district: "성동구", fee: 13000 }, { district: "송파구", fee: 20000 },
      { district: "용산구", fee: 14000 }, { district: "강동구", fee: 20000 },
      { district: "동대문구", fee: 14000 }, { district: "구로구", fee: 20000 },
      { district: "영등포구", fee: 15000 }, { district: "강서구", fee: 20000 },
      { district: "은평구", fee: 15000 }, { district: "관악구", fee: 20000 },
      { district: "마포구", fee: 16000 }, { district: "노원구", fee: 20000 },
      { district: "양천구", fee: 18000 }, { district: "도봉구", fee: 20000 },
      { district: "강남구", fee: 18000 }, { district: "금천구", fee: 20000 },
      { district: "서초구", fee: 18000 },
      { district: "기타", fee: 25000 }
    ],
    surcharges: { mediumItem: 3000, largeItem: 5000, express: 10000 }
  },
  {
    name: "릴리맥NC이스트폴점",
    type: "직영점",
    address: "서울시 광진구 아차산로 402, G1층",
    phone: "010-2908-5459 / 010-2285-9518",
    account: "국민은행 400437-01-027411 이성원 (릴리맥NC이스트폴)",
    manager: "이성원",
    businessNumber: "123-45-67890",
    employeeCount: 4,
    deliveryFees: [
      { district: "종로구", fee: 18000 }, { district: "동작구", fee: 21000 },
      { district: "중구", fee: 17000 }, { district: "광진구", fee: 10000 },
      { district: "서대문구", fee: 21000 }, { district: "중랑구", fee: 16000 },
      { district: "성북구", fee: 17000 }, { district: "강북구", fee: 20000 },
      { district: "성동구", fee: 14000 }, { district: "송파구", fee: 12000 },
      { district: "용산구", fee: 17000 }, { district: "강동구", fee: 12000 },
      { district: "동대문구", fee: 15000 }, { district: "구로구", fee: 24000 },
      { district: "영등포구", fee: 23000 }, { district: "강서구", fee: 27000 },
      { district: "은평구", fee: 22000 }, { district: "관악구", fee: 21000 },
      { district: "마포구", fee: 23000 }, { district: "노원구", fee: 21000 },
      { district: "양천구", fee: 25000 }, { district: "도봉구", fee: 22000 },
      { district: "강남구", fee: 13000 }, { district: "금천구", fee: 25000 },
      { district: "서초구", fee: 16000 },
      { district: "기타", fee: 30000 }
    ],
    surcharges: { mediumItem: 2000, largeItem: 5000 }
  },
  {
    name: "릴리맥플라워랩",
    type: "본사",
    address: "서울특별시 영등포구 국제금융로6길 33 1002호",
    phone: "010-3911-8206",
    account: "국민은행 810-21-0609-906",
    manager: "김대표",
    businessNumber: "111-22-33333",
    employeeCount: 10
  },
  {
    name: "릴리맥여의도점",
    type: "직영점",
    address: "서울시 영등포구 여의나루로50 The-K타워 B1",
    phone: "010-8241-9518 / 010-2285-9518",
    account: "국민은행 92285951847 이진경 (릴리맥)",
    manager: "이진경",
    businessNumber: "123-45-67890",
    employeeCount: 6,
    deliveryFees: [
      { district: "강남구", fee: 20000 }, { district: "도봉구", fee: 25000 }, { district: "송파구", fee: 23000 },
      { district: "강동구", fee: 25000 }, { district: "동대문구", fee: 18000 }, { district: "양천구", fee: 13000 },
      { district: "강북구", fee: 23000 }, { district: "동작구", fee: 13000 }, { district: "영등포구", fee: 10000 },
      { district: "강서구", fee: 14000 }, { district: "마포구", fee: 13000 }, { district: "용산구", fee: 14000 },
      { district: "관악구", fee: 13000 }, { district: "서대문구", fee: 15000 }, { district: "은평구", fee: 20000 },
      { district: "광진구", fee: 20000 }, { district: "서초구", fee: 18000 }, { district: "종로구", fee: 16000 },
      { district: "구로구", fee: 13000 }, { district: "성동구", fee: 18000 }, { district: "중구", fee: 16000 },
      { district: "금천구", fee: 13000 }, { district: "성북구", fee: 20000 }, { district: "중랑구", fee: 23000 },
      { district: "노원구", fee: 25000 },
      { district: "기타", fee: 30000 }
    ],
    surcharges: { mediumItem: 2000, largeItem: 5000 }
  },
  {
    name: "릴리맥여의도2호점",
    type: "직영점",
    address: "서울시 영등포구 국제금융로8길 31 SK증권빌딩 B1",
    phone: "010-7939-9518 / 010-2285-9518",
    account: "국민은행 400437-01-027255 이성원 (릴리맥여의도2호)",
    manager: "이성원",
    businessNumber: "123-45-67890",
    employeeCount: 3,
    deliveryFees: [
      { district: "강남구", fee: 20000 }, { district: "도봉구", fee: 25000 }, { district: "송파구", fee: 23000 },
      { district: "강동구", fee: 25000 }, { district: "동대문구", fee: 18000 }, { district: "양천구", fee: 13000 },
      { district: "강북구", fee: 23000 }, { district: "동작구", fee: 13000 }, { district: "영등포구", fee: 10000 },
      { district: "강서구", fee: 14000 }, { district: "마포구", fee: 13000 }, { district: "용산구", fee: 14000 },
      { district: "관악구", fee: 13000 }, { district: "서대문구", fee: 15000 }, { district: "은평구", fee: 20000 },
      { district: "광진구", fee: 20000 }, { district: "서초구", fee: 18000 }, { district: "종로구", fee: 16000 },
      { district: "구로구", fee: 13000 }, { district: "성동구", fee: 18000 }, { district: "중구", fee: 16000 },
      { district: "금천구", fee: 13000 }, { district: "성북구", fee: 20000 }, { district: "중랑구", fee: 23000 },
      { district: "노원구", fee: 25000 },
      { district: "기타", fee: 30000 }
    ],
    surcharges: { mediumItem: 2000, largeItem: 5000 }
  },
];
export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const fetchBranches = useCallback(async () => {
    try {
      setLoading(true);

      // [Supabase 우선 조회]
      const { data: supabaseBranches, error: supabaseError } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (!supabaseError && supabaseBranches && supabaseBranches.length > 0) {
        // Supabase 데이터 매핑 (snake_case -> camelCase)
        const mappedBranches = supabaseBranches.map(b => ({
          ...b,
          businessNumber: b.business_number,
          employeeCount: b.employee_count,
          deliveryFees: b.delivery_fees,
          surcharges: b.surcharges,
        })) as Branch[];

        setBranches(mappedBranches);
        setLoading(false);
        return;
      }

      // Supabase 오류 발생 시 또는 데이터가 없을 시 Firebase로 Fallback
      const branchesCollection = collection(db, 'branches');
      const querySnapshot = await getDocs(branchesCollection);

      const branchesData = querySnapshot.docs
        .filter(doc => doc.id !== '_initialized')
        .map(doc => ({ id: doc.id, ...doc.data() } as Branch));

      // 누락된 기본 지점 확인 및 복구 (코드에는 있는데 DB에 없는 지점 자동 추가)
      const existingNames = new Set(branchesData.map(b => b.name));
      const missingBranches = initialBranches.filter(b => !existingNames.has(b.name));

      if (missingBranches.length > 0) {

        const batch = writeBatch(db);

        for (const branchData of missingBranches) {
          const docRef = doc(collection(db, "branches"));
          batch.set(docRef, branchData);
          // 로컬 상태에도 즉시 반영하여 UI 갱신
          branchesData.push({ id: docRef.id, ...branchData } as Branch);

          // [이중 저장: Supabase]
          await supabase.from('branches').insert([{
            id: docRef.id,
            name: branchData.name,
            type: branchData.type,
            address: branchData.address,
            phone: branchData.phone,
            manager: branchData.manager,
            business_number: branchData.businessNumber,
            employee_count: branchData.employeeCount,
            account: branchData.account,
            delivery_fees: (branchData as any).deliveryFees,
            surcharges: (branchData as any).surcharges,
            created_at: new Date().toISOString()
          }]);
        }

        // 초기화 마커가 없는 경우 생성 (최초 실행 시)
        if (querySnapshot.size === 0) {
          const initDocRef = doc(branchesCollection, '_initialized');
          batch.set(initDocRef, { seeded: true });
        }

        await batch.commit();

        // toast({
        //   title: '지점 정보 업데이트',
        //   description: `누락된 지점(${missingBranches.length}개)이 복구되었습니다.`,
        // });
      }

      // 이름 중복 제거 (이름이 같은 지점이 여러 개일 경우 첫 번째 항목만 유지)
      const uniqueBranchesMap = new Map();
      branchesData.forEach(branch => {
        if (!uniqueBranchesMap.has(branch.name)) {
          uniqueBranchesMap.set(branch.name, branch);
        }
      });
      const uniqueBranchesData = Array.from(uniqueBranchesMap.values()) as Branch[];

      uniqueBranchesData.sort((a, b) => {
        if (a.type === '본사') return -1;
        if (b.type === '본사') return 1;
        return a.name.localeCompare(b.name);
      });
      setBranches(uniqueBranchesData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 정보를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);
  const addBranch = async (branch: BranchFormValues) => {
    try {
      setLoading(true);

      // [이중 저장: Firebase]
      const branchesCollection = collection(db, 'branches');
      const branchDocRef = await addDoc(branchesCollection, branch);

      // [이중 저장: Supabase]
      const { error: supabaseError } = await supabase.from('branches').insert([{
        id: branchDocRef.id,
        name: branch.name,
        type: branch.type,
        address: branch.address,
        phone: branch.phone,
        manager: branch.manager,
        business_number: branch.businessNumber,
        employee_count: branch.employeeCount,
        account: branch.account,
        delivery_fees: (branch as any).deliveryFees,
        surcharges: (branch as any).surcharges,
      }]);

      if (supabaseError) console.error('Supabase Sync Error:', supabaseError);

      toast({
        title: '성공',
        description: '새 지점이 성공적으로 추가되었습니다.',
      });
      await fetchBranches();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 추가 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };
  const updateBranch = async (branchId: string, branch: BranchFormValues) => {
    try {
      setLoading(true);

      // [이중 저장: Firebase]
      const branchDoc = doc(db, 'branches', branchId);
      await setDoc(branchDoc, branch, { merge: true });

      // [이중 저장: Supabase]
      const { error: supabaseError } = await supabase.from('branches').update({
        name: branch.name,
        type: branch.type,
        address: branch.address,
        phone: branch.phone,
        manager: branch.manager,
        business_number: branch.businessNumber,
        employee_count: branch.employeeCount,
        account: branch.account,
        delivery_fees: (branch as any).deliveryFees,
        surcharges: (branch as any).surcharges,
      }).eq('id', branchId);

      if (supabaseError) console.error('Supabase Sync Error:', supabaseError);

      toast({
        title: '성공',
        description: '지점 정보가 성공적으로 수정되었습니다.',
      });
      await fetchBranches();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 정보 수정 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };
  const deleteBranch = async (branchId: string) => {
    try {
      setLoading(true);

      // [이중 저장: Firebase]
      const branchDoc = doc(db, 'branches', branchId);
      await deleteDoc(branchDoc);

      // [이중 저장: Supabase]
      const { error: supabaseError } = await supabase.from('branches').delete().eq('id', branchId);

      if (supabaseError) console.error('Supabase Sync Error:', supabaseError);

      toast({
        title: '성공',
        description: '지점이 성공적으로 삭제되었습니다.',
      });
      await fetchBranches();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '지점 삭제 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };
  return { branches, loading, addBranch, updateBranch, deleteBranch, fetchBranches };
}
