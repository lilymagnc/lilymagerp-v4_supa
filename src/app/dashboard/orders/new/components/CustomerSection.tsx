import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Plus } from "lucide-react";
import { Customer } from "@/hooks/use-customers";
import { Branch } from "@/hooks/use-branches";
import { cn } from "@/lib/utils";

interface CustomerSectionProps {
    selectedBranch: Branch | null;
    availableBranches: Branch[];
    onBranchChange: (branch: Branch) => void;
    isAdmin: boolean;

    // Search State
    isCustomerSearchOpen: boolean;
    setIsCustomerSearchOpen: (open: boolean) => void;
    customerSearchQuery: string;
    setCustomerSearchQuery: (query: string) => void;
    customerSearchResults: Customer[];
    customerSearchLoading: boolean;
    onCustomerSelect: (customer: Customer) => void;

    // Orderer State
    ordererName: string;
    setOrdererName: (name: string) => void;
    ordererContact: string;
    setOrdererContact: (contact: string) => void;
    ordererCompany: string;
    setOrdererCompany: (company: string) => void;
    isAnonymous: boolean;
    setIsAnonymous: (isAnonymous: boolean) => void;
    registerCustomer: boolean;
    setRegisterCustomer: (register: boolean) => void;

    formatPhoneNumber: (value: string) => string;
}

export function CustomerSection({
    selectedBranch,
    availableBranches,
    onBranchChange,
    isAdmin,
    isCustomerSearchOpen,
    setIsCustomerSearchOpen,
    customerSearchQuery,
    setCustomerSearchQuery,
    customerSearchResults,
    customerSearchLoading,
    onCustomerSelect,
    ordererName,
    setOrdererName,
    ordererContact,
    setOrdererContact,
    ordererCompany,
    setOrdererCompany,
    isAnonymous,
    setIsAnonymous,
    registerCustomer,
    setRegisterCustomer,
    formatPhoneNumber
}: CustomerSectionProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                    <span>주문자 정보</span>
                    {isAdmin && (
                        <div className="flex items-center gap-2">
                            <Label className="text-sm font-normal whitespace-nowrap">지점:</Label>
                            <select
                                className="text-sm border rounded px-2 py-1"
                                value={selectedBranch?.name || ''}
                                onChange={(e) => {
                                    const branch = availableBranches.find(b => b.name === e.target.value);
                                    if (branch) onBranchChange(branch);
                                }}
                            >
                                <option value="" disabled>지점 선택</option>
                                {availableBranches.map(b => (
                                    <option key={b.id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Customer Search */}
                <div className="customer-search-container relative">
                    <Label className="text-sm font-medium mb-1.5 block">고객 검색</Label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="이름, 전화번호 또는 회사명으로 검색..."
                            value={customerSearchQuery}
                            onChange={(e) => setCustomerSearchQuery(e.target.value)}
                            onFocus={() => setIsCustomerSearchOpen(true)}
                            className="pl-9"
                        />
                    </div>
                    {isCustomerSearchOpen && customerSearchQuery.trim().length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {customerSearchLoading ? (
                                <div className="p-4 text-center text-sm text-gray-500">검색 중...</div>
                            ) : customerSearchResults.length > 0 ? (
                                customerSearchResults.map((customer) => (
                                    <div
                                        key={customer.id}
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                        onClick={() => onCustomerSelect(customer)}
                                    >
                                        <div className="font-medium">
                                            {customer.name}
                                            {customer.companyName && <span className="text-xs text-muted-foreground ml-2">({customer.companyName})</span>}
                                        </div>
                                        <div className="text-gray-500 text-xs">{customer.contact}</div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-sm text-gray-500">
                                    검색 결과가 없습니다. <br />
                                    <span className="text-xs text-muted-foreground">아래 입력창에 직접 입력하여 진행하세요.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ordererCompany">회사명</Label>
                        <Input
                            id="ordererCompany"
                            value={ordererCompany}
                            onChange={(e) => setOrdererCompany(e.target.value)}
                            placeholder="회사명을 입력하세요"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ordererName">주문자명</Label>
                            <Input
                                id="ordererName"
                                value={ordererName}
                                onChange={(e) => setOrdererName(e.target.value)}
                                placeholder="홍길동"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ordererContact">연락처</Label>
                            <Input
                                id="ordererContact"
                                value={ordererContact}
                                onChange={(e) => setOrdererContact(formatPhoneNumber(e.target.value))}
                                placeholder="010-0000-0000"
                                maxLength={13}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 pt-2">
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="anonymous"
                            checked={isAnonymous}
                            onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
                        />
                        <Label htmlFor="anonymous" className="leading-none cursor-pointer">익명 주문</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="registerCustomer"
                            checked={registerCustomer}
                            onCheckedChange={(checked) => setRegisterCustomer(checked as boolean)}
                            disabled={isAnonymous || !!customerSearchResults.find(c => c.contact === ordererContact && c.name === ordererName)}
                        />
                        <Label htmlFor="registerCustomer" className="leading-none cursor-pointer">고객 자동 등록</Label>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
