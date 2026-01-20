"use client";

import { Suspense, useEffect, useState } from 'react';
import { getItemData } from "@/lib/data-fetch";
import type { LabelItemData } from "./components/label-item";
import { PrintLayout } from "./components/print-layout";
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useSearchParams } from 'next/navigation';

export default function PrintLabelsPage() {
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();
    const [labels, setLabels] = useState<(LabelItemData | null)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const type = searchParams.get('type') as 'product' | 'material';
    const startPosition = parseInt(searchParams.get('start') || '1');
    const itemsParam = searchParams.get('items');
    const idsParam = searchParams.get('ids');
    const quantity = parseInt(searchParams.get('quantity') || '1');

    useEffect(() => {
        const fetchLabels = async () => {
            if (!user && !loading) {
                setError('로그인이 필요합니다.');
                setIsLoading(false);
                return;
            }

            if (user) {
                try {
                    let labelsToPrint: LabelItemData[] = [];
                    
                    if (itemsParam) {
                        const itemRequests = itemsParam.split(',').map(item => {
                            const [id, quantity] = item.split(':');
                            return { id, quantity: parseInt(quantity) || 1 };
                        });
                        const fetchedItems = await Promise.all(itemRequests.map(async req => {
                            const itemData = await getItemData(req.id, type);
                            return { ...itemData, quantity: req.quantity } as LabelItemData & { quantity: number };
                        }));
                        fetchedItems.forEach(item => {
                            if(item.id) {
                                for (let i = 0; i < item.quantity; i++) {
                                    labelsToPrint.push({ id: item.id, name: item.name });
                                }
                            }
                        });
                    } else if (idsParam) {
                        const ids = Array.isArray(idsParam) ? idsParam : idsParam.split(',').filter(id => id);
                        if (ids.length > 0) {
                            const fetchedItems = await Promise.all(ids.map(id => getItemData(id, type)));
                            const validItems = fetchedItems.filter((item): item is LabelItemData => item !== null);
                            if (validItems.length === 1 && quantity > 1) {
                                const singleItem = validItems[0];
                                for (let i = 0; i < quantity; i++) {
                                    labelsToPrint.push(singleItem);
                                }
                            } else {
                                labelsToPrint.push(...validItems);
                            }
                        }
                    }

                    const finalLabels: (LabelItemData | null)[] = Array(24).fill(null);
                    if (labelsToPrint.length > 0) {
                        let currentPos = startPosition - 1;
                        for(const item of labelsToPrint) {
                            if(currentPos < 24) {
                                finalLabels[currentPos] = item;
                                currentPos++;
                            }
                        }
                    }
                    
                    setLabels(finalLabels);
                } catch (err) {
                    setError('라벨 데이터를 가져오는 중 오류가 발생했습니다.');
                    console.error('Error fetching labels:', err);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        if (type) {
            fetchLabels();
        }
    }, [type, startPosition, itemsParam, idsParam, quantity, user, loading]);

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

    return (
        <Suspense fallback={<div className="max-w-4xl mx-auto p-6"><Skeleton className="h-96 w-full" /></div>}>
            <PrintLayout labels={labels} />
        </Suspense>
    );
}
