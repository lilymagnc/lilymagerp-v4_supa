
"use client";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { PrintableOrder, OrderPrintData } from '@/app/dashboard/orders/new/components/printable-order';
import { useBranches } from '@/hooks/use-branches';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Order as OrderType } from '@/hooks/use-orders';

// Define the type for serializable order data
export interface SerializableOrder extends Omit<OrderType, 'orderDate' | 'id'> {
    id: string;
    orderDate: string; // ISO string format
}

interface PrintPreviewClientProps {
    orderId: string;
}

export function PrintPreviewClient({ orderId }: PrintPreviewClientProps) {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { branches, loading: branchesLoading } = useBranches();
    const [order, setOrder] = useState<SerializableOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchOrder() {
            if (!user) {
                setError('인증이 필요합니다.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const docRef = doc(db, 'orders', orderId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    let orderDateIso = new Date().toISOString();
                    if (data.orderDate && typeof (data.orderDate as Timestamp).toDate === 'function') {
                        orderDateIso = (data.orderDate as Timestamp).toDate().toISOString();
                    }
                    const orderBase = data as Omit<OrderType, 'id' | 'orderDate'>;
                    const orderData: SerializableOrder = {
                        ...orderBase,
                        id: docSnap.id,
                        orderDate: orderDateIso,
                    };
                    setOrder(orderData);
                } else {
                    setError('주문을 찾을 수 없습니다.');
                }
            } catch (error) {
                console.error("Error fetching document:", error);
                setError('주문 데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        }

        if (!authLoading) {
            fetchOrder();
        }
    }, [orderId, user, authLoading]);

    if (authLoading || loading || branchesLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-2">데이터를 불러오는 중입니다...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <Button onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        목록으로 돌아가기
                    </Button>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <p>주문 데이터를 찾을 수 없습니다.</p>
            </div>
        );
    }

    const targetBranch = branches.find(b => b.id === order.branchId);
    const itemsText = order.items.map(item => `${item.name} / ${item.quantity}개`).join('\n');
    const orderDateObject = new Date(order.orderDate);
    const printData: OrderPrintData | null = targetBranch ? {
        orderDate: format(orderDateObject, "yyyy-MM-dd HH:mm (E)", { locale: ko }),
        ordererName: order.orderer.name,
        ordererContact: order.orderer.contact,
        items: itemsText,
        totalAmount: order.summary.total,
        deliveryFee: order.summary.deliveryFee,
        paymentMethod: order.payment.method,
        paymentStatus: order.payment.status === 'paid' ? '완결' : '미결',
        deliveryDate: order.deliveryInfo?.date ? (() => {
            const deliveryDateObject = new Date(order.deliveryInfo.date + ' ' + (order.deliveryInfo.time || '00:00'));
            return `${order.deliveryInfo.date} ${order.deliveryInfo.time} (${format(deliveryDateObject, 'E', { locale: ko })})`;
        })() : '정보 없음',
        recipientName: order.deliveryInfo?.recipientName ?? '',
        recipientContact: order.deliveryInfo?.recipientContact ?? '',
        deliveryAddress: order.deliveryInfo?.address ?? '',
        message: order.message?.content ?? '',
        messageType: order.message?.type ?? 'card', // 메시지 타입 추가
        isAnonymous: order.isAnonymous || false,
        branchInfo: {
            name: targetBranch.name,
            address: targetBranch.address,
            contact: targetBranch.phone,
            account: targetBranch.account || '',
        },
        transferInfo: order.transferInfo && order.transferInfo.isTransferred ? {
            originalBranchName: order.transferInfo.originalBranchName || '',
            processBranchName: order.transferInfo.processBranchName || ''
        } : undefined,
        outsourceInfo: order.outsourceInfo && order.outsourceInfo.isOutsourced ? {
            partnerName: order.outsourceInfo.partnerName || '',
            partnerPrice: order.outsourceInfo.partnerPrice || 0
        } : undefined
    } : null;

    return (
        <div>
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body * {
                       visibility: hidden;
                    }
                    #printable-area, #printable-area * {
                        visibility: visible;
                    }
                    #printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                         /* Allow natural height to avoid content/logo squashing */
                         height: auto;
                    }
                }
             `}</style>
            <div className="max-w-4xl mx-auto no-print">
                <PageHeader
                    title="주문서 인쇄 미리보기"
                    description={`주문 ID: ${order.id}`}
                >
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.back()}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            목록으로 돌아가기
                        </Button>
                        <Button onClick={() => window.print()} disabled={!printData}>
                            <Printer className="mr-2 h-4 w-4" />
                            인쇄하기
                        </Button>
                    </div>
                </PageHeader>
            </div>
            <div id="printable-area">
                <Card className="shadow-sm print:shadow-none print:border-none max-w-4xl mx-auto">
                    <CardContent className="p-0">
                        {printData ? <PrintableOrder data={printData} /> : <p>주문 데이터를 불러오는 중입니다...</p>}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
