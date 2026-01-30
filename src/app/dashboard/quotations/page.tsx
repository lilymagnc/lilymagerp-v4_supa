"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PlusCircle, Search, FileText, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuotations } from "@/hooks/use-quotations";
import { format } from "date-fns";

export default function QuotationsPage() {
    const router = useRouter();
    const { quotations, loading, deleteQuotation } = useQuotations();
    const [searchTerm, setSearchTerm] = useState("");

    const filteredQuotations = quotations.filter(q =>
        (q.customer?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.quotationNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft': return <Badge variant="outline">초안</Badge>;
            case 'sent': return <Badge variant="secondary">발송됨</Badge>;
            case 'accepted': return <Badge variant="default">승인됨</Badge>;
            case 'rejected': return <Badge variant="destructive">거절됨</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const formatDate = (date: any) => {
        if (!date) return "-";
        return format(new Date(date), "yyyy-MM-dd");
    };

    const getDocTypeBadge = (type: string) => {
        switch (type) {
            case 'receipt': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">간이영수증</Badge>;
            case 'statement': return <Badge variant="secondary" className="bg-purple-100 text-purple-800">거래명세서</Badge>;
            default: return <Badge variant="secondary" className="bg-slate-100 text-slate-800">견적서</Badge>;
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("정말로 이 문서를 삭제하시겠습니까?")) {
            await deleteQuotation(id);
        }
    };

    return (
        <div>
            <PageHeader title="거래 문서 관리" description="견적서, 간이영수증, 거래명세서를 작성하고 관리합니다.">
                <Button onClick={() => router.push('/dashboard/quotations/new')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    문서 작성
                </Button>
            </PageHeader>

            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="고객명, 문서 번호 검색..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>종류</TableHead>
                                <TableHead>문서 번호</TableHead>
                                <TableHead>지점</TableHead>
                                <TableHead>고객명</TableHead>
                                <TableHead>작성일</TableHead>
                                <TableHead>유효기간</TableHead>
                                <TableHead className="text-right">합계금액</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredQuotations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                        등록된 문서가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredQuotations.map((quotation) => (
                                    <TableRow key={quotation.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/dashboard/quotations/${quotation.id}`)}>
                                        <TableCell>{getDocTypeBadge(quotation.type || 'quotation')}</TableCell>
                                        <TableCell className="font-medium">{quotation.quotationNumber}</TableCell>
                                        <TableCell>{quotation.branchName}</TableCell>
                                        <TableCell>{quotation.customer.name}</TableCell>
                                        <TableCell>{formatDate(quotation.createdAt)}</TableCell>
                                        <TableCell>{formatDate(quotation.validUntil)}</TableCell>
                                        <TableCell className="text-right">{quotation.summary.totalAmount.toLocaleString()}원</TableCell>
                                        <TableCell>{getStatusBadge(quotation.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="sm" onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/dashboard/quotations/${quotation.id}`);
                                                }}>
                                                    <FileText className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(quotation.id);
                                                }}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
