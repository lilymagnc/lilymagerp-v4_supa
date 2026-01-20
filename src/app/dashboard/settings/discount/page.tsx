"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useBranches } from "@/hooks/use-branches";
import { useDiscountSettings } from "@/hooks/use-discount-settings";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon, Store, Settings } from "lucide-react";
import { BranchDiscountSettings, DiscountRate } from "@/types/discount";
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
export default function DiscountSettingsPage() {
  const { user } = useAuth();
  const { branches } = useBranches();
  const { discountSettings, updateGlobalSettings, updateBranchSettings } = useDiscountSettings();
  const { toast } = useToast();
  // 권한 확인
  if (user?.role !== '본사 관리자') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600">접근 권한이 없습니다</h2>
          <p className="text-muted-foreground">본사 관리자만 할인 설정에 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }
  // 전역 설정 상태
  const [globalSettings, setGlobalSettings] = useState({
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    allowDuplicateDiscount: false,
    allowPointAccumulation: true,
    minOrderAmount: 10000,
  });
  // 지점별 설정 상태
  const [branchSettings, setBranchSettings] = useState<Record<string, BranchDiscountSettings>>({});
  useEffect(() => {
    if (discountSettings) {
      setGlobalSettings({
        startDate: new Date(discountSettings.globalSettings.startDate),
        endDate: new Date(discountSettings.globalSettings.endDate),
        allowDuplicateDiscount: discountSettings.globalSettings.allowDuplicateDiscount,
        allowPointAccumulation: discountSettings.globalSettings.allowPointAccumulation,
        minOrderAmount: discountSettings.globalSettings.minOrderAmount,
      });
      setBranchSettings(discountSettings.branchSettings);
    }
  }, [discountSettings]);
  const handleGlobalSettingsSave = async () => {
    try {
      await updateGlobalSettings(globalSettings);
      toast({
        title: "성공",
        description: "전역 설정이 저장되었습니다.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "설정 저장 중 오류가 발생했습니다.",
      });
    }
  };
  const handleBranchSettingsSave = async (branchId: string) => {
    try {
      await updateBranchSettings(branchId, branchSettings[branchId]);
      toast({
        title: "성공",
        description: "지점 설정이 저장되었습니다.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "오류",
        description: "설정 저장 중 오류가 발생했습니다.",
      });
    }
  };
  const toggleBranchDiscount = (branchId: string) => {
    const currentSettings = branchSettings[branchId] || {
      isActive: false,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      discountRates: DEFAULT_DISCOUNT_RATES,
      customRate: 0,
      minOrderAmount: globalSettings.minOrderAmount,
      allowDuplicateDiscount: globalSettings.allowDuplicateDiscount,
      allowPointAccumulation: globalSettings.allowPointAccumulation,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setBranchSettings(prev => ({
      ...prev,
      [branchId]: {
        ...currentSettings,
        isActive: !currentSettings.isActive,
      },
    }));
  };
  const toggleDiscountRate = (branchId: string, rate: number) => {
    const currentSettings = branchSettings[branchId];
    if (!currentSettings) return;
    const updatedRates = currentSettings.discountRates.map(r =>
      r.rate === rate ? { ...r, isActive: !r.isActive } : r
    );
    setBranchSettings(prev => ({
      ...prev,
      [branchId]: {
        ...currentSettings,
        discountRates: updatedRates,
      },
    }));
  };
  return (
    <div>
      <PageHeader
        title="할인 설정"
        description="지점별 할인율 및 정책을 관리합니다."
      />
      {/* 전역 설정 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            전역 설정
          </CardTitle>
          <CardDescription>
            모든 지점에 적용되는 기본 할인 정책을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>할인 시작일</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !globalSettings.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {globalSettings.startDate ? (
                      format(globalSettings.startDate, "PPP", { locale: ko })
                    ) : (
                      <span>날짜 선택</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={globalSettings.startDate}
                    onSelect={(date) => date && setGlobalSettings(prev => ({ ...prev, startDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>할인 종료일</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !globalSettings.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {globalSettings.endDate ? (
                      format(globalSettings.endDate, "PPP", { locale: ko })
                    ) : (
                      <span>날짜 선택</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={globalSettings.endDate}
                    onSelect={(date) => date && setGlobalSettings(prev => ({ ...prev, endDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="space-y-2">
            <Label>최소 주문 금액</Label>
            <Input
              type="number"
              value={globalSettings.minOrderAmount}
              onChange={(e) => setGlobalSettings(prev => ({ 
                ...prev, 
                minOrderAmount: Number(e.target.value) 
              }))}
              placeholder="10000"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-duplicate"
                checked={globalSettings.allowDuplicateDiscount}
                onCheckedChange={(checked) => setGlobalSettings(prev => ({ 
                  ...prev, 
                  allowDuplicateDiscount: checked as boolean 
                }))}
              />
              <Label htmlFor="allow-duplicate">포인트와 할인 중복 허용</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-points"
                checked={globalSettings.allowPointAccumulation}
                onCheckedChange={(checked) => setGlobalSettings(prev => ({ 
                  ...prev, 
                  allowPointAccumulation: checked as boolean 
                }))}
              />
              <Label htmlFor="allow-points">할인 시 포인트 적립 허용</Label>
            </div>
          </div>
          <Button onClick={handleGlobalSettingsSave} className="w-full">
            전역 설정 저장
          </Button>
        </CardContent>
      </Card>
      {/* 지점별 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            지점별 할인 설정
          </CardTitle>
          <CardDescription>
            각 지점별로 할인율과 정책을 개별 설정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {branches.filter(branch => branch.type !== '본사').map((branch) => {
            const branchSetting = branchSettings[branch.id];
            const isActive = branchSetting?.isActive || false;
            return (
              <div key={branch.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{branch.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isActive ? "할인 활성화" : "할인 비활성화"}
                    </p>
                  </div>
                  <Button
                    variant={isActive ? "default" : "outline"}
                    onClick={() => toggleBranchDiscount(branch.id)}
                  >
                    {isActive ? "할인 비활성화" : "할인 활성화"}
                  </Button>
                </div>
                {isActive && branchSetting && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {branchSetting.discountRates.map((rate) => (
                        <div key={rate.rate} className="flex items-center space-x-2">
                          <Checkbox
                            checked={rate.isActive}
                            onCheckedChange={() => toggleDiscountRate(branch.id, rate.rate)}
                          />
                          <Label className="text-sm">{rate.label}</Label>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <Label>수동 할인율 (최대 50%)</Label>
                      <Input
                        type="number"
                        value={branchSetting.customRate}
                        onChange={(e) => {
                          const value = Math.min(Math.max(0, Number(e.target.value)), 50);
                          setBranchSettings(prev => ({
                            ...prev,
                            [branch.id]: {
                              ...prev[branch.id],
                              customRate: value,
                            },
                          }));
                        }}
                        min="0"
                        max="50"
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>지점별 최소 주문 금액 (기본값 사용 시 비워두세요)</Label>
                      <Input
                        type="number"
                        value={branchSetting.minOrderAmount || ""}
                        onChange={(e) => {
                          const value = e.target.value ? Number(e.target.value) : 0;
                          setBranchSettings(prev => ({
                            ...prev,
                            [branch.id]: {
                              ...prev[branch.id],
                              minOrderAmount: value,
                            },
                          }));
                        }}
                        placeholder="기본값 사용"
                      />
                    </div>
                    <Button
                      onClick={() => handleBranchSettingsSave(branch.id)}
                      className="w-full"
                    >
                      {branch.name} 설정 저장
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
