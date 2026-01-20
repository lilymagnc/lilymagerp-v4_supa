import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrderTransferSettings } from '@/types/order-transfer';

export interface SystemSettings {
  // 사이트 정보
  siteName: string;
  siteDescription: string;
  contactEmail: string;
  contactPhone: string;

  // 기본 배송비 설정
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;

  // 알림 설정
  emailNotifications: boolean;
  smsNotifications: boolean;

  // 시스템 설정
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetentionDays: number;

  // 포인트 시스템
  pointEarnRate: number; // 구매 금액 대비 포인트 적립률
  pointUseRate: number;  // 포인트 사용 시 할인률

  // 주문 설정
  orderNumberPrefix: string;
  autoOrderNumber: boolean;

  // 보안 설정
  sessionTimeout: number; // 분 단위
  requirePasswordChange: boolean;
  passwordMinLength: number;

  // 메시지 출력 설정
  messageFont: string;
  messageFontSize: number;
  messageColor: string;
  messageTemplate: string;
  availableFonts: string[]; // 사용 가능한 폰트 목록

  // 자동 이메일 설정
  autoEmailDeliveryComplete: boolean;
  autoEmailOrderConfirm: boolean;
  autoEmailStatusChange: boolean;
  autoEmailBirthday: boolean;
  emailTemplateDeliveryComplete: string;
  emailTemplateOrderConfirm: string;
  emailTemplateStatusChange: string;
  emailTemplateBirthday: string;

  // 할인 설정
  defaultDiscountRate: number;
  maxDiscountRate: number;
  discountReason: string;

  // 배송완료 사진 관리 설정
  autoDeleteDeliveryPhotos: boolean;
  deliveryPhotoRetentionDays: number; // 보관 일수

  // 주문 이관 설정
  orderTransferSettings: OrderTransferSettings;
}

