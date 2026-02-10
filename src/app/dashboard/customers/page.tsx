
"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers, Customer } from "@/hooks/use-customers";
import { CustomerForm, CustomerFormValues } from "./components/customer-form";
import { CustomerTable } from "./components/customer-table";
import { CustomerDetails } from "./components/customer-details";
import { CustomerDetailDialog } from "./components/customer-detail-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatementDialog } from "./components/statement-dialog";
import { CustomerStatsCards } from "./components/customer-stats-cards";
import { ImportButton } from "@/components/import-button";
import { FileUp, Download } from "lucide-react";
import { useBranches } from "@/hooks/use-branches";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { downloadXLSX } from "@/lib/utils";
import { format } from "date-fns";
import { calculateGrade } from "@/lib/customer-utils";
import { isCanceled } from "@/lib/order-utils";
import { supabase } from "@/lib/supabase";
export default function CustomersPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isCustomerDetailOpen, setIsCustomerDetailOpen] = useState(false);
    const [isStatementOpen, setIsStatementOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("all");
    const [selectedType, setSelectedType] = useState("all");
    const [selectedGrade, setSelectedGrade] = useState("all");
    const [activeTab, setActiveTab] = useState("all");
    const { customers, loading, addCustomer, updateCustomer, deleteCustomer, bulkAddCustomers } = useCustomers();
    const { branches } = useBranches();
    const { user } = useAuth();
    const { toast } = useToast();
    const isHeadOfficeAdmin = user?.role === '본사 관리자' || user?.email?.toLowerCase() === 'lilymag0301@gmail.com';
    const canSyncGrades = isHeadOfficeAdmin || user?.role === '가맹점 관리자' || (user?.role as any) === 'admin';
    const userBranch = user?.franchise;
    const customerGrades = useMemo(() => [...new Set(customers.map(c => c.grade || "신규"))], [customers]);
    const filteredCustomers = useMemo(() => {
        let filtered = customers;

        // 검색어 필터링 (검색어가 있으면 지점 필터 무시하고 전체 검색 가능하게 함)
        if (searchTerm) {
            filtered = filtered.filter(customer =>
                String(customer.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(customer.contact ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                String(customer.companyName ?? '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        } else {
            // 검색어가 없을 때만 권한에 따른 지점 필터링 적용 (기본 뷰)
            if (!isHeadOfficeAdmin && userBranch) {
                filtered = filtered.filter(customer =>
                    customer.branch === userBranch ||
                    (customer.branches && customer.branches[userBranch])
                );
            } else if (selectedBranch && selectedBranch !== "all") {
                filtered = filtered.filter(customer =>
                    customer.branch === selectedBranch ||
                    (customer.branches && customer.branches[selectedBranch])
                );
            }
        }
        // 타입 및 등급 필터링
        if (selectedType !== "all") {
            filtered = filtered.filter(customer => customer.type === selectedType);
        }
        if (selectedGrade !== "all") {
            filtered = filtered.filter(customer => (customer.grade || "신규") === selectedGrade);
        }

        // 탭에 따른 필터링 (activeTab)
        if (activeTab === "vvip") {
            filtered = filtered.filter(customer => (customer.grade === "VVIP"));
        } else if (activeTab === "vip") {
            filtered = filtered.filter(customer => (customer.grade === "VIP"));
        } else if (activeTab === "normal") {
            filtered = filtered.filter(customer => (customer.grade === "일반"));
        } else if (activeTab === "new") {
            filtered = filtered.filter(customer => (customer.grade === "신규" || !customer.grade));
        }

        return filtered;
    }, [customers, searchTerm, selectedBranch, selectedType, selectedGrade, isHeadOfficeAdmin, userBranch, activeTab]);
    const handleAdd = () => {
        setSelectedCustomer(null);
        setIsFormOpen(true);
    };
    const handleEdit = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsDetailOpen(false); // Close detail view if open
        setIsFormOpen(true);
    };
    const handleDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsDetailOpen(true);
    }
    const handleRowClick = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsCustomerDetailOpen(true);
    };
    const handleStatementPrint = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsStatementOpen(true);
    };
    const handleFormSubmit = async (data: CustomerFormValues) => {
        if (selectedCustomer?.id) {
            await updateCustomer(selectedCustomer.id, data);
        } else {
            await addCustomer(data);
        }
        setIsFormOpen(false);
        setSelectedCustomer(null);
    };
    const handleDelete = async (id: string) => {
        await deleteCustomer(id);
    };
    const handleImport = async (data: any[]) => {
        // 엑셀 업로드 시 올바른 지점 정보 결정
        let importBranch: string | undefined;

        if (isHeadOfficeAdmin) {
            // 본사 관리자는 선택된 지점 사용 (all이 아닌 경우)
            importBranch = selectedBranch !== "all" ? selectedBranch : undefined;
        } else {
            // 가맹점 관리자/직원은 자신의 지점 사용
            importBranch = userBranch;
        }

        await bulkAddCustomers(data, importBranch);
    };
    const handleExport = () => {
        if (filteredCustomers.length === 0) {
            toast({
                variant: "destructive",
                title: "내보낼 데이터 없음",
                description: "현재 필터에 맞는 고객 데이터가 없습니다.",
            });
            return;
        }
        const dataToExport = filteredCustomers.map(customer => ({
            '고객명': customer.name || '',
            '고객유형': customer.type === 'company' ? '기업' : '개인',
            '회사명': customer.companyName || '',
            '연락처': customer.contact || '',
            '이메일': customer.email || '',
            '주소': customer.address || '',
            '등급': customer.grade || '신규',
            '지점': customer.branch,
            '포인트': customer.points || 0,
            '생일': customer.birthday || '',
            '결혼기념일': customer.weddingAnniversary || '',
            '창립기념일': customer.foundingAnniversary || '',
            '첫방문일': customer.firstVisitDate || '',
            '기타기념일명': customer.otherAnniversaryName || '',
            '기타기념일': customer.otherAnniversary || '',
            '메모': customer.memo || '',
            '생성일': customer.createdAt ? format(new Date(customer.createdAt), 'yyyy-MM-dd HH:mm') : '',
        }));
        downloadXLSX(dataToExport, "customers");
        toast({
            title: "내보내기 성공",
            description: `${dataToExport.length}개의 고객 정보가 XLSX 파일로 다운로드되었습니다.`,
        });
    };

    // 고객 정보 업데이트 핸들러
    const handleCustomerUpdate = (updatedCustomer: Customer) => {
        setSelectedCustomer(updatedCustomer);
    };

    // 전 고객 등급 및 주문 통계 일괄 동기화 (본사 관리자용)
    const [isSyncing, setIsSyncing] = useState(false);
    const handleSyncGrades = async () => {
        if (!confirm("모든 고객의 등급, 주문 횟수, 총 구매액을 주문 내역 기반으로 정밀 재산정하시겠습니까?")) return;

        setIsSyncing(true);
        try {
            // 1. 모든 주문 데이터 가져오기 (페이지네이션으로 전체 누락 없이 로드)
            let allOrders: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, order_date, summary, status, orderer')
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (data && data.length > 0) {
                    allOrders = [...allOrders, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
                if (allOrders.length > 20000) break; // 안전 브레이크
            }

            // 2. 고객 매칭을 위한 주문 데이터 맵 생성 (연락처 정규화 기준)
            const ordersByContact = new Map<string, any[]>();
            const ordersById = new Map<string, any[]>();

            allOrders?.forEach(order => {
                if (isCanceled(order)) return;

                const contact = String(order.orderer?.contact || '').replace(/[^0-9]/g, '');
                const id = order.orderer?.id;

                if (contact) {
                    if (!ordersByContact.has(contact)) ordersByContact.set(contact, []);
                    ordersByContact.get(contact)?.push(order);
                }
                if (id) {
                    if (!ordersById.has(id)) ordersById.set(id, []);
                    ordersById.get(id)?.push(order);
                }
            });

            let updatedCount = 0;
            const updatePromises = [];

            // 3. 전체 고객 순회하며 보정
            for (const customer of customers) {
                const normContact = String(customer.contact || '').replace(/[^0-9]/g, '');

                // ID 매칭 주문 + 연락처 매칭 주문 합산 (중복 제거)
                const idMatches = ordersById.get(customer.id) || [];
                const contactMatches = normContact ? (ordersByContact.get(normContact) || []) : [];

                const uniqueIdSet = new Set();
                const combinedOrders: any[] = [];

                [...idMatches, ...contactMatches].forEach(o => {
                    if (!uniqueIdSet.has(o.id)) {
                        uniqueIdSet.add(o.id);
                        combinedOrders.push(o);
                    }
                });

                const newGrade = calculateGrade(combinedOrders);
                const actualOrderCount = combinedOrders.length;
                const actualTotalSpent = combinedOrders.reduce((sum, o) => sum + (o.summary?.total || 0), 0);

                // 정보가 하나라도 다르면 업데이트
                if (
                    newGrade !== customer.grade ||
                    actualOrderCount !== customer.orderCount ||
                    Math.abs(actualTotalSpent - (customer.totalSpent || 0)) > 1
                ) {
                    updatePromises.push(
                        supabase
                            .from('customers')
                            .update({
                                grade: newGrade,
                                order_count: actualOrderCount,
                                total_spent: actualTotalSpent,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', customer.id)
                    );
                    updatedCount++;
                }

                // 너무 많은 프로미스가 쌓이지 않도록 배치 처리 (10개씩)
                if (updatePromises.length >= 10) {
                    await Promise.all(updatePromises);
                    updatePromises.length = 0;
                }
            }

            if (updatePromises.length > 0) {
                await Promise.all(updatePromises);
            }

            toast({ title: "동기화 완료", description: `${updatedCount}명의 고객 데이터가 정정되었습니다.` });
            window.location.reload();
        } catch (error) {
            console.error("Sync error:", error);
            toast({ variant: "destructive", title: "동기화 실패", description: "데이터 처리 중 오류가 발생했습니다." });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div>
            <PageHeader title="고객 관리" description="고객 정보를 등록하고 관리합니다.">
                <div className="flex items-center gap-2">
                    <ImportButton resourceName="고객" onImport={handleImport}>
                        <FileUp className="mr-2 h-4 w-4" />
                        엑셀로 가져오기
                    </ImportButton>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        내보내기
                    </Button>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        고객 추가
                    </Button>
                </div>
            </PageHeader>

            {/* 고객 통계 카드 */}
            <CustomerStatsCards
                customers={customers}
                selectedBranch={selectedBranch}
            />

            <Tabs defaultValue="all" className="w-full mb-6" onValueChange={setActiveTab}>
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                    <TabsList className="grid grid-cols-5 w-full md:w-[550px]">
                        <TabsTrigger value="all">전체</TabsTrigger>
                        <TabsTrigger value="vvip" className="text-primary font-bold">VVIP 리스트</TabsTrigger>
                        <TabsTrigger value="vip">VIP</TabsTrigger>
                        <TabsTrigger value="normal">일반</TabsTrigger>
                        <TabsTrigger value="new">신규</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-[300px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="고객/회사명, 연락처 검색..."
                                className="w-full rounded-lg bg-background pl-8"
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="지점 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 지점</SelectItem>
                                {branches.map((branch) => (
                                    <SelectItem key={branch.id} value={branch.name}>
                                        {branch.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <TabsContent value={activeTab} className="mt-0">
                    {loading ? (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-2">
                                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <CustomerTable
                            customers={filteredCustomers}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onRowClick={handleRowClick}
                            onStatementPrint={handleStatementPrint}
                        />
                    )}
                </TabsContent>
            </Tabs>

            <CustomerForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                customer={selectedCustomer}
            />
            <CustomerDetails
                isOpen={isDetailOpen}
                onOpenChange={setIsDetailOpen}
                onEdit={() => selectedCustomer && handleEdit(selectedCustomer)}
                customer={selectedCustomer}
            />
            <CustomerDetailDialog
                isOpen={isCustomerDetailOpen}
                onOpenChange={setIsCustomerDetailOpen}
                customer={selectedCustomer}
                onCustomerUpdate={handleCustomerUpdate}
            />
            <StatementDialog
                isOpen={isStatementOpen}
                onOpenChange={setIsStatementOpen}
                customer={selectedCustomer}
            />
        </div>
    );
}

