
"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Search, Download, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePartners, Partner } from "@/hooks/use-partners";
import { PartnerForm, PartnerFormValues } from "./components/partner-form";
import { PartnerTable } from "./components/partner-table";
import { useAuth } from "@/hooks/use-auth";
import { downloadXLSX } from "@/lib/utils";
import { format } from "date-fns";
import { ImportButton } from "@/components/import-button";
export default function PartnersPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedType, setSelectedType] = useState("all");
    const { toast } = useToast();
    const { partners, loading: partnersLoading, addPartner, updatePartner, deletePartner, bulkAddPartners } = usePartners();
    const { user } = useAuth();
    const isHeadOfficeAdmin = user?.role === '본사 관리자';
    const userBranch = user?.franchise;
    const partnerTypes = useMemo(() => [...new Set(partners.map(p => p.type))], [partners]);
    const filteredPartners = useMemo(() => {
        let filtered = partners;
        // 모든 사용자가 모든 거래처를 볼 수 있도록 수정 (지점 필터링 제거)
        // 검색어 필터링
        filtered = filtered.filter(partner => 
            String(partner.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(partner.contactPerson ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        // 타입 필터링
        if (selectedType !== "all") {
            filtered = filtered.filter(partner => partner.type === selectedType);
        }
        return filtered;
    }, [partners, searchTerm, selectedType]);
    const handleAdd = () => {
        setSelectedPartner(null);
        setIsFormOpen(true);
    };
    const handleEdit = (partner: Partner) => {
        setSelectedPartner(partner);
        setIsFormOpen(true);
    };
    const handleFormSubmit = async (data: PartnerFormValues) => {
        if (selectedPartner?.id) {
            await updatePartner(selectedPartner.id, data);
        } else {
            await addPartner(data);
        }
        setIsFormOpen(false);
        setSelectedPartner(null);
    };
    const handleDelete = async (id: string) => {
        await deletePartner(id);
    };
    const handleExport = () => {
        if (filteredPartners.length === 0) {
            toast({
                variant: "destructive",
                title: "내보낼 데이터 없음",
                description: "목록에 데이터가 없습니다.",
            });
            return;
        }
        const dataToExport = filteredPartners.map(partner => ({
            '거래처명': partner.name,
            '유형': partner.type,
            '연락처': partner.contact,
            '담당자': partner.contactPerson || '',
            '이메일': partner.email || '',
            '주소': partner.address || '',
            '지점': partner.branch,
            '메모': partner.memo || '',
            '등록일': partner.createdAt ? format(new Date(partner.createdAt), 'yyyy-MM-dd HH:mm') : '',
        }));
        downloadXLSX(dataToExport, "partners");
        toast({
            title: "내보내기 성공",
            description: `${dataToExport.length}개의 거래처 정보가 XLSX 파일로 다운로드되었습니다.`,
        });
    };
    const handleImport = async (data: any[]) => {
        try {
            await bulkAddPartners(data);
            toast({
                title: "업로드 성공",
                description: "거래처 정보가 성공적으로 업로드되었습니다.",
            });
        } catch (error) {
            console.error('Import error:', error);
            toast({
                variant: "destructive",
                title: "업로드 실패",
                description: "거래처 정보 업로드 중 오류가 발생했습니다.",
            });
        }
    };
    return (
        <div>
            <PageHeader title="거래처 관리" description="상품 및 자재를 공급하는 매입처 정보를 관리합니다.">
                 <div className="flex items-center gap-2">
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        거래처 추가
                    </Button>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        내보내기
                    </Button>
                    <ImportButton onImport={handleImport} />
                </div>
            </PageHeader>
            <Card className="mb-4">
                <CardHeader>
                    <CardTitle>거래처 목록</CardTitle>
                    <CardDescription>
                        유형별로 거래처를 검색하고 관리합니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative w-full sm:w-auto flex-1 sm:flex-initial">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="거래처명, 담당자명 검색..."
                                className="w-full rounded-lg bg-background pl-8"
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="거래처 유형" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">모든 유형</SelectItem>
                                {partnerTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
            {partnersLoading ? (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-2">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="flex items-center space-x-4 p-2">
                                    <Skeleton className="h-5 w-32" />
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-24" />
                                    <Skeleton className="h-5 w-48" />
                                    <Skeleton className="h-5 flex-1" />
                                    <Skeleton className="h-8 w-8" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <PartnerTable
                    partners={filteredPartners}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            )}
            <PartnerForm
                isOpen={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSubmit={handleFormSubmit}
                partner={selectedPartner}
            />
        </div>
    );
}
