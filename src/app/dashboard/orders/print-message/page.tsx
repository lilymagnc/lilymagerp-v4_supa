"use client";

import { Suspense, useEffect, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { MessagePrintLayout } from './components/message-print-layout';
import type { Order as OrderType } from '@/hooks/use-orders';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams } from 'next/navigation';

export interface SerializableOrder extends Omit<OrderType, 'orderDate' | 'id'> {
  id: string;
  orderDate: string; // ISO string format
}

async function getOrder(orderId: string): Promise<SerializableOrder | null> {
    try {
        const docRef = doc(db, 'orders', orderId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            let orderDateIso = new Date().toISOString();
            if (data.orderDate && typeof (data.orderDate as Timestamp).toDate === 'function') {
                orderDateIso = (data.orderDate as Timestamp).toDate().toISOString();
            }
            const orderBase = data as Omit<OrderType, 'id' | 'orderDate'>;
            return {
                ...orderBase,
                id: docSnap.id,
                orderDate: orderDateIso,
            };
        } else {
            console.error("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error fetching document:", error);
        return null;
    }
}



export default function PrintMessagePage() {
    const { user, loading } = useAuth();
    const searchParams = useSearchParams();
    const [orderData, setOrderData] = useState<SerializableOrder | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const orderId = searchParams.get('orderId') || '';
    const labelType = searchParams.get('labelType') || 'formtec-3108';
    const startPosition = parseInt(searchParams.get('start') || '1');
    const messageFont = searchParams.get('messageFont') || 'Noto Sans KR';
    const messageFontSize = parseInt(searchParams.get('messageFontSize') || '14');
    const senderFont = searchParams.get('senderFont') || 'Noto Sans KR';
    const senderFontSize = parseInt(searchParams.get('senderFontSize') || '12');
    const messageContent = searchParams.get('messageContent') || '';
    const senderName = searchParams.get('senderName') || '';
    const positionsParam = searchParams.get('positions') || '';
    const selectedPositions = positionsParam ? positionsParam.split(',').map(p => parseInt(p)).filter(p => !isNaN(p)) : [startPosition];

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) {
                setError('주문 ID가 필요합니다.');
                setIsLoading(false);
                return;
            }

            if (!user && !loading) {
                setError('로그인이 필요합니다.');
                setIsLoading(false);
                return;
            }

            if (user) {
                try {
                    const data = await getOrder(orderId);
                    if (data) {
                        setOrderData(data);
                    } else {
                        setError('주문을 찾을 수 없습니다.');
                    }
                } catch (err) {
                    setError('주문 데이터를 가져오는 중 오류가 발생했습니다.');
                    console.error('Error fetching order:', err);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        if (orderId) {
            fetchOrder();
        }
    }, [orderId, user, loading]);

    // 로딩 중이거나 인증 대기 중
    if (loading || isLoading) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <Skeleton className="h-96 w-full"/>
            </div>
        );
    }

    // 에러 발생
    if (error) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">오류 발생</h2>
                    <p className="text-gray-600">{error}</p>
                </div>
            </div>
        );
    }

    // 주문 데이터가 없음
    if (!orderData) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-600 mb-4">주문을 찾을 수 없습니다</h2>
                    <p className="text-gray-500">요청하신 주문 정보가 존재하지 않습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <Suspense fallback={<div className="max-w-4xl mx-auto p-6"><Skeleton className="h-96 w-full"/></div>}>
            <MessagePrintLayout
                order={orderData}
                labelType={labelType}
                startPosition={startPosition}
                messageFont={messageFont}
                messageFontSize={messageFontSize}
                senderFont={senderFont}
                senderFontSize={senderFontSize}
                messageContent={messageContent}
                senderName={senderName}
                selectedPositions={selectedPositions}
            />
        </Suspense>
    );
}
