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
    const [syncLoading, setSyncLoading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
    const [syncProgress, setSyncProgress] = useState({ collection: '', total: 0, synced: 0, errors: 0 });
    const { toast } = useToast();

    const handleRebuild = async () => {
        setLoading(true);
        // Start with 'fetching' status
        setProgress({ current: 0, total: 100, status: 'fetching' });
        toast({ title: "작업 시작", description: "서버에서 통계 데이터를 재계산하고 있습니다..." });

        try {
            // [1차 시도] 서버 사이드 계산 (SQL RPC) - 가장 빠르고 정확함
            console.log("Attempting server-side rebuild (RPC)...");
            const { error: rpcError } = await supabase.rpc('rebuild_daily_stats');

            if (!rpcError) {
                console.log("Server-side rebuild complete.");
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
            // 'total', 'amount' 컬럼은 실제 테이블에 없고 summary JSON에 포함되어 있을 수 있으므로 제거함
            const SELECTED_COLUMNS = 'id, order_date, created_at, payment, summary, status, branch_name, completed_at, updated_at';

            const dailyStats: { [key: string]: any } = {};
            let processedCount = 0;
            let lastId = '';
            let hasMore = true;
            const PAGE_SIZE = 1000;
            // 첫 번째 요청 전에 total count를 알 수 없으므로, 일단 fetching 상태로 시작
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

                // [성능 개선] 메모리에 쌓지 않고 즉시 처리 (Batch Processing)
                const batchOrders = data;
                lastId = batchOrders[batchOrders.length - 1].id;

                if (batchOrders.length < PAGE_SIZE) {
                    hasMore = false;
                }

                batchOrders.forEach((order) => {
                    // 취소된 주문은 집계에서 제외
                    if (!order || isCanceled(order)) return;

                    // 1. 주문 날짜 (매출 기준일)
                    const parsedOrderDate = parseDate(order.order_date || order.created_at);
                    if (!parsedOrderDate) return;

                    const orderDateStr = format(parsedOrderDate, 'yyyy-MM-dd');

                    // 2. 결제 날짜 (정산 기준일)
                    // [수정] 사용자 요청 반영: "예약된 금액을 오늘 결제하면 금일 매출(정산)이어야 함"
                    // 따라서 무조건 orderDateStr로 고정하지 않고, 실 결제일(completedAt)이 있으면 그것을 따릅니다.
                    // 단, 데이터 이관 등으로 인한 updated_at은 절대 사용하지 않습니다. (과거 데이터가 오늘 날짜로 튀는 원인 차단)
                    const payment = order.payment || {};
                    const parsedPaymentDate = parseDate(payment.completedAt || (order as any).completed_at || order.order_date);
                    const settlementDateStr = parsedPaymentDate ? format(parsedPaymentDate, 'yyyy-MM-dd') : orderDateStr;

                    // 3. 지점명 처리
                    // Supabase 컬럼명은 snake_case가 기본이나, legacy 데이터는 camelCase일 수 있음
                    const branchName = order.branch_name || (order as any).branchName || "Unknown";
                    const branchKey = sanitizeBranchKey(branchName);

                    // 4. 금액 추출
                    const summary = order.summary || {};
                    const revenue = Number(summary.total || (order as any).total || summary.total_amount || (order as any).amount || 0);

                    // 5. 결제/정산 완료 여부 판정 (엄격한 기준 적용)
                    const paymentStatus = (order.payment?.status || '').toLowerCase();
                    const settled = (paymentStatus === 'paid' || paymentStatus === 'completed' || paymentStatus === '결제완료') && !isCanceled(order);

                    // --- 집계 로직 ---

                    // A. 주문일 기준 매출/건수 (Daily Sales)
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

                    // B. 정산 매출 (Settled Amount) - settled 상태일 때만
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

                // 진행상황 업데이트 (total은 정확하지 않지만 increasing number로 표시)
                setProgress(prev => ({ ...prev, current: processedCount, total: processedCount + (hasMore ? 1000 : 0), status: 'computing' }));

                // UI 렌더링 틱 양보
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            if (processedCount === 0) {
                console.warn("No orders found.");
                toast({ title: "데이터 없음", description: "주문 데이터가 없습니다.", variant: "default" });
                setLoading(false);
                return;
            }

            const processedDays = Object.keys(dailyStats);
            console.log(`Stats computation complete. Processed ${processedDays.length} distinct days.`);

            // 2. 결과 저장
            setProgress(prev => ({ ...prev, total: processedDays.length, status: 'saving' }));

            const statsArray = processedDays.map(dateStr => ({
                date: dailyStats[dateStr].date,
                total_revenue: dailyStats[dateStr].totalRevenue,
                total_order_count: dailyStats[dateStr].totalOrderCount,
                total_settled_amount: dailyStats[dateStr].totalSettledAmount,
                branches: dailyStats[dateStr].branches,
                last_updated: new Date().toISOString()
            }));

            // 한 번에 저장하는 대신, 50개씩 나눠서 저장 (Payload Too Large 방지)
            const BATCH_SAVE_SIZE = 50;
            for (let i = 0; i < statsArray.length; i += BATCH_SAVE_SIZE) {
                const chunk = statsArray.slice(i, i + BATCH_SAVE_SIZE);
                const { error: upsertError } = await supabase
                    .from('daily_stats')
                    .upsert(chunk as any, { onConflict: 'date' });

                if (upsertError) {
                    console.error("Upsert error:", upsertError);
                    throw upsertError;
                }

                // 저장 진행상황 틱
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            console.log("Save complete.");
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
                description: `오류 상세보기: ${error.message || JSON.stringify(error)}`,
            });
            setProgress(prev => ({ ...prev, status: 'error' }));
        } finally {
            setLoading(false);
        }
    };

    const handleFirebaseSync = async (collectionName?: string) => {
        setSyncLoading(true);
        setSyncProgress({ collection: '', total: 0, synced: 0, errors: 0 });

        toast({
            title: collectionName ? `${collectionName} 동기화 시작` : "Firebase 전체 동기화 시작",
            description: "Firebase 데이터를 Supabase로 동기화하고 있습니다..."
        });

        try {
            const url = new URL('/api/firebase-sync', window.location.origin);
            if (collectionName) url.searchParams.set('collection', collectionName);
            const res = await fetch(url.toString());
            const data = await res.json();

            if (data.success) {
                toast({
                    title: "동기화 완료",
                    description: collectionName
                        ? `${collectionName} 데이터가 성공적으로 동기화되었습니다.`
                        : "Firebase 데이터가 성공적으로 Supabase로 동기화되었습니다.",
                });
                console.log("Sync details:", data.result);
            } else {
                throw new Error(data.message || data.error || 'Unknown error');
            }
        } catch (error: any) {
            console.error("Firebase sync error:", error);
            toast({
                variant: "destructive",
                title: "동기화 오류",
                description: `오류: ${error.message || JSON.stringify(error)}`,
            });
        } finally {
            setSyncLoading(false);
        }
    };

    const syncItems = [
        { firebase: 'orders', label: '주문' },
        { firebase: 'customers', label: '고객' },
        { firebase: 'products', label: '상품' },
        { firebase: 'branches', label: '지점' },
        { firebase: 'materials', label: '자재' },
        { firebase: 'simpleExpenses', label: '간편지출' },
        { firebase: 'userRoles', label: '권한' },
        { firebase: 'orderTransfers', label: '주문이관' },
        { firebase: 'materialRequests', label: '자재요청' },
        { firebase: 'dailyStats', label: '일별통계' },
    ];

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

                {/* Firebase 동기화 섹션 */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-medium flex items-center gap-2">
                                <Database className="h-4 w-4" />
                                Firebase → Supabase 데이터 동기화
                            </h4>
                            <p className="text-sm text-muted-foreground">
                                Firebase의 모든 데이터를 Supabase로 복사합니다.
                            </p>
                        </div>
                        <Button
                            onClick={() => handleFirebaseSync()}
                            disabled={syncLoading}
                            variant="default"
                            className="min-w-[120px] bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {syncLoading ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    동기화 중...
                                </>
                            ) : (
                                <>
                                    <Database className="mr-2 h-4 w-4" />
                                    전체 동기화
                                </>
                            )}
                        </Button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-blue-100 dark:border-blue-900">
                        {syncItems.map((item) => (
                            <Button
                                key={item.firebase}
                                onClick={() => handleFirebaseSync(item.firebase)}
                                disabled={syncLoading}
                                variant="outline"
                                size="sm"
                                className="text-xs h-9"
                            >
                                {item.label} 동기화
                            </Button>
                        ))}
                    </div>
                </div>

                {syncProgress.total > 0 && (
                    <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
                        <div className="flex justify-between text-sm">
                            <span className="font-medium">{syncProgress.collection}</span>
                            <span className="text-muted-foreground">
                                {syncProgress.synced} / {syncProgress.total}
                                {syncProgress.errors > 0 && ` (오류: ${syncProgress.errors})`}
                            </span>
                        </div>
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(syncProgress.synced / syncProgress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
