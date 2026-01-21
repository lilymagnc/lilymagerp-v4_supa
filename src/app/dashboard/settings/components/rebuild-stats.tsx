"use client";
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Play } from "lucide-react";
import { supabase } from '@/lib/supabase';

export default function RebuildStats() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
    const { toast } = useToast();

    const handleRebuild = async () => {
        setLoading(true);
        setProgress({ current: 0, total: 0, status: 'fetching' });
        toast({ title: "작업 시작", description: "주문 데이터를 불러오고 있습니다..." });

        try {
            console.log("Fetching all orders from Supabase...");
            // 1. 모든 주문 가져오기
            const { data: orders, error: fetchError } = await supabase
                .from('orders')
                .select('*');

            if (fetchError) {
                console.error("Fetch error:", fetchError);
                throw fetchError;
            }

            if (!orders || orders.length === 0) {
                console.warn("No orders found.");
                toast({ title: "데이터 없음", description: "주문 데이터가 없습니다.", variant: "default" });
                setLoading(false);
                return;
            }

            console.log(`Fetched ${orders.length} orders.`);
            const totalOrders = orders.length;
            setProgress({ current: 0, total: totalOrders, status: 'computing' });

            // UI 업데이트를 위해 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 100));

            const dailyStats: { [key: string]: any } = {};

            orders.forEach((order) => {
                if (order.status === 'canceled') return;

                // 1. 매출(Revenue) 기준일: 주문 시점
                let orderDateStr = '';
                if (order.order_date) {
                    // order_date가 Timestamp string인 경우 처리
                    // e.g. "2026-01-10T04:50:30.171+00:00" -> "2026-01-10"
                    orderDateStr = new Date(order.order_date).toISOString().split('T')[0];
                }

                // 2. 정산(Settlement) 기준일: 결제 완료 시점 (없으면 주문일)
                let settlementDateStr = orderDateStr;
                const payment = order.payment || {};

                if (payment.completedAt) {
                    // completedAt이 Firestore Timestamp 형식({seconds, ...})일 수도 있고 문자열일 수도 있음
                    if (typeof payment.completedAt === 'string') {
                        settlementDateStr = new Date(payment.completedAt).toISOString().split('T')[0];
                    } else if (payment.completedAt.seconds) {
                        settlementDateStr = new Date(payment.completedAt.seconds * 1000).toISOString().split('T')[0];
                    }
                }

                const branchName = order.branch_name || "Unknown";
                const summary = order.summary || {};
                const revenue = summary.total || order.total || 0;
                const isSettled = payment.status === 'paid' || payment.status === 'completed';

                if (!orderDateStr) return; // 유효하지 않은 날짜 건너뛰기

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

            console.log("Stats computation complete.");

            // 2. 결과 저장
            const days = Object.keys(dailyStats);
            console.log(`Saving ${days.length} daily stats records...`);
            setProgress(prev => ({ ...prev, total: days.length, status: 'saving' }));

            const statsArray = days.map(dateStr => ({
                date: dailyStats[dateStr].date,
                total_revenue: dailyStats[dateStr].totalRevenue,
                total_order_count: dailyStats[dateStr].totalOrderCount,
                total_settled_amount: dailyStats[dateStr].totalSettledAmount,
                branches: dailyStats[dateStr].branches,
                last_updated: new Date().toISOString()
            }));

            const { error: upsertError } = await supabase
                .from('daily_stats')
                .upsert(statsArray);

            if (upsertError) {
                console.error("Upsert error:", upsertError);
                throw upsertError;
            }

            console.log("Save complete.");
            setProgress({ current: days.length, total: days.length, status: 'completed' });

            toast({
                title: "통계 재계산 완료",
                description: `${days.length}일간의 데이터가 성공적으로 집계되었습니다.`,
            });

        } catch (error: any) {
            console.error("Rebuild stats error:", error);
            toast({
                variant: "destructive",
                title: "오류 발생",
                description: `오류 상세보기: ${error.message || JSON.stringify(error)}`,
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
                    데이터 집계 최적화 (Supabase)
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
                                {progress.status === 'saving' && `집계 데이터 저장 중...`}
                                {progress.status === 'completed' && '재계산이 완료되었습니다!'}
                                {progress.status === 'error' && '작업 중 오류가 발생했습니다.'}
                            </span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${progress.status === 'error' ? 'bg-destructive' : 'bg-primary'
                                    }`}
                                style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                            />
                        </div>
                    </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                    <p>• 이 작업은 브라우저에서 실행되므로 완료될 때까지 창을 닫지 마세요.</p>
                    <p>• 데이터 양에 따라 시간이 소요될 수 있습니다.</p>
                </div>
            </CardContent>
        </Card>
    );
}
