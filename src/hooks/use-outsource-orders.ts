"use client";

import { useState, useCallback, useEffect } from 'react';
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    doc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

    const fetchOutsourceOrders = useCallback(async () => {
        try {
            setLoading(true);
            const ordersRef = collection(db, 'orders');

            let q = query(
                ordersRef,
                where('outsourceInfo.isOutsourced', '==', true)
            );

            const querySnapshot = await getDocs(q);
            let ordersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Order[];

            // Client-side sorting (since where + orderBy requires composite index)
            ordersData.sort((a, b) => {
                const dateA = a.orderDate instanceof Timestamp ? a.orderDate.toMillis() : new Date(a.orderDate).getTime();
                const dateB = b.orderDate instanceof Timestamp ? b.orderDate.toMillis() : new Date(b.orderDate).getTime();
                return dateB - dateA;
            });

            // Permission filtering
            if (!isAdmin && branchName) {
                ordersData = ordersData.filter(order => order.branchName === branchName);
            }

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

    const updateOutsourceStatus = async (orderId: string, status: Order['outsourceInfo']['status']) => {
        try {
            const orderRef = doc(db, 'orders', orderId);
            await updateDoc(orderRef, {
                'outsourceInfo.status': status,
                'outsourceInfo.updatedAt': serverTimestamp()
            });

            // 발주 취소 시 간편지출 내역 자동 삭제
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
        orders,
        loading,
        stats,
        fetchOutsourceOrders,
        updateOutsourceStatus
    };
}
