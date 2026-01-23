"use client";
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Order } from './use-orders';
import { useAuth } from './use-auth';
import { useSimpleExpenses } from './use-simple-expenses';

export interface OutsourceStats {
    totalCount: number;
    totalRevenue: number;
    totalPartnerPrice: number;
    totalProfit: number;
    averageMargin: number;
}

export function useOutsourceOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<OutsourceStats>({
        totalCount: 0,
        totalRevenue: 0,
        totalPartnerPrice: 0,
        totalProfit: 0,
        averageMargin: 0
    });

    const { user } = useAuth();
    const { deleteExpenseByOrderId } = useSimpleExpenses();
    const isAdmin = user?.role === '본사 관리자';
    const branchName = user?.franchise;

    const mapRowToOrder = (row: any): Order => {
        const outsourceInfo = row.outsource_info || row.extra_data?.outsource_info;

        // internal mapping from snake_case to camelCase for the interface
        const mappedOutsourceInfo = outsourceInfo ? {
            isOutsourced: outsourceInfo.is_outsourced ?? outsourceInfo.isOutsourced,
            partnerId: outsourceInfo.partner_id ?? outsourceInfo.partnerId,
            partnerName: outsourceInfo.partner_name ?? outsourceInfo.partnerName,
            partnerPrice: outsourceInfo.partner_price ?? outsourceInfo.partnerPrice,
            profit: outsourceInfo.profit,
            status: outsourceInfo.status,
            notes: outsourceInfo.notes,
            outsourcedAt: outsourceInfo.outsourced_at ?? outsourceInfo.outsourcedAt,
            updatedAt: outsourceInfo.updated_at ?? outsourceInfo.updatedAt
        } : undefined;

        return {
            id: row.id,
            orderNumber: row.order_number,
            status: row.status,
            receiptType: row.receipt_type,
            branchId: row.branch_id,
            branchName: row.branch_name,
            orderDate: row.order_date,
            orderer: row.orderer,
            deliveryInfo: row.delivery_info,
            pickupInfo: row.pickup_info,
            summary: row.summary,
            payment: row.payment,
            items: row.items,
            message: row.message || {},
            request: row.request || '',
            isAnonymous: row.is_anonymous || false,
            registerCustomer: row.register_customer || false,
            orderType: row.order_type,
            transferInfo: row.transfer_info,
            outsourceInfo: mappedOutsourceInfo as any,
            extraData: row.extra_data,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at,
            completedBy: row.completed_by
        };
    };

    const fetchOutsourceOrders = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase.from('orders')
                .select('*')
                .or('outsource_info.not.is.null,extra_data->outsource_info.not.is.null')
                .order('order_date', { ascending: false });

            if (!isAdmin && branchName) {
                query = query.eq('branch_name', branchName);
            }

            const { data, error } = await query;
            if (error) throw error;

            // 추가 필터링: is_outsourced가 true인 주문만 (JSONB 내부 필드라 query에서 or와 함께 쓰기 복잡함)
            const ordersData = (data || []).map(mapRowToOrder).filter(order =>
                order.outsourceInfo?.isOutsourced === true
            );

            setOrders(ordersData);

            // Calculate Stats
            const totalCount = ordersData.length;
            const totalRevenue = ordersData.reduce((sum, order) => sum + (order.summary?.total || 0), 0);
            const totalPartnerPrice = ordersData.reduce((sum, order) => sum + (order.outsourceInfo?.partnerPrice || 0), 0);
            const totalProfit = ordersData.reduce((sum, order) => sum + (order.outsourceInfo?.profit || 0), 0);
            const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

            setStats({
                totalCount,
                totalRevenue,
                totalPartnerPrice,
                totalProfit,
                averageMargin
            });
        } catch (error) {
            console.error('외부 발주 내역 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, branchName]);

    useEffect(() => {
        if (user) {
            fetchOutsourceOrders();
        }
    }, [user, fetchOutsourceOrders]);

    const updateOutsourceStatus = async (orderId: string, status: string) => {
        try {
            // Check if outsource_info exists as a top-level column or in extra_data
            const { data: order } = await supabase.from('orders').select('outsource_info, extra_data').eq('id', orderId).single();
            if (!order) throw new Error('주문을 찾을 수 없습니다.');

            const currentInfo = order.outsource_info || order.extra_data?.outsource_info;

            const { error } = await supabase.from('orders').update({
                'outsource_info': {
                    ...currentInfo,
                    status: status,
                    updatedAt: new Date().toISOString()
                }
            }).eq('id', orderId);

            if (error) throw error;

            if (status === 'canceled') {
                await deleteExpenseByOrderId(orderId);
            }

            await fetchOutsourceOrders();
        } catch (error) {
            console.error('외부 발주 상태 업데이트 오류:', error);
            throw error;
        }
    };

    return {
        orders, loading, stats, fetchOutsourceOrders, updateOutsourceStatus
    };
}
