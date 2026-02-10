"use client";
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Play, Database } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { parseDate } from '@/lib/date-utils';
import { isSettled, isCanceled } from '@/lib/order-utils';
import { sanitizeBranchKey } from '@/lib/stats-utils';

export default function RebuildStats() {
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
    const { toast } = useToast();

    const handleRebuild = async () => {
        setLoading(true);
        // Start with 'fetching' status
        setProgress({ current: 0, total: 100, status: 'fetching' });
        toast({ title: "작업 시작", description: "서버에서 통계 데이터를 재계산하고 있습니다..." });

        try {
            // [1차 시도] 서버 사이드 계산 (SQL RPC) - 가장 빠르고 정확함
            const { error: rpcError } = await supabase.rpc('rebuild_daily_stats');

            if (!rpcError) {
                setProgress({ current: 100, total: 100, status: 'completed' });
                toast({
                    title: "통계 재계산 완료",
                    description: "서버에서 모든 데이터가 성공적으로 처리되었습니다.",
                });
                setLoading(false);
                return;
            }

            console.warn("RPC failed, falling back to client-side batch processing:", rpcError);
            toast({
                title: "서버 처리 실패, 클라이언트 처리 전환",
                description: "브라우저에서 직접 계산을 시작합니다. 잠시만 기다려주세요.",
            });

            // [2차 시도] 클라이언트 사이드 배치 처리 (Fallback)
            console.log("Starting optimized batch processing...");

            // [성능 개선] 필요한 컬럼만 선택하여 데이터 전송량 최소화
            const SELECTED_COLUMNS = 'id, order_date, created_at, payment, summary, status, branch_name, completed_at, updated_at';

            const dailyStats: { [key: string]: any } = {};
            let processedCount = 0;
            let lastId = '';
            let hasMore = true;
            const PAGE_SIZE = 1000;
            setProgress({ current: 0, total: 0, status: 'fetching' });

            while (hasMore) {
                let query = supabase
                    .from('orders')
                    .select(SELECTED_COLUMNS)
                    .order('id', { ascending: true })
                    .limit(PAGE_SIZE);

                if (lastId) {
                    query = query.gt('id', lastId);
                }

                const { data, error: fetchError } = await query;

                if (fetchError) {
                    console.error("Fetch error:", fetchError);
                    throw fetchError;
                }

                if (!data || data.length === 0) {
                    hasMore = false;
                    break;
                }

                const batchOrders = data;
                lastId = batchOrders[batchOrders.length - 1].id;

                if (batchOrders.length < PAGE_SIZE) {
                    hasMore = false;
                }

                batchOrders.forEach((order) => {
                    if (!order || isCanceled(order)) return;

                    const parsedOrderDate = parseDate(order.order_date || order.created_at);
                    if (!parsedOrderDate) return;

                    const orderDateStr = format(parsedOrderDate, 'yyyy-MM-dd');

                    const payment = order.payment || {};
                    const parsedPaymentDate = parseDate(payment.completedAt || (order as any).completed_at || order.order_date);
                    const settlementDateStr = parsedPaymentDate ? format(parsedPaymentDate, 'yyyy-MM-dd') : orderDateStr;

                    const branchName = order.branch_name || (order as any).branchName || "Unknown";
                    const branchKey = sanitizeBranchKey(branchName);

                    const summary = order.summary || {};
                    const revenue = Number(summary.total || (order as any).total || summary.total_amount || (order as any).amount || 0);

                    const paymentStatus = (order.payment?.status || '').toLowerCase();
                    const settled = (paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === '결제완료') && !isCanceled(order);

                    // --- 집계 로직 ---
                    if (!dailyStats[orderDateStr]) {
                        dailyStats[orderDateStr] = { date: orderDateStr, totalRevenue: 0, totalOrderCount: 0, totalSettledAmount: 0, branches: {} };
                    }
                    dailyStats[orderDateStr].totalRevenue += revenue;
                    dailyStats[orderDateStr].totalOrderCount += 1;

                    if (!dailyStats[orderDateStr].branches[branchKey]) {
                        dailyStats[orderDateStr].branches[branchKey] = { revenue: 0, orderCount: 0, settledAmount: 0 };
                    }
                    dailyStats[orderDateStr].branches[branchKey].revenue += revenue;
                    dailyStats[orderDateStr].branches[branchKey].orderCount += 1;

                    if (settled) {
                        if (!dailyStats[settlementDateStr]) {
                            dailyStats[settlementDateStr] = { date: settlementDateStr, totalRevenue: 0, totalOrderCount: 0, totalSettledAmount: 0, branches: {} };
                        }

                        dailyStats[settlementDateStr].totalSettledAmount += revenue;

                        if (!dailyStats[settlementDateStr].branches[branchKey]) {
                            dailyStats[settlementDateStr].branches[branchKey] = { revenue: 0, orderCount: 0, settledAmount: 0 };
                        }
                        dailyStats[settlementDateStr].branches[branchKey].settledAmount += revenue;
                    }
                });

                processedCount += batchOrders.length;
                setProgress(prev => ({ ...prev, current: processedCount, total: processedCount + (hasMore ? 1000 : 0), status: 'computing' }));
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            if (processedCount === 0) {
                toast({ title: "데이터 없음", description: "주문 데이터가 없습니다." });
                setLoading(false);
                return;
            }

            const processedDays = Object.keys(dailyStats);
            setProgress(prev => ({ ...prev, total: processedDays.length, status: 'saving' }));

            const statsArray = processedDays.map(dateStr => ({
                date: dailyStats[dateStr].date,
                total_revenue: dailyStats[dateStr].totalRevenue,
                total_order_count: dailyStats[dateStr].totalOrderCount,
                total_settled_amount: dailyStats[dateStr].totalSettledAmount,
                branches: dailyStats[dateStr].branches,
                last_updated: new Date().toISOString()
            }));

            const BATCH_SAVE_SIZE = 50;
            for (let i = 0; i < statsArray.length; i += BATCH_SAVE_SIZE) {
                const chunk = statsArray.slice(i, i + BATCH_SAVE_SIZE);
                const { error: upsertError } = await supabase
                    .from('daily_stats')
                    .upsert(chunk as any, { onConflict: 'date' });

                if (upsertError) throw upsertError;
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            setProgress({ current: processedDays.length, total: processedDays.length, status: 'completed' });
            toast({
                title: "통계 재계산 완료",
                description: `${processedDays.length}일간의 데이터가 성공적으로 집계되었습니다.`,
            });

        } catch (error: any) {
            console.error("Rebuild stats error:", error);
            toast({
                variant: "destructive",
                title: "오류 발생",
                description: error.message || "작업 중 오류가 발생했습니다.",
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
