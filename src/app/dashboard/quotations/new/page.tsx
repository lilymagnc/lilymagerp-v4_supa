"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { QuotationForm } from "../components/quotation-form";
import { useQuotations } from "@/hooks/use-quotations";
import { Quotation } from "@/types/quotation";
import { PrintableQuotation } from "../components/printable-quotation";

export default function NewQuotationPage() {
    const router = useRouter();
    const { addQuotation } = useQuotations();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewData, setPreviewData] = useState<Omit<Quotation, 'id'> | null>(null);

    const handleSubmit = async (data: Omit<Quotation, 'id'>) => {
        setIsSubmitting(true);
        try {
            const id = await addQuotation(data);
            router.push(`/dashboard/quotations/${id}`);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <PageHeader title="견적서 작성" description="새로운 견적서를 작성합니다." />

            <div className="grid gap-8 xl:grid-cols-2">
                <div className="xl:col-span-1">
                    <QuotationForm
                        onSubmit={handleSubmit}
                        onDataChange={setPreviewData}
                        isSubmitting={isSubmitting}
                    />
                </div>
                <div className="xl:col-span-1">
                    <div className="sticky top-6 border rounded-lg overflow-hidden shadow-lg bg-white">
                        <div className="p-4 bg-muted border-b text-sm font-medium text-center">
                            인쇄 미리보기
                        </div>
                        <div className="overflow-auto max-h-[800px]">
                            {previewData ? (
                                <PrintableQuotation data={previewData as Quotation} />
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    정보를 입력하면 미리보기가 표시됩니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
