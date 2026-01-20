"use client";
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { db } from '@/lib/firebase';
import {
    collection,
    getDocs,
    setDoc,
    doc,
    Timestamp,
    query,
    orderBy
} from 'firebase/firestore';

export default function RebuildStats() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
    const { toast } = useToast();

    const handleRebuild = async () => {
        if (!confirm("모든 주문 데이터를 분석하여 일별 통계를 다시 계산하시겠습니까? 데이터 양에 따라 시간이 걸릴 수 있습니다.")) {
            return;
        }

        setLoading(true);
        setProgress({ current: 0, total: 0, status: 'fetching' });

        try {
            // 1. 모든 주문 가져오기
            const ordersSnapshot = await getDocs(collection(db, "orders"));
            const totalOrders = ordersSnapshot.docs.length;
            setProgress({ current: 0, total: totalOrders, status: 'computing' });

            const dailyStats = {};

            ordersSnapshot.docs.forEach((orderDoc) => {
                const data = orderDoc.data();
                if (data.status === 'canceled') return;

                // 1. 매출(Revenue) 기준일: 주문 시점
                let orderDate;
                if (data.orderDate instanceof Timestamp) {
                    orderDate = data.orderDate.toDate();
                } else if (data.orderDate && data.orderDate.seconds) {
                    orderDate = new Timestamp(data.orderDate.seconds, data.orderDate.nanoseconds).toDate();
                } else {
                    orderDate = new Date(data.orderDate);
                }
                const orderDateStr = orderDate.toISOString().split('T')[0];

                // 2. 정산(Settlement) 기준일: 결제 완료 시점 (없으면 주문일)
                let settlementDate = orderDate;
                if (data.payment?.completedAt) {
                    if (data.payment.completedAt instanceof Timestamp) {
                        settlementDate = data.payment.completedAt.toDate();
                    } else if (data.payment.completedAt.seconds) {
                        settlementDate = new Timestamp(data.payment.completedAt.seconds, data.payment.completedAt.nanoseconds).toDate();
                    } else {
                        settlementDate = new Date(data.payment.completedAt);
                    }
                }
                const settlementDateStr = settlementDate.toISOString().split('T')[0];

                const branchName = data.branchName || "Unknown";
                const revenue = data.summary?.total || data.total || 0;
                const isSettled = data.payment?.status === 'paid' || data.payment?.status === 'completed';

                // 매출/주문수 카운트 (주문일 기준)
                if (!dailyStats[orderDateStr]) {
                    dailyStats[orderDateStr] = {
                        date: orderDateStr,
                        totalRevenue: 0,
                        totalOrderCount: 0,
                        totalSettledAmount: 0,
                        branches: {}
                    };
                }
                dailyStats[orderDateStr].totalRevenue += revenue;
                dailyStats[orderDateStr].totalOrderCount += 1;

                const branchKey = branchName.replace(/\./g, '_');
                if (!dailyStats[orderDateStr].branches[branchKey]) {
                    dailyStats[orderDateStr].branches[branchKey] = { revenue: 0, orderCount: 0, settledAmount: 0 };
                }
                dailyStats[orderDateStr].branches[branchKey].revenue += revenue;
                dailyStats[orderDateStr].branches[branchKey].orderCount += 1;

                // 정산액 카운트 (결제완료일 기준)
                if (isSettled) {
                    if (!dailyStats[settlementDateStr]) {
                        dailyStats[settlementDateStr] = {
                            date: settlementDateStr,
                            totalRevenue: 0,
                            totalOrderCount: 0,
                            totalSettledAmount: 0,
                            branches: {}
                        };
                    }
                    dailyStats[settlementDateStr].totalSettledAmount += revenue;

                    if (!dailyStats[settlementDateStr].branches[branchKey]) {
                        dailyStats[settlementDateStr].branches[branchKey] = { revenue: 0, orderCount: 0, settledAmount: 0 };
                    }
                    dailyStats[settlementDateStr].branches[branchKey].settledAmount += revenue;
                }
            });

            // 2. 결과 저장
            const days = Object.keys(dailyStats);
            setProgress(prev => ({ ...prev, total: days.length, status: 'saving' }));

            for (let i = 0; i < days.length; i++) {
                const dateStr = days[i];
                const stats = dailyStats[dateStr];
                stats.lastUpdated = Timestamp.now();
                await setDoc(doc(db, "dailyStats", dateStr), stats);
                setProgress(prev => ({ ...prev, current: i + 1 }));
            }

            toast({
                title: "통계 재계산 완료",
                description: `${days.length}일간의 데이터가 집계되었습니다.`,
            });
            setProgress({ current: days.length, total: days.length, status: 'completed' });
        } catch (error) {
            console.error("Rebuild stats error:", error);
            toast({
                variant: "destructive",
                title: "오류 발생",
                description: "통계 재계산 중 오류가 발생했습니다.",
            });
            setProgress(prev => ({ ...prev, status: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    데이터 집계 최적화 (dailyStats)
                </CardTitle>
                <CardDescription>
                    주문 데이터를 미리 집계하여 대시보드 로딩 속도를 획기적으로 향상시킵니다.
                    최초 1회 실행이 필요하며, 이후에는 주문 시 자동으로 업데이트됩니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                        <h4 className="font-medium">기존 주문 데이터 재집계</h4>
                        <p className="text-sm text-muted-foreground">
                            모든 주문 기록을 분석하여 일별 통계 데이터를 생성합니다.
                        </p>
                    </div>
                    <Button
                        onClick={handleRebuild}
                        disabled={loading}
                        className="min-w-[120px]"
                    >
                        {loading ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                처리 중...
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4" />
                                지금 실행
                            </>
                        )}
                    </Button>
                </div>

                {progress.status !== 'idle' && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>
                                {progress.status === 'fetching' && '주문 데이터 가져오는 중...'}
                                {progress.status === 'computing' && '통계 계산 중...'}
                                {progress.status === 'saving' && `집계 데이터 저장 중 (${progress.current}/${progress.total})`}
                                {progress.status === 'completed' && '재계산이 완료되었습니다!'}
                                {progress.status === 'error' && '작업 중 오류가 발생했습니다.'}
                            </span>
                            <span>{Math.round((progress.current / progress.total) * 100) || 0}%</span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${progress.status === 'error' ? 'bg-destructive' : 'bg-primary'
                                    }`}
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                    <p>• 이 작업은 브라우저에서 실행되므로 완료될 때까지 창을 닫지 마세요.</p>
                    <p>• 데이터 양에 따라 Firebase 할당량이 소모될 수 있습니다.</p>
                    <p>• 집계가 완료되면 대시보드 차트 로딩 속도가 빨라집니다.</p>
                </div>
            </CardContent>
        </Card>
    );
}
