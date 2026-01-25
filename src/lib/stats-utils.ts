import { supabase } from '@/lib/supabase';

/**
 * 지점명을 JSONB 키로 안전하게 사용하기 위해 변환합니다.
 * '릴리맥 광화문점' -> '릴리맥_광화문점'
 */
export const sanitizeBranchKey = (branchName: string): string => {
    if (!branchName) return "Unknown";
    return branchName.replace(/\./g, '_').replace(/ /g, '_');
};

export async function updateDailyStats(
    orderDate: Date | string,
    branchName: string,
    change: {
        revenueDelta: number;
        orderCountDelta: number;
        settledAmountDelta: number;
    }
) {
    if (!orderDate || !branchName) return;

    const date = orderDate instanceof Date
        ? orderDate
        : new Date(orderDate);

    const dateStr = date.toISOString().split('T')[0];

    try {
        const { error } = await supabase.rpc('increment_daily_stats', {
            p_date: dateStr,
            p_revenue_delta: Math.round(change.revenueDelta),
            p_order_count_delta: change.orderCountDelta,
            p_settled_amount_delta: Math.round(change.settledAmountDelta),
            p_branch_key: sanitizeBranchKey(branchName)
        });

        if (error) throw error;
    } catch (error) {
        console.error('Error updating daily stats:', error);
    }
}

/**
 * 특정 기간의 일별 통계를 가져옵니다.
 */
export async function fetchDailyStats(startDate: string, endDate: string) {
    try {
        const { data, error } = await supabase
            .from('daily_stats')
            .select('*')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) throw error;

        // Firestore format compatibility (mapping snake_case to camelCase)
        return (data || []).map(row => ({
            date: row.date,
            totalRevenue: row.total_revenue,
            totalOrderCount: row.total_order_count,
            totalSettledAmount: row.total_settled_amount,
            branches: row.branches,
            lastUpdated: row.last_updated
        }));
    } catch (error: any) {
        // 테이블이 아직 없거나 404 에러인 경우 빈 배열 반환하여 앱 충돌 방지
        if (error.code === '42P01' || error.message?.includes('404')) {
            console.warn('Daily stats table missing or not found. Returning empty stats.');
            return [];
        }
        console.error('Error fetching daily stats:', error);
        return [];
    }
}
