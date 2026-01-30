"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useUserRole } from "@/hooks/use-user-role";
import Link from "next/link";
import {
  Settings,
  Building,
  Truck,
  Globe,
  Database,
  Bell,
  Save,
  RefreshCw,
  MessageSquare,
  Mail,
  Type,
  Percent,
  Trash2,
  AlertTriangle,
  Camera,
  BookOpen,
  ArrowRightLeft,
  Server
} from "lucide-react";
import { useSettings, defaultSettings } from "@/hooks/use-settings";
import { useDataCleanup } from "@/hooks/use-data-cleanup";
import BackupManagement from "./components/backup-management";
import RebuildStats from "./components/rebuild-stats";
import { EmailTemplateEditor } from "@/components/email-template-editor";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'general';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const { settings, loading, error, saveSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [newFont, setNewFont] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const { isHQManager } = useUserRole();
  const { loading: cleanupLoading, progress, cleanupAllData, cleanupSpecificData } = useDataCleanup();
  const [selectedDataType, setSelectedDataType] = useState<string>('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const handleSpecificDataCleanup = (dataType: string) => {
    setSelectedDataType(dataType);
    setShowConfirmDialog(true);
  };
  const confirmSpecificDataCleanup = () => {
    if (selectedDataType) {
      cleanupSpecificData(selectedDataType);
      setShowConfirmDialog(false);
      setSelectedDataType('');
    }
  };
  const getDataTypeName = (dataType: string): string => {
    const dataTypeNames: { [key: string]: string } = {
      'orders': '주문',
      'customers': '고객',
      'products': '상품',
      'materials': '자재',
      'expenses': '간편지출',
      'materialRequests': '자재요청',
      'employees': '직원',
      'partners': '거래처',
      'stockHistory': '재고이력',
      'albums': '샘플앨범'
    };
    return dataTypeNames[dataType] || dataType;
  };
  // settings가 로드되었을 때만 localSettings 업데이트
  useEffect(() => {
    if (!loading && settings !== defaultSettings) {
      setLocalSettings(settings);
    }
  }, [settings, loading]);

  // URL query parameter ('tab') 변경 감지하여 탭 전환
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const success = await saveSettings(localSettings);
      if (success) {
        toast({
          title: '설정 저장 완료',
          description: '이메일 템플릿을 포함한 모든 시스템 설정이 저장되었습니다.'
        });
      } else {
        toast({
          variant: 'destructive',
          title: '오류',
          description: '설정 저장 중 오류가 발생했습니다.'
        });
      }
    } catch (error) {
      console.error('설정 저장 중 오류:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '설정 저장 중 오류가 발생했습니다.'
      });
    } finally {
      setSaving(false);
    }
  };
  const resetToDefaults = () => {
    setLocalSettings(settings);
    toast({
      title: '초기화 완료',
      description: '설정이 기본값으로 초기화되었습니다.'
    });
  };
  const addNewFont = () => {
    if (!newFont.trim()) return;
    const fontName = newFont.trim();
    const currentFonts = localSettings.availableFonts || [];
    if (currentFonts.includes(fontName)) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '이미 존재하는 폰트입니다.'
      });
      return;
    }
    setLocalSettings(prev => ({
      ...prev,
      availableFonts: [...currentFonts, fontName]
    }));
    setNewFont('');
    toast({
      title: '성공',
      description: `폰트 "${fontName}"가 추가되었습니다.`
    });
  };
  // 본사 관리자가 아니면 접근 제한
  if (!isHQManager()) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">접근 권한이 없습니다</h2>
          <p className="text-gray-500">시스템 설정은 본사 관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="시스템 설정"
          description="시스템의 기본 설정을 관리합니다."
        />
        <Link href="/dashboard/manual" passHref>
          <Button variant="outline">
            <BookOpen className="h-4 w-4 mr-2" />
            사용자 매뉴얼 보기
          </Button>
        </Link>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-11">
          <TabsTrigger value="general">일반 설정</TabsTrigger>
          <TabsTrigger value="delivery">배송 설정</TabsTrigger>
          <TabsTrigger value="notifications">알림 설정</TabsTrigger>
          <TabsTrigger value="messages">메시지 설정</TabsTrigger>
          <TabsTrigger value="auto-email">자동 이메일</TabsTrigger>
          <TabsTrigger value="files">파일 관리</TabsTrigger>
          <TabsTrigger value="security">보안 설정</TabsTrigger>
          <TabsTrigger value="discount">할인 설정</TabsTrigger>
          <TabsTrigger value="order-transfer">주문 이관</TabsTrigger>
          <TabsTrigger value="backup">백업 관리</TabsTrigger>
          <TabsTrigger value="data-cleanup">데이터 초기화</TabsTrigger>
          <TabsTrigger value="performance">성능 최적화</TabsTrigger>

        </TabsList>
        {/* 일반 설정 */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                사이트 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="siteName">사이트명</Label>
                  <Input
                    id="siteName"
                    value={localSettings.siteName}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, siteName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteDescription">사이트 설명</Label>
                  <Input
                    id="siteDescription"
                    value={localSettings.siteDescription}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, siteDescription: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">연락처 이메일</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={localSettings.contactEmail}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, contactEmail: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">연락처 전화번호</Label>
                  <Input
                    id="contactPhone"
                    value={localSettings.contactPhone}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, contactPhone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="representative">대표자명</Label>
                  <Input
                    id="representative"
                    value={localSettings.representative || ""}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, representative: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessNumber">사업자등록번호</Label>
                  <Input
                    id="businessNumber"
                    value={localSettings.businessNumber || ""}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, businessNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">사업장 주소</Label>
                  <Input
                    id="address"
                    value={localSettings.address || ""}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                시스템 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNumberPrefix">주문번호 접두사</Label>
                  <Input
                    id="orderNumberPrefix"
                    value={localSettings.orderNumberPrefix}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, orderNumberPrefix: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointEarnRate">포인트 적립률 (%)</Label>
                  <Input
                    id="pointEarnRate"
                    type="number"
                    min="0"
                    max="10"
                    value={localSettings.pointEarnRate}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, pointEarnRate: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataRetentionDays">데이터 보관 기간 (일)</Label>
                  <Input
                    id="dataRetentionDays"
                    type="number"
                    min="30"
                    max="1095"
                    value={localSettings.dataRetentionDays}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, dataRetentionDays: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* 배송 설정 */}
        <TabsContent value="delivery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                배송비 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultDeliveryFee">기본 배송비 (원)</Label>
                  <Input
                    id="defaultDeliveryFee"
                    type="number"
                    min="0"
                    value={localSettings.defaultDeliveryFee}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, defaultDeliveryFee: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="freeDeliveryThreshold">무료 배송 기준 (원)</Label>
                  <Input
                    id="freeDeliveryThreshold"
                    type="number"
                    min="0"
                    value={localSettings.freeDeliveryThreshold}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, freeDeliveryThreshold: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* 알림 설정 */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                알림 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>이메일 알림</Label>
                    <p className="text-sm text-gray-500">주문 및 시스템 알림을 이메일로 받습니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.emailNotifications}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS 알림</Label>
                    <p className="text-sm text-gray-500">중요한 알림을 SMS로 받습니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.smsNotifications}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifications: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>자동 백업</Label>
                    <p className="text-sm text-gray-500">정기적으로 데이터를 자동 백업합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoBackup}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, autoBackup: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* 메시지 설정 */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                메시지 출력 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="messageFont">메시지 폰트</Label>
                  <select
                    id="messageFont"
                    value={localSettings.messageFont}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, messageFont: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                  >
                    {localSettings.availableFonts?.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="messageFontSize">폰트 크기 (px)</Label>
                  <Input
                    id="messageFontSize"
                    type="number"
                    min="10"
                    max="24"
                    value={localSettings.messageFontSize}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, messageFontSize: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="messageColor">메시지 색상</Label>
                  <Input
                    id="messageColor"
                    type="color"
                    value={localSettings.messageColor}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, messageColor: e.target.value }))}
                    className="w-full h-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="messageTemplate">기본 메시지 템플릿</Label>
                <textarea
                  id="messageTemplate"
                  value={localSettings.messageTemplate}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, messageTemplate: e.target.value }))}
                  className="w-full p-2 border rounded-md h-24"
                  placeholder="메시지 템플릿을 입력하세요. {고객명}, {상태} 등의 변수를 사용할 수 있습니다."
                />
                <p className="text-xs text-gray-500">
                  사용 가능한 변수: {'{고객명}'}, {'{상태}'}, {'{주문번호}'}, {'{총금액}'}
                </p>
              </div>
            </CardContent>
          </Card>
          {/* 폰트 관리 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                폰트 관리
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>사용 가능한 폰트 목록</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {localSettings.availableFonts?.map((font, index) => (
                    <div key={font} className="flex items-center justify-between p-2 border rounded">
                      <span style={{ fontFamily: font }} className="text-sm">
                        {font}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newFonts = localSettings.availableFonts?.filter((_, i) => i !== index) || [];
                          setLocalSettings(prev => ({ ...prev, availableFonts: newFonts }));
                        }}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newFont">새 폰트 추가</Label>
                <div className="flex gap-2">
                  <Input
                    id="newFont"
                    placeholder="폰트 이름을 입력하세요 (예: Roboto)"
                    value={newFont}
                    onChange={(e) => setNewFont(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={addNewFont}
                    disabled={!newFont.trim()}
                    size="sm"
                  >
                    추가
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  • 폰트 이름은 정확히 입력해야 합니다 (예: "Roboto", "Open Sans")
                  • 시스템에 설치된 폰트만 사용 가능합니다
                  • 웹 폰트를 사용하려면 CSS에서 @import 또는 @font-face를 추가해야 합니다
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* 주문 이관 설정 */}
        <TabsContent value="order-transfer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                주문 이관 기본 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="defaultOrderBranchSplit">발주지점 기본 분배율 (%)</Label>
                  <Input
                    id="defaultOrderBranchSplit"
                    type="number"
                    min="0"
                    max="100"
                    value={localSettings.orderTransferSettings?.defaultTransferSplit?.orderBranch || 100}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      orderTransferSettings: {
                        ...prev.orderTransferSettings,
                        defaultTransferSplit: {
                          ...prev.orderTransferSettings?.defaultTransferSplit,
                          orderBranch: Number(e.target.value),
                          processBranch: 100 - Number(e.target.value)
                        }
                      }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultProcessBranchSplit">수주지점 기본 분배율 (%)</Label>
                  <Input
                    id="defaultProcessBranchSplit"
                    type="number"
                    min="0"
                    max="100"
                    value={localSettings.orderTransferSettings?.defaultTransferSplit?.processBranch || 0}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      orderTransferSettings: {
                        ...prev.orderTransferSettings,
                        defaultTransferSplit: {
                          ...prev.orderTransferSettings?.defaultTransferSplit,
                          processBranch: Number(e.target.value),
                          orderBranch: 100 - Number(e.target.value)
                        }
                      }
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notificationTemplate">알림 메시지 템플릿</Label>
                <Input
                  id="notificationTemplate"
                  value={localSettings.orderTransferSettings?.notificationTemplate || ""}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    orderTransferSettings: {
                      ...prev.orderTransferSettings,
                      notificationTemplate: e.target.value
                    }
                  }))}
                  placeholder="{발주지점}지점으로부터 주문이 이관되었습니다."
                />
                <p className="text-xs text-gray-500">
                  사용 가능한 변수: {'{발주지점}'}, {'{수주지점}'}, {'{주문번호}'}
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>자동 알림</Label>
                    <p className="text-sm text-gray-500">주문 이관 시 자동으로 알림을 생성합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.orderTransferSettings?.autoNotification || false}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      orderTransferSettings: {
                        ...prev.orderTransferSettings,
                        autoNotification: e.target.checked
                      }
                    }))}
                    className="h-4 w-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>전광판 표시</Label>
                    <p className="text-sm text-gray-500">주문 이관 정보를 전광판에 표시합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.orderTransferSettings?.displayBoardEnabled || false}
                    onChange={(e) => setLocalSettings(prev => ({
                      ...prev,
                      orderTransferSettings: {
                        ...prev.orderTransferSettings,
                        displayBoardEnabled: e.target.checked
                      }
                    }))}
                    className="h-4 w-4"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayBoardDuration">전광판 표시 시간 (분)</Label>
                <Input
                  id="displayBoardDuration"
                  type="number"
                  min="1"
                  max="120"
                  value={localSettings.orderTransferSettings?.displayBoardDuration || 30}
                  onChange={(e) => setLocalSettings(prev => ({
                    ...prev,
                    orderTransferSettings: {
                      ...prev.orderTransferSettings,
                      displayBoardDuration: Number(e.target.value)
                    }
                  }))}
                  disabled={!localSettings.orderTransferSettings?.displayBoardEnabled}
                />
              </div>
            </CardContent>
          </Card>


        </TabsContent>
        {/* 백업 관리 */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                백업 관리
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <BackupManagement />
            </CardContent>
          </Card>
        </TabsContent>
        {/* 자동 이메일 설정 */}
        <TabsContent value="auto-email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                자동 이메일 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>배송완료 자동 이메일</Label>
                    <p className="text-sm text-gray-500">배송 완료 시 고객에게 자동으로 이메일을 발송합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoEmailDeliveryComplete}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailDeliveryComplete: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>주문확인 자동 이메일</Label>
                    <p className="text-sm text-gray-500">주문 접수 시 고객에게 확인 이메일을 발송합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoEmailOrderConfirm}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailOrderConfirm: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>상태변경 자동 이메일</Label>
                    <p className="text-sm text-gray-500">주문 상태 변경 시 고객에게 알림 이메일을 발송합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoEmailStatusChange}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailStatusChange: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>생일 축하 자동 이메일</Label>
                    <p className="text-sm text-gray-500">고객 생일 시 축하 이메일을 자동으로 발송합니다</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoEmailBirthday}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, autoEmailBirthday: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </div>
              </div>
              <div className="space-y-6 mt-6">
                <h4 className="font-medium">이메일 템플릿</h4>

                <EmailTemplateEditor
                  templateName="주문확인"
                  value={localSettings.emailTemplateOrderConfirm}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateOrderConfirm: value }))}
                  variables={['고객명', '주문번호', '주문일', '총금액', '회사명', '연락처', '이메일']}
                />

                <EmailTemplateEditor
                  templateName="배송완료"
                  value={localSettings.emailTemplateDeliveryComplete}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateDeliveryComplete: value }))}
                  variables={['고객명', '주문번호', '배송일', '회사명', '연락처', '이메일']}
                />

                <EmailTemplateEditor
                  templateName="상태변경"
                  value={localSettings.emailTemplateStatusChange}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateStatusChange: value }))}
                  variables={['고객명', '주문번호', '이전상태', '현재상태', '회사명', '연락처', '이메일']}
                />

                <EmailTemplateEditor
                  templateName="생일축하"
                  value={localSettings.emailTemplateBirthday}
                  onChange={(value) => setLocalSettings(prev => ({ ...prev, emailTemplateBirthday: value }))}
                  variables={['고객명', '회사명', '연락처', '이메일']}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 파일 관리 설정 탭 */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                배송완료 사진 관리
              </CardTitle>
              <CardDescription>
                배송완료 사진의 자동 삭제 및 보관 정책을 설정합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>자동 삭제 활성화</Label>
                  <p className="text-sm text-gray-500">설정된 기간이 지난 배송완료 사진을 자동으로 삭제합니다</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.autoDeleteDeliveryPhotos}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, autoDeleteDeliveryPhotos: e.target.checked }))}
                  className="h-4 w-4"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deliveryPhotoRetentionDays">보관 기간 (일)</Label>
                <Input
                  id="deliveryPhotoRetentionDays"
                  type="number"
                  min="1"
                  max="365"
                  value={localSettings.deliveryPhotoRetentionDays}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, deliveryPhotoRetentionDays: Number(e.target.value) }))}
                  disabled={!localSettings.autoDeleteDeliveryPhotos}
                />
                <p className="text-xs text-gray-500">
                  {localSettings.autoDeleteDeliveryPhotos
                    ? `${localSettings.deliveryPhotoRetentionDays}일 후 자동으로 삭제됩니다.`
                    : '자동 삭제가 비활성화되어 있습니다.'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* 보안 설정 */}
        {/* 보안 설정 */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                보안 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">세션 타임아웃 (분)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={localSettings.sessionTimeout}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, sessionTimeout: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordMinLength">최소 비밀번호 길이</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    min="6"
                    max="20"
                    value={localSettings.passwordMinLength}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, passwordMinLength: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>비밀번호 변경 요구</Label>
                  <p className="text-sm text-gray-500">정기적으로 비밀번호 변경을 요구합니다</p>
                </div>
                <input
                  type="checkbox"
                  checked={localSettings.requirePasswordChange}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, requirePasswordChange: e.target.checked }))}
                  className="h-4 w-4"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 할인 설정 */}
        <TabsContent value="discount" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                할인 설정
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8">
                <Percent className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">할인 설정 관리</h3>
                <p className="text-gray-500 mb-6">
                  지점별 할인율, 할인 기간, 할인 조건 등을 관리할 수 있습니다.
                </p>
                <Button
                  onClick={() => window.location.href = '/dashboard/settings/discount'}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Percent className="h-4 w-4 mr-2" />
                  할인 설정 관리
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 데이터 초기화 */}
        <TabsContent value="data-cleanup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                데이터 초기화
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-2">⚠️ 주의사항</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• 삭제된 데이터는 복구할 수 없습니다.</li>
                      <li>• 실제 운영 환경에서는 신중하게 사용하세요.</li>
                      <li>• 테스트 데이터 정리 시에만 사용하세요.</li>
                      <li>• 삭제 전 반드시 백업을 확인하세요.</li>
                    </ul>
                  </div>
                </div>
              </div>
              {/* 전체 데이터 초기화 */}
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <h4 className="font-medium text-red-800 mb-3">전체 데이터 초기화</h4>
                <p className="text-sm text-red-700 mb-4">
                  모든 테스트 데이터를 한 번에 삭제합니다. (주문, 고객, 상품, 자재, 지출 등)
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={cleanupLoading}
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {cleanupLoading ? '전체 데이터 삭제 중...' : '전체 데이터 삭제'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>⚠️ 전체 데이터 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        정말로 모든 테스트 데이터를 삭제하시겠습니까?<br />
                        <strong>이 작업은 되돌릴 수 없습니다.</strong><br /><br />
                        삭제될 데이터:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>주문 데이터</li>
                          <li>고객 데이터</li>
                          <li>상품 데이터</li>
                          <li>자재 데이터</li>
                          <li>간편지출 데이터</li>
                          <li>자재요청 데이터</li>
                          <li>직원 데이터</li>
                          <li>거래처 데이터</li>
                          <li>재고이력 데이터</li>
                          <li>샘플앨범 데이터</li>
                        </ul>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={cleanupAllData}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        삭제 확인
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              {/* 개별 데이터 초기화 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">주문 관리</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('orders')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    주문 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">고객 관리</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('customers')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    고객 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">상품 관리</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('products')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    상품 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">자재 관리</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('materials')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    자재 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">간편지출</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('expenses')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    지출 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">자재요청</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('materialRequests')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    자재요청 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">직원 관리</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('employees')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    직원 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">거래처 관리</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('partners')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    거래처 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">재고이력</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('stockHistory')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    재고이력 데이터 삭제
                  </Button>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">샘플앨범</h4>
                  <Button
                    onClick={() => handleSpecificDataCleanup('albums')}
                    disabled={cleanupLoading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    샘플앨범 데이터 삭제
                  </Button>
                </div>
              </div>
              {/* 진행률 표시 */}
              {progress && (
                <div className="border rounded-lg p-4 bg-blue-50">
                  <h4 className="font-medium text-blue-800 mb-2">진행 상황</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{progress.current}</span>
                      <span>{progress.completed}/{progress.total}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              {/* 개별 데이터 삭제 확인 대화상자 */}
              <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>⚠️ 데이터 삭제 확인</AlertDialogTitle>
                    <AlertDialogDescription>
                      정말로 {getDataTypeName(selectedDataType)} 데이터를 삭제하시겠습니까?<br />
                      <strong>이 작업은 되돌릴 수 없습니다.</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={confirmSpecificDataCleanup}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      삭제 확인
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 성능 최적화 설정 */}
        <TabsContent value="performance" className="space-y-4">
          <RebuildStats />
        </TabsContent>
      </Tabs>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={resetToDefaults}>
          <RefreshCw className="h-4 w-4 mr-2" />
          기본값으로 초기화
        </Button>
        <Button onClick={handleSaveSettings} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}

