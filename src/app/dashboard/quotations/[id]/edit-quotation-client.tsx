"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { QuotationForm } from "../components/quotation-form";
import { useQuotations } from "@/hooks/use-quotations";
import { Quotation } from "@/types/quotation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintableQuotation } from "../components/printable-quotation";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface EditQuotationClientProps {
    id: string;
}

export function EditQuotationClient({ id }: EditQuotationClientProps) {
    const router = useRouter();
    const { updateQuotation } = useQuotations();
    const [quotation, setQuotation] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchQuotation = async () => {
            try {
                const docRef = doc(db, 'quotations', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setQuotation({ id: docSnap.id, ...docSnap.data() } as Quotation);
                } else {
                    router.push('/dashboard/quotations');
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchQuotation();
    }, [id, router]);

    const handleSubmit = async (data: Omit<Quotation, 'id'>) => {
        setIsSubmitting(true);
        try {
            await updateQuotation(id, data);
            // Refresh local state
            setQuotation({ ...data, id: id } as Quotation);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-[500px] w-full" /></div>;
    }

    if (!quotation) return null;

    return (
        <div>
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    /* Hide everything by default */
                    body * {
                        visibility: hidden;
                    }
                    /* Show only the printable area and its children */
                    #printable-quotation-area,
                    #printable-quotation-area * {
                        visibility: visible;
                    }
                    /* Position the printable area */
                    #printable-quotation-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `}</style>
            <div className="print:hidden">
                <PageHeader title="견적서 수정" description="견적서 내용을 수정합니다.">
                    <Button onClick={handlePrint} variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        인쇄 / PDF 저장
                    </Button>
                </PageHeader>
            </div>

            <div className="grid gap-8 xl:grid-cols-2 print:block">
                <div className="xl:col-span-1 print:hidden">
                    <QuotationForm initialData={quotation} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
                </div>
                <div className="xl:col-span-1 print:col-span-full">
                    <div className="sticky top-6 border rounded-lg overflow-hidden shadow-lg bg-white print:static print:border-none print:shadow-none">
                        <div className="p-4 bg-muted border-b text-sm font-medium text-center print:hidden">
                            인쇄 미리보기
                        </div>
                        <div className="overflow-auto max-h-[800px] print:overflow-visible print:max-h-none">
                            <div id="printable-quotation-area">
                                <PrintableQuotation data={quotation} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
