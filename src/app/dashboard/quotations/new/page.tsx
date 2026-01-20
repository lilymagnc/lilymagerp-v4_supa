"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { QuotationForm } from "../components/quotation-form";
import { useQuotations } from "@/hooks/use-quotations";
import { Quotation } from "@/types/quotation";

export default function NewQuotationPage() {
    const router = useRouter();
    const { addQuotation } = useQuotations();
    const [isSubmitting, setIsSubmitting] = useState(false);

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
            <QuotationForm onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
    );
}