export const defaultSettings: SystemSettings = {
  siteName: "릴리맥 ERP",
  siteDescription: "플라워샵 주문관리 및 가맹점 관리를 위한 ERP 시스템",
  contactEmail: "admin@lilymag.com",
  contactPhone: "02-1234-5678",
  defaultDeliveryFee: 3000,
  freeDeliveryThreshold: 50000,
  emailNotifications: true,
  smsNotifications: false,
  autoBackup: true,
  backupFrequency: 'daily',
  dataRetentionDays: 365,
  pointEarnRate: 2, // 2%
  pointUseRate: 1,  // 1:1 비율
  orderNumberPrefix: "ORD",
  autoOrderNumber: true,
  sessionTimeout: 30,
  requirePasswordChange: false,
  passwordMinLength: 8,
  // 메시지 출력 설정
  messageFont: "Noto Sans KR",
  messageFontSize: 14,
  messageColor: "#000000",
  messageTemplate: "안녕하세요! {고객명}님의 주문이 {상태}되었습니다. 감사합니다.",
  availableFonts: [
    "Noto Sans KR",
    "Malgun Gothic",
    "Nanum Gothic",
    "Nanum Myeongjo",
    "Gaegu",
    "Noto Serif KR",
    "Source Code Pro",
    "Roboto",
    "Open Sans",
    "Lato",
    "Montserrat",
    "Poppins",
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Georgia",
    "Verdana",
    "Tahoma",
    "Courier New",
    "Impact",
    "Comic Sans MS"
  ],
  // 자동 이메일 설정
  autoEmailDeliveryComplete: true,
  autoEmailOrderConfirm: true,
  autoEmailStatusChange: false,
  autoEmailBirthday: true,
  emailTemplateDeliveryComplete: `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{회사명} - 배송완료 알림</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Noto Sans KR', Arial, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 300; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 18px; color: #333; margin-bottom: 20px; }
        .info-box { background-color: #f8f9fa; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
        .info-label { font-weight: bold; color: #555; }
        .info-value { color: #333; }
        .photo-section { text-align: center; margin: 30px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .success-icon { font-size: 48px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="success-icon">🚚✅</div>
            <h1>{회사명}</h1>
        </div>
        <div class="content">
            <div class="greeting">안녕하세요, {고객명}님! 👋</div>
            <p>주문하신 상품이 <strong>성공적으로 배송 완료</strong>되었습니다.</p>
            
            <div class="info-box">
                <div class="info-row">
                    <span class="info-label">주문번호:</span>
                    <span class="info-value">{주문번호}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">배송완료일:</span>
                    <span class="info-value">{배송일}</span>
                </div>
            </div>
            
            <p>소중한 주문에 감사드리며, 앞으로도 최고의 서비스로 보답하겠습니다.</p>
            
            <p>추가 문의사항이 있으시면 언제든지 연락해 주세요.</p>
        </div>
        <div class="footer">
            <p><strong>{회사명}</strong></p>
            <p>이 이메일은 자동으로 발송된 메일입니다.</p>
        </div>
    </div>
</body>
</html>`,
  emailTemplateOrderConfirm: "안녕하세요 {고객명}님!\n\n주문이 성공적으로 접수되었습니다.\n\n주문번호: {주문번호}\n주문일: {주문일}\n총 금액: {총금액}원\n\n감사합니다.\n{회사명}",
  emailTemplateStatusChange: "안녕하세요 {고객명}님!\n\n주문 상태가 변경되었습니다.\n\n주문번호: {주문번호}\n이전 상태: {이전상태}\n현재 상태: {현재상태}\n\n감사합니다.\n{회사명}",
  emailTemplateBirthday: "안녕하세요 {고객명}님!\n\n생일을 진심으로 축하드립니다! 🎉\n\n특별한 할인 혜택을 드립니다.\n\n감사합니다.\n{회사명}",
  // 할인 설정
  defaultDiscountRate: 0,
  maxDiscountRate: 10,
  discountReason: "회원 할인",

  // 배송완료 사진 관리 설정
  autoDeleteDeliveryPhotos: false,
  deliveryPhotoRetentionDays: 90, // 90일 보관

          // 주문 이관 설정
        orderTransferSettings: {
          defaultTransferSplit: {
            orderBranch: 100, // 발주지점 100%
            processBranch: 0, // 수주지점 0%
          },
          transferRules: {
            'store': { orderBranch: 100, processBranch: 0 },
            'phone': { orderBranch: 100, processBranch: 0 },
            'naver': { orderBranch: 100, processBranch: 0 },
            'kakao': { orderBranch: 100, processBranch: 0 },
            'etc': { orderBranch: 100, processBranch: 0 },
          },
    autoNotification: true,
    notificationTemplate: "{발주지점}지점으로부터 주문이 이관되었습니다.",

    displayBoardEnabled: true,
    displayBoardDuration: 30, // 30분
  }
};

export function useSettings() {
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveSettings = useCallback(async (newSettings: SystemSettings) => {
    try {
      setError(null);

      const settingsDoc = doc(db, 'system', 'settings');
      await setDoc(settingsDoc, {
        ...newSettings,
        updatedAt: serverTimestamp()
      });

      setSettings(newSettings);
      return true;
    } catch (err) {
      console.error('설정 저장 중 오류:', err);
      setError('설정 저장 중 오류가 발생했습니다.');
      return false;
    }
  }, []);

  const getSetting = useCallback((key: keyof SystemSettings) => {
    return settings[key];
  }, [settings]);

  useEffect(() => {
    const initializeSettings = async () => {
      try {
        setLoading(true);
        setError(null);

        const settingsDoc = doc(db, 'system', 'settings');
        const settingsSnapshot = await getDoc(settingsDoc);

        if (settingsSnapshot.exists()) {
          const data = settingsSnapshot.data();
          setSettings({ ...defaultSettings, ...data });
        } else {
          // 기본 설정으로 초기화
          await setDoc(settingsDoc, {
            ...defaultSettings,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error('설정 로드 중 오류:', err);
        setError('설정을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    initializeSettings();
  }, []);

  return {
    settings,
    loading,
    error,
    saveSettings,
    getSetting
  };
} 
