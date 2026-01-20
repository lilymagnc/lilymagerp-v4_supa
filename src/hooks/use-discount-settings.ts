import { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { DiscountSettings, BranchDiscountSettings, GlobalDiscountSettings, DiscountRate } from '@/types/discount';
const DEFAULT_DISCOUNT_RATES: DiscountRate[] = [
  { rate: 5, label: "5%", isActive: true },
  { rate: 10, label: "10%", isActive: true },
  { rate: 15, label: "15%", isActive: true },
  { rate: 20, label: "20%", isActive: true },
  { rate: 25, label: "25%", isActive: true },
  { rate: 30, label: "30%", isActive: true },
  { rate: 35, label: "35%", isActive: true },
  { rate: 40, label: "40%", isActive: true },
  { rate: 45, label: "45%", isActive: true },
  { rate: 50, label: "50%", isActive: true },
];
// Firestore 데이터를 DiscountSettings로 변환하는 헬퍼 함수
const convertFirestoreData = (data: any): DiscountSettings => {
  const convertTimestamp = (timestamp: any): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
      return timestamp;
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    return new Date();
  };
  return {
    globalSettings: {
      startDate: convertTimestamp(data.globalSettings?.startDate),
      endDate: convertTimestamp(data.globalSettings?.endDate),
      allowDuplicateDiscount: data.globalSettings?.allowDuplicateDiscount ?? false,
      allowPointAccumulation: data.globalSettings?.allowPointAccumulation ?? true,
      minOrderAmount: data.globalSettings?.minOrderAmount ?? 10000,
    },
    branchSettings: Object.keys(data.branchSettings || {}).reduce((acc, branchId) => {
      const branchData = data.branchSettings[branchId];
      acc[branchId] = {
        isActive: branchData?.isActive ?? false,
        startDate: convertTimestamp(branchData?.startDate),
        endDate: convertTimestamp(branchData?.endDate),
        discountRates: branchData?.discountRates || DEFAULT_DISCOUNT_RATES,
        customRate: branchData?.customRate ?? 0,
        minOrderAmount: branchData?.minOrderAmount ?? 10000,
        allowDuplicateDiscount: branchData?.allowDuplicateDiscount ?? false,
        allowPointAccumulation: branchData?.allowPointAccumulation ?? true,
        createdAt: convertTimestamp(branchData?.createdAt),
        updatedAt: convertTimestamp(branchData?.updatedAt),
      };
      return acc;
    }, {} as Record<string, BranchDiscountSettings>),
  };
};
export function useDiscountSettings() {
  const [discountSettings, setDiscountSettings] = useState<DiscountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  // 할인 설정 조회
  const fetchDiscountSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const docRef = doc(db, 'discount_settings', 'settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const convertedData = convertFirestoreData(data);
        setDiscountSettings(convertedData);
      } else {
        // 기본 설정 생성
        const defaultSettings: DiscountSettings = {
          globalSettings: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1년 후
            allowDuplicateDiscount: false,
            allowPointAccumulation: true,
            minOrderAmount: 10000,
          },
          branchSettings: {},
        };
        await setDoc(docRef, defaultSettings);
        setDiscountSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error fetching discount settings:', error);
      setError('할인 설정을 불러오는 중 오류가 발생했습니다.');
      toast({
        variant: 'destructive',
        title: '오류',
        description: '할인 설정을 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  // 전역 설정 업데이트
  const updateGlobalSettings = useCallback(async (settings: Partial<GlobalDiscountSettings>) => {
    if (!discountSettings) return;
    try {
      const docRef = doc(db, 'discount_settings', 'settings');
      const updatedSettings = {
        ...discountSettings,
        globalSettings: {
          ...discountSettings.globalSettings,
          ...settings,
        },
      };
      await updateDoc(docRef, updatedSettings);
      setDiscountSettings(updatedSettings);
      toast({
        title: '성공',
        description: '전역 설정이 업데이트되었습니다.',
      });
    } catch (error) {
      console.error('Error updating global settings:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '설정 업데이트 중 오류가 발생했습니다.',
      });
    }
  }, [discountSettings, toast]);
  // 지점별 설정 업데이트
  const updateBranchSettings = useCallback(async (branchId: string, settings: Partial<BranchDiscountSettings>) => {
    if (!discountSettings) return;
    try {
      const docRef = doc(db, 'discount_settings', 'settings');
      const updatedSettings = {
        ...discountSettings,
        branchSettings: {
          ...discountSettings.branchSettings,
          [branchId]: {
            ...discountSettings.branchSettings[branchId],
            ...settings,
            updatedAt: new Date(),
          },
        },
      };
      await updateDoc(docRef, updatedSettings);
      setDiscountSettings(updatedSettings);
      toast({
        title: '성공',
        description: '지점 설정이 저장되었습니다.',
      });
    } catch (error) {
      console.error('Error updating branch settings:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '설정 업데이트 중 오류가 발생했습니다.',
      });
    }
  }, [discountSettings, toast]);
  // 지점별 할인 적용 가능 여부 확인
  const canApplyDiscount = useCallback((branchId: string, orderTotal: number) => {
    if (!discountSettings) return false;
    const branchSettings = discountSettings.branchSettings[branchId];
    const globalSettings = discountSettings.globalSettings;
    if (!branchSettings?.isActive) return false;
    const now = new Date();
    const startDate = globalSettings.startDate;
    const endDate = globalSettings.endDate;
    if (now < startDate || now > endDate) return false;
    const minAmount = branchSettings.minOrderAmount || globalSettings.minOrderAmount;
    if (orderTotal < minAmount) return false;
    return true;
  }, [discountSettings]);
  // 활성화된 할인율 목록 조회
  const getActiveDiscountRates = useCallback((branchId: string) => {
    if (!discountSettings) return [];
    const branchSettings = discountSettings.branchSettings[branchId];
    if (!branchSettings?.isActive) return [];
    return branchSettings.discountRates.filter(rate => rate.isActive);
  }, [discountSettings]);
  useEffect(() => {
    fetchDiscountSettings();
  }, [fetchDiscountSettings]);
  return {
    discountSettings,
    loading,
    error,
    fetchDiscountSettings,
    updateGlobalSettings,
    updateBranchSettings,
    canApplyDiscount,
    getActiveDiscountRates,
  };
}
