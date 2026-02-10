
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
import { supabase } from '@/lib/supabase';
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

    const toLocalDate = (dateVal: any): Date => {
        if (!dateVal) return new Date();
        if (dateVal instanceof Date) return dateVal;
        if (typeof dateVal === 'string') return new Date(dateVal);
        if (dateVal && typeof dateVal === 'object' && dateVal.seconds) return new Date(dateVal.seconds * 1000);
        return new Date(dateVal);
    };

    useEffect(() => {
        async function fetchOrder() {
            if (!user) {
                setError('인증이 필요합니다.');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data, error: fetchError } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', orderId)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                if (data) {
                    const orderDateIso = toLocalDate(data.order_date).toISOString();

                    // Supabase returns snake_case, need to map to camelCase for the OrderType interface
                    // Alternatively, use the mapRowToOrder if available globally, but here we can manually map
                    const orderData: SerializableOrder = {
                        id: data.id,
                        branchId: data.branch_id,
                        branchName: data.branch_name,
                        orderNumber: data.order_number,
                        orderDate: orderDateIso,
                        status: data.status,
                        items: data.items || [],
                        summary: data.summary || {},
                        orderer: data.orderer || {},
                        isAnonymous: data.is_anonymous || false,
                        registerCustomer: data.register_customer || false,
                        orderType: data.order_type,
                        receiptType: data.receipt_type,
                        payment: data.payment || {},
                        pickupInfo: data.pickup_info,
                        deliveryInfo: data.delivery_info,
                        message: (() => {
                            const msg = (data.message && Object.keys(data.message).length > 0) ? data.message : (data.extra_data?.message || {});
                            // Normalize legacy ribbon formats if content is missing or check for ribbon fields
                            if ((msg.type === 'ribbon') || msg.ribbon_left || msg.ribbon_right || msg.start || msg.end) {
                                if (msg.type !== 'ribbon') msg.type = 'ribbon';

                                if (!msg.content) {
                                    if (msg.ribbon_left || msg.ribbon_right) {
                                        msg.content = `${msg.ribbon_right || ''} / ${msg.ribbon_left || ''}`;
                                    } else if (msg.start || msg.end) {
                                        msg.content = `${msg.end || ''} / ${msg.start || ''}`;
                                    }
                                }
                            }
                            // Also check if sender is separate and content doesn't verify it
                            if (msg.sender && msg.content && !msg.content.includes(msg.sender)) {
                                msg.content = `${msg.content} / ${msg.sender}`;
                            }
                            return msg;
                        })(),
                        request: data.request || '',
                        transferInfo: data.transfer_info,
                        outsourceInfo: data.outsource_info
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

    const targetBranch = branches.find(b => b.id === order.branchId) || branches.find(b => b.name === order.branchName);
    const itemsText = order.items.map(item => `${item.name} / ${item.quantity}개`).join('\n');
    const orderDateObject = new Date(order.orderDate);
    const printData: OrderPrintData | null = {
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
        message: (order.message?.content ?? '').replace(/\n---\n/g, ' / '),
        messageType: (order.message?.type === 'ribbon' ? 'ribbon' : 'card'), // 메시지 타입 추가
        isAnonymous: order.isAnonymous || false,
        branchInfo: {
            name: targetBranch?.name || order.branchName || '알 수 없는 지점',
            address: targetBranch?.address || '',
            contact: targetBranch?.phone || '',
            account: targetBranch?.account || '',
        },
        transferInfo: order.transferInfo && order.transferInfo.isTransferred ? {
            originalBranchName: order.transferInfo.originalBranchName || '',
            processBranchName: order.transferInfo.processBranchName || ''
        } : undefined,
        outsourceInfo: order.outsourceInfo && order.outsourceInfo.isOutsourced ? {
            partnerName: order.outsourceInfo.partnerName || '',
            partnerPrice: order.outsourceInfo.partnerPrice || 0
        } : undefined
    };

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
