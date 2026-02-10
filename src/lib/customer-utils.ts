import { format, subMonths, parseISO } from 'date-fns';
import { isCanceled } from './order-utils';

export type CustomerGrade = '신규' | '일반' | 'VIP' | 'VVIP';

/**
 * 고객 등급 산정 로직
 * - 신규: 가입 후 주문 3회 미만
 * - 일반: 주문 3회 이상
 * - VIP: 최근 3개월 내 월 구매액 50만원 이상 기록이 있거나, 4-6개월 전 VVIP였던 경우
 * - VVIP: 최근 3개월 내 월 구매액 200만원 이상 기록이 있는 경우
 */
export function calculateGrade(orderHistory: any[]): CustomerGrade {
    const validOrders = orderHistory.filter(order => !isCanceled(order));
    const orderCount = validOrders.length;

    if (orderCount === 0) return '신규';

    // 총 구매액 계산
    const totalSpent = validOrders.reduce((sum, order) => sum + (order.summary?.total || 0), 0);

    const now = new Date();
    // 월별 구매액 집계 (VVIP용)
    const monthlySpending: Record<string, number> = {};
    validOrders.forEach(order => {
        const rawDate = order.orderDate || order.order_date;
        const orderDate = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);
        const monthKey = format(orderDate, 'yyyy-MM');
        monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (order.summary?.total || 0);
    });

    const months = [];
    for (let i = 0; i < 4; i++) {
        const d = subMonths(now, i);
        months.push(format(d, 'yyyy-MM'));
    }

    /**
     * VVIP 판정 로직 (유지):
     * - 최근 3개월(현재달 포함 4개월) 내 월 구매액 200만원 이상 기록이 있는 경우
     */
    const hasVVIPRecordLast3Months = months.some(m => (monthlySpending[m] || 0) >= 2000000);
    if (hasVVIPRecordLast3Months) return 'VVIP';

    /**
     * VIP 판정 로직 (변경):
     * - 구매 횟수 2회 이상 AND 총 구매액 100만원 이상
     */
    if (orderCount >= 2 && totalSpent >= 1000000) return 'VIP';

    /**
     * 일반 판정 로직 (변경):
     * - 구매 횟수 2회 이상
     */
    if (orderCount >= 2) return '일반';

    return '신규';
}
