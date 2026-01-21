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

    const mapRowToOrder = (row: any): Order => ({
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
        memo: row.memo,
        transferInfo: row.transfer_info,
        outsourceInfo: row.outsource_info,
        extraData: row.extra_data,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        completedBy: row.completed_by
    });

    const fetchOutsourceOrders = useCallback(async () => {
        try {
            setLoading(true);

            let query = supabase.from('orders')
                .select('*')
                .not('outsource_info', 'is', null)
                .eq('outsource_info->isOutsourced', true)
                .order('order_date', { ascending: false });

            if (!isAdmin && branchName) {
                query = query.eq('branch_name', branchName);
            }

            const { data, error } = await query;
            if (error) throw error;

            const ordersData = (data || []).map(mapRowToOrder);
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
            const { error } = await supabase.from('orders').update({
                'outsource_info': {
                    ...(await supabase.from('orders').select('outsource_info').eq('id', orderId).single()).data?.outsource_info,
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
