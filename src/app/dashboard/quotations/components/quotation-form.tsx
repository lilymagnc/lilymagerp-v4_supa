"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Trash2, Plus, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Quotation, QuotationItem } from "@/types/quotation";
import { useCustomers, Customer } from "@/hooks/use-customers";
import { useProducts, Product } from "@/hooks/use-products";
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { Timestamp } from "firebase/firestore";
import { Switch } from "@/components/ui/switch";
import { debounce } from "lodash";

interface QuotationFormProps {
    initialData?: Quotation;
    onSubmit: (data: Omit<Quotation, 'id'>) => Promise<void>;
    isSubmitting: boolean;
}

export function QuotationForm({ initialData, onSubmit, isSubmitting }: QuotationFormProps) {
    const router = useRouter();
    const { user } = useAuth();
    const { customers } = useCustomers();
    const { products } = useProducts();
    const { branches } = useBranches();

    const [selectedBranchId, setSelectedBranchId] = useState(initialData?.branchId || "");

    const [quotationNumber, setQuotationNumber] = useState(initialData?.quotationNumber || "");
    const [validUntil, setValidUntil] = useState<Date | undefined>(
        initialData?.validUntil ? (initialData.validUntil instanceof Timestamp ? initialData.validUntil.toDate() : initialData.validUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Default 7 days
    );

    // Customer State
    const [customerName, setCustomerName] = useState(initialData?.customer.name || "");
    const [customerContact, setCustomerContact] = useState(initialData?.customer.contact || "");
    const [customerEmail, setCustomerEmail] = useState(initialData?.customer.email || "");
    const [customerAddress, setCustomerAddress] = useState(initialData?.customer.address || "");
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // Customer Search State
    const [customerSearchQuery, setCustomerSearchQuery] = useState("");
    const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
    const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
    const [customerSearchLoading, setCustomerSearchLoading] = useState(false);

    // Items State
    const [items, setItems] = useState<QuotationItem[]>(initialData?.items || []);

    // Product Search State
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [productSearchResults, setProductSearchResults] = useState<Product[]>([]);
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false);

    // Summary State
    const [discountRate, setDiscountRate] = useState(0);
    const [includeVat, setIncludeVat] = useState(initialData?.summary?.includeVat ?? true);
    const [notes, setNotes] = useState(initialData?.notes || "");
    const [terms, setTerms] = useState(initialData?.terms || "본 견적서는 발행일로부터 7일간 유효합니다.");

    // Generate Quotation Number if new
    useEffect(() => {
        if (!initialData && !quotationNumber) {
            const dateStr = format(new Date(), "yyyyMMdd");
            const randomStr = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            setQuotationNumber(`Q-${dateStr}-${randomStr}`);
        }
    }, [initialData, quotationNumber]);

    // Set default branch for non-HQ users
    useEffect(() => {
        if (user && user.franchise !== '본사' && !selectedBranchId) {
            const userBranch = branches.find(b => b.name === user.franchise);
            if (userBranch) {
                setSelectedBranchId(userBranch.id);
            }
        }
    }, [user, branches, selectedBranchId]);

    // Calculate Summary
    const summary = useMemo(() => {
        const subtotal = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const discountAmount = Math.floor(subtotal * (discountRate / 100));
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = includeVat ? Math.floor(afterDiscount * 0.1) : 0; // 10% VAT if included
        const totalAmount = afterDiscount + taxAmount;

        return {
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount,
            includeVat
        };
    }, [items, discountRate, includeVat]);

    const formatPhoneNumber = (value: string) => {
        const phoneNumber = value.replace(/[^\d]/g, '');
        const phoneNumberLength = phoneNumber.length;
        if (phoneNumberLength < 4) return phoneNumber;
        if (phoneNumberLength < 8) {
            return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3)}`;
        }
        return `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatPhoneNumber(e.target.value);
        setCustomerContact(formatted);
    };

    // Customer Search Logic
    const handleCustomerSearch = useCallback((query: string) => {
        if (!query.trim()) {
            setCustomerSearchResults([]);
            return;
        }
        setCustomerSearchLoading(true);
        try {
            const searchTerm = query.toLowerCase().trim();
            const results = customers.filter(c =>
                c.name.toLowerCase().includes(searchTerm) ||
                c.contact.replace(/[^0-9]/g, '').includes(searchTerm) ||
                (c.companyName && c.companyName.toLowerCase().includes(searchTerm))
            );
            setCustomerSearchResults(results);
        } finally {
            setCustomerSearchLoading(false);
        }
    }, [customers]);

    const debouncedCustomerSearch = useMemo(
        () => debounce(handleCustomerSearch, 300),
        [handleCustomerSearch]
    );

    const handleCustomerSelect = (customer: Customer) => {
        setSelectedCustomer(customer);
        setCustomerName(customer.name);
        setCustomerContact(customer.contact);
        setCustomerEmail(customer.email || "");
        setCustomerAddress(customer.address || "");
        setIsCustomerSearchOpen(false);
        setCustomerSearchQuery("");
    };

    // Product Search Logic
    const handleProductSearch = useCallback((query: string) => {
        if (!query.trim()) {
            setProductSearchResults([]);
            return;
        }
        const searchTerm = query.toLowerCase().trim();
        const results = products.filter(p =>
            p.name.toLowerCase().includes(searchTerm)
        );
        setProductSearchResults(results);
    }, [products]);

    const debouncedProductSearch = useMemo(
        () => debounce(handleProductSearch, 300),
        [handleProductSearch]
    );

    const handleProductSelect = (product: Product) => {
        const newItem: QuotationItem = {
            id: product.id,
            name: product.name,
            quantity: 1,
            price: product.price,
            unit: "EA",
            description: ""
        };
        setItems([...items, newItem]);
        setIsProductSearchOpen(false);
        setProductSearchQuery("");
    };

    const handleAddItem = () => {
        const newItem: QuotationItem = {
            id: `custom_${Date.now()}`,
            name: "",
            quantity: 1,
            price: 0,
            unit: "EA",
            description: ""
        };
        setItems([...items, newItem]);
    };

    const handleUpdateItem = (index: number, field: keyof QuotationItem, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!user) return;

        const selectedBranch = branches.find(b => b.id === selectedBranchId);
        const branchName = selectedBranch?.name || user.franchise || '본사';

        // Provider info from selected branch or default to HQ info if not found (fallback)
        const provider = {
            name: selectedBranch?.name || "릴리맥 (LilyMag)",
            representative: selectedBranch?.manager || "김선영",
            address: selectedBranch?.address || "서울시 영등포구 국제금융로8길 25 주택건설회관 B1",
            contact: selectedBranch?.phone || "02-782-4563",
            email: "lilymagshop@naver.com",
            businessNumber: selectedBranch?.businessNumber || "123-45-67890"
        };

        const quotationData: Omit<Quotation, 'id'> = {
            quotationNumber,
            createdAt: initialData?.createdAt || Timestamp.now(),
            updatedAt: Timestamp.now(),
            validUntil: validUntil ? Timestamp.fromDate(validUntil) : Timestamp.fromDate(new Date()),
            customer: {
                id: selectedCustomer?.id,
                name: customerName,
                contact: customerContact,
                email: customerEmail,
                address: customerAddress
            },
            items,
            summary,
            status: initialData?.status || 'draft',
            notes,
            terms,
            branchId: selectedBranchId || (user.franchise === '본사' ? 'HQ' : (user.franchise || '')),
            branchName: branchName,
            provider,
            createdBy: user.uid
        };

        await onSubmit(quotationData);
    };

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.customer-search-container')) {
                setIsCustomerSearchOpen(false);
            }
            if (!target.closest('.product-search-container')) {
                setIsProductSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>견적서 정보</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>견적서 번호</Label>
                            <Input value={quotationNumber} onChange={(e) => setQuotationNumber(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                            <Label>지점 (공급자)</Label>
                            <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={user?.franchise !== '본사'}>
                                <SelectTrigger>
                                    <SelectValue placeholder="지점 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    {branches.map((branch) => (
                                        <SelectItem key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>유효기간</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !validUntil && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {validUntil ? format(validUntil, "PPP", { locale: ko }) : <span>날짜 선택</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={validUntil} onSelect={setValidUntil} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>고객 정보</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2 customer-search-container relative">
                            <Label>고객명</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={customerName}
                                    onChange={(e) => {
                                        setCustomerName(e.target.value);
                                        setCustomerSearchQuery(e.target.value);
                                        setIsCustomerSearchOpen(true);
                                        debouncedCustomerSearch(e.target.value);
                                    }}
                                    onFocus={() => setIsCustomerSearchOpen(true)}
                                    placeholder="고객명 또는 연락처 검색"
                                    required
                                />
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsCustomerSearchOpen(!isCustomerSearchOpen)}>
                                    <Search className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Custom Customer Search Dropdown */}
                            {isCustomerSearchOpen && customerSearchQuery && (
                                <div className="absolute z-50 w-full mt-16 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {customerSearchLoading ? (
                                        <div className="p-4 text-center text-sm text-gray-500">
                                            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> 검색 중...
                                        </div>
                                    ) : customerSearchResults.length > 0 ? (
                                        customerSearchResults.map((customer, index) => (
                                            <div
                                                key={`${customer.id}-${index}`}
                                                className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                onClick={() => handleCustomerSelect(customer)}
                                            >
                                                <div className="font-medium">{customer.name}</div>
                                                <div className="text-sm text-gray-500">{customer.contact}</div>
                                                {customer.companyName && <div className="text-xs text-gray-400">{customer.companyName}</div>}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-sm text-gray-500">
                                            검색 결과가 없습니다.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label>연락처</Label>
                            <Input value={customerContact} onChange={handleContactChange} placeholder="010-0000-0000" />
                        </div>
                        <div className="grid gap-2">
                            <Label>이메일</Label>
                            <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                            <Label>주소</Label>
                            <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>견적 품목</CardTitle>
                    <div className="flex gap-2 product-search-container relative">
                        <div className="relative">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsProductSearchOpen(!isProductSearchOpen)}
                            >
                                <Search className="mr-2 h-4 w-4" />상품 불러오기
                            </Button>

                            {/* Custom Product Search Dropdown */}
                            {isProductSearchOpen && (
                                <div className="absolute right-0 z-50 w-[300px] mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
                                    <div className="p-2 border-b">
                                        <Input
                                            placeholder="상품명 검색..."
                                            value={productSearchQuery}
                                            onChange={(e) => {
                                                setProductSearchQuery(e.target.value);
                                                debouncedProductSearch(e.target.value);
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {productSearchResults.length > 0 ? (
                                            productSearchResults.map((product, index) => (
                                                <div
                                                    key={`${product.id}-${index}`}
                                                    className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => handleProductSelect(product)}
                                                >
                                                    <div className="font-medium">{product.name}</div>
                                                    <div className="text-sm text-gray-500">{product.price.toLocaleString()}원</div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-sm text-gray-500">
                                                {productSearchQuery ? "검색 결과가 없습니다." : "상품명을 입력하세요."}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Button type="button" onClick={handleAddItem} variant="secondary"><Plus className="mr-2 h-4 w-4" />직접 추가</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[300px]">품목명</TableHead>
                                <TableHead>규격/단위</TableHead>
                                <TableHead className="w-[100px]">수량</TableHead>
                                <TableHead className="w-[150px]">단가</TableHead>
                                <TableHead className="w-[150px] text-right">공급가액</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>
                                        <Input value={item.name} onChange={(e) => handleUpdateItem(index, 'name', e.target.value)} placeholder="품목명 입력" />
                                        <Input value={item.description || ""} onChange={(e) => handleUpdateItem(index, 'description', e.target.value)} placeholder="상세설명 (선택)" className="mt-1 text-xs text-muted-foreground h-6" />
                                    </TableCell>
                                    <TableCell>
                                        <Input value={item.unit || ""} onChange={(e) => handleUpdateItem(index, 'unit', e.target.value)} placeholder="EA" />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.quantity} onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))} min={1} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.price} onChange={(e) => handleUpdateItem(index, 'price', Number(e.target.value))} min={0} />
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {(item.price * item.quantity).toLocaleString()}원
                                    </TableCell>
                                    <TableCell>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(index)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>비고 및 조건</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>비고 (내부용)</Label>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="내부 관리용 메모입니다." />
                        </div>
                        <div className="grid gap-2">
                            <Label>견적 조건 (출력용)</Label>
                            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="견적 유효기간, 결제 조건 등을 입력하세요." className="h-32" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>결제 금액</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between text-sm">
                            <span>공급가액 합계</span>
                            <span>{summary.subtotal.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span>할인율 (%)</span>
                            <Input type="number" className="w-20 h-8 text-right" value={discountRate} onChange={(e) => setDiscountRate(Number(e.target.value))} min={0} max={100} />
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>할인 금액</span>
                            <span>-{summary.discountAmount.toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <span>부가세 (10%)</span>
                                <div className="flex items-center space-x-2">
                                    <Switch id="vat-mode" checked={includeVat} onCheckedChange={setIncludeVat} />
                                    <Label htmlFor="vat-mode" className="text-xs text-muted-foreground">{includeVat ? "포함" : "미포함"}</Label>
                                </div>
                            </div>
                            <span>{summary.taxAmount.toLocaleString()}원</span>
                        </div>
                        <div className="border-t pt-4 flex justify-between font-bold text-lg">
                            <span>합계 금액</span>
                            <span>{summary.totalAmount.toLocaleString()}원</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "저장 중..." : "견적서 저장"}
                </Button>
            </div>
        </form>
    );
}
