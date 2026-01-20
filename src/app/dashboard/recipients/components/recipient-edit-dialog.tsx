"use client";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Recipient } from "@/hooks/use-recipients";
import { useBranches } from "@/hooks/use-branches";
import { User, Phone, Mail, MapPin, Building } from "lucide-react";

interface RecipientEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: Recipient | null;
  onSave: (updatedRecipient: Partial<Recipient>) => Promise<void>;
}

export function RecipientEditDialog({ isOpen, onOpenChange, recipient, onSave }: RecipientEditDialogProps) {
  const { toast } = useToast();
  const { branches } = useBranches();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    address: '',
    district: '',
    branchName: '',
    marketingConsent: false
  });

  useEffect(() => {
    if (recipient && isOpen) {
      setFormData({
        name: recipient.name || '',
        contact: recipient.contact || '',
        email: recipient.email || '',
        address: recipient.address || '',
        district: recipient.district || '',
        branchName: recipient.branchName || '',
        marketingConsent: recipient.marketingConsent || false
      });
    }
  }, [recipient, isOpen]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.contact.trim()) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "수령자명과 연락처는 필수 입력 항목입니다."
      });
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
      toast({
        title: "수정 완료",
        description: "수령자 정보가 성공적으로 수정되었습니다."
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating recipient:', error);
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: "수령자 정보 수정 중 오류가 발생했습니다."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            수령자 정보 수정
          </DialogTitle>
          <DialogDescription>
            {recipient?.name}님의 정보를 수정합니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2">
                {/* 수령자명 */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    수령자명 *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="수령자명을 입력하세요"
                    required
                  />
                </div>

                {/* 연락처 */}
                <div className="space-y-2">
                  <Label htmlFor="contact" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    연락처 *
                  </Label>
                  <Input
                    id="contact"
                    value={formData.contact}
                    onChange={(e) => handleInputChange('contact', e.target.value)}
                    placeholder="연락처를 입력하세요"
                    required
                  />
                </div>

                {/* 이메일 */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    이메일
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="이메일을 입력하세요"
                  />
                </div>

                {/* 지점 */}
                <div className="space-y-2">
                  <Label htmlFor="branch" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    지점
                  </Label>
                  <Select value={formData.branchName} onValueChange={(value) => handleInputChange('branchName', value)}>
                    <SelectTrigger id="branch">
                      <SelectValue placeholder="지점을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.name}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 주소 */}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    주소
                  </Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="주소를 입력하세요"
                  />
                </div>

                {/* 지역 */}
                <div className="space-y-2">
                  <Label htmlFor="district">지역</Label>
                  <Input
                    id="district"
                    value={formData.district}
                    onChange={(e) => handleInputChange('district', e.target.value)}
                    placeholder="지역을 입력하세요"
                  />
                </div>

                {/* 마케팅 동의 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    마케팅 동의
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="marketingConsent"
                      checked={formData.marketingConsent}
                      onCheckedChange={(checked) => handleInputChange('marketingConsent', checked as boolean)}
                    />
                    <Label htmlFor="marketingConsent" className="text-sm">
                      마케팅 정보 수신에 동의합니다
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "수정 중..." : "수정 완료"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
