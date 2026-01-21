"use client";

import React, { useEffect, useRef } from 'react';
import {
    collection,
    onSnapshot,
    query,
    where,
    limit,
    Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

/**
 * Firebase-to-Supabase Sync Bridge Provider
 * 
 * This provider listens to Firestore changes in real-time and 
 * mirrors them to Supabase to ensure data consistency during the migration phase.
 */
export function SyncBridgeProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const isSyncing = useRef(false);

    useEffect(() => {
        if (!user) return;

        console.log('Firebase-to-Supabase Sync Bridge Active');

        const convertValue = (val: any) => {
            if (val instanceof Timestamp) return val.toDate().toISOString();
            if (Array.isArray(val)) return val.map(convertValue);
            if (typeof val === 'object' && val !== null) {
                const newObj: any = {};
                for (const key in val) {
                    newObj[key] = convertValue(val[key]);
                }
                return newObj;
            }
            return val;
        };

        const syncTable = async (tableName: string, supabaseTable: string, doc: any) => {
            const data = doc.data();
            const id = doc.id;
            const payload: any = { id };

            try {
                if (supabaseTable === 'orders') {
                    Object.assign(payload, {
                        order_number: data.orderNumber,
                        status: data.status,
                        receipt_type: data.receiptType,
                        branch_id: data.branchId,
                        branch_name: data.branchName,
                        order_date: convertValue(data.orderDate),
                        orderer: convertValue(data.orderer),
                        delivery_info: convertValue(data.deliveryInfo),
                        pickup_info: convertValue(data.pickupInfo),
                        summary: convertValue(data.summary),
                        payment: convertValue(data.payment),
                        items: convertValue(data.items),
                        memo: data.memo,
                        transfer_info: convertValue(data.transferInfo),
                        actual_delivery_cost: data.actualDeliveryCost,
                        extra_data: convertValue(data.extra_data),
                        // outsource_info: convertValue(data.outsource_info), // Temporarily disabled if column missing
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at),
                        completed_at: convertValue(data.completedAt),
                        completed_by: data.completedBy
                    });
                    // Only add these if they don't cause 400 errors
                    if (data.outsource_info) payload.outsource_info = convertValue(data.outsource_info);
                    if (data.deliveryCostUpdatedAt) payload.delivery_cost_updated_at = convertValue(data.deliveryCostUpdatedAt);
                    if (data.deliveryCostStatus) payload.delivery_cost_status = data.deliveryCostStatus;
                } else if (supabaseTable === 'customers') {
                    Object.assign(payload, {
                        name: data.name,
                        contact: data.contact,
                        company_name: data.companyName,
                        address: data.address,
                        email: data.email,
                        grade: data.grade,
                        memo: data.memo,
                        points: data.points,
                        type: data.type,
                        birthday: data.birthday,
                        wedding_anniversary: data.weddingAnniversary,
                        founding_anniversary: data.foundingAnniversary,
                        first_visit_date: data.firstVisitDate,
                        other_anniversary_name: data.otherAnniversaryName,
                        other_anniversary: data.otherAnniversary,
                        anniversary: data.anniversary,
                        special_notes: data.specialNotes,
                        monthly_payment_day: data.monthlyPaymentDay,
                        total_spent: data.totalSpent,
                        order_count: data.orderCount,
                        primary_branch: data.primaryBranch,
                        branch: data.branch,
                        branches: convertValue(data.branches),
                        is_deleted: data.isDeleted,
                        extra_data: convertValue(data.extra_data),
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at),
                        last_order_date: convertValue(data.lastOrderDate)
                    });
                } else if (supabaseTable === 'products') {
                    Object.assign(payload, {
                        doc_id: id,
                        name: data.name,
                        main_category: data.mainCategory,
                        mid_category: data.midCategory,
                        price: data.price,
                        supplier: data.supplier,
                        stock: data.stock,
                        size: data.size,
                        color: data.color,
                        branch: data.branch,
                        code: data.code,
                        category: data.category,
                        status: data.status,
                        extra_data: convertValue(data.extra_data),
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at)
                    });
                } else if (supabaseTable === 'materials') {
                    Object.assign(payload, {
                        name: data.name,
                        main_category: data.main_category || data.mainCategory,
                        mid_category: data.mid_category || data.midCategory,
                        unit: data.unit,
                        spec: data.spec,
                        price: data.price,
                        stock: data.stock,
                        size: data.size,
                        color: data.color,
                        memo: data.memo,
                        branch: data.branch,
                        supplier: data.supplier,
                        extra_data: convertValue(data.extra_data),
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at)
                    });
                } else if (supabaseTable === 'daily_stats') {
                    Object.assign(payload, {
                        date: id,
                        total_order_count: data.totalOrderCount,
                        total_revenue: data.totalRevenue,
                        total_settled_amount: data.totalSettledAmount,
                        branches: convertValue(data.branches),
                        extra_data: convertValue(data.extra_data),
                        last_updated: convertValue(data.lastUpdated)
                    });
                } else if (supabaseTable === 'daily_settlements') {
                    Object.assign(payload, {
                        branch_id: data.branchId,
                        branch_name: data.branchName,
                        date: data.date,
                        settlement_data: convertValue(data.settlementData || data.settlement_data),
                        status: data.status,
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at)
                    });
                } else if (supabaseTable === 'checklists') {
                    Object.assign(payload, {
                        template_id: data.templateId,
                        branch_id: data.branchId,
                        branch_name: data.branchName,
                        record_date: data.recordDate,
                        week: data.week,
                        month: data.month,
                        category: data.category,
                        open_worker: data.openWorker,
                        close_worker: data.closeWorker,
                        responsible_person: data.responsiblePerson,
                        items: convertValue(data.items),
                        completed_by: data.completedBy,
                        completed_at: convertValue(data.completedAt),
                        status: data.status,
                        notes: data.notes,
                        weather: data.weather,
                        special_events: data.specialEvents,
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at)
                    });
                } else if (supabaseTable === 'stock_history') {
                    Object.assign(payload, {
                        occurred_at: convertValue(data.date || data.occurred_at),
                        type: data.type,
                        item_type: data.itemType,
                        item_id: data.itemId,
                        item_name: data.itemName,
                        quantity: data.quantity,
                        from_stock: data.fromStock,
                        to_stock: data.toStock,
                        resulting_stock: data.resultingStock,
                        branch: data.branch,
                        operator: data.operator,
                        supplier: data.supplier,
                        price: data.price,
                        total_amount: data.totalAmount,
                        related_request_id: data.relatedRequestId,
                        notes: data.notes
                    });
                } else {
                    for (const key in data) {
                        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                        payload[snakeKey] = convertValue(data[key]);
                    }
                }

                const syncWithRetry = async (payloadToSync: any, attempt: number = 0): Promise<void> => {
                    if (attempt > 5) return;

                    // Skip initialization markers quietly
                    if (id === '_initialized') return;

                    // Skip products with null name to avoid constraint violation
                    if (supabaseTable === 'products' && !payloadToSync.name) {
                        console.warn(`Skipping product sync: missing 'name' for ID ${id}`);
                        return;
                    }

                    const { error } = await supabase.from(supabaseTable).upsert([payloadToSync]);

                    if (error && error.code === 'PGRST204') {
                        // Extract column name: Handles 'col', "col", or table.col
                        const match = error.message.match(/'(.*?)'/) || error.message.match(/"(.*?)"/);
                        let missingColumn = match ? match[1] : null;

                        if (missingColumn && missingColumn.includes('.')) {
                            missingColumn = missingColumn.split('.').pop() || null;
                        }

                        if (missingColumn && payloadToSync[missingColumn] !== undefined) {
                            console.warn(`Column '${missingColumn}' missing in Supabase '${supabaseTable}'. Self-healing retry...`);
                            const newPayload = { ...payloadToSync };
                            delete newPayload[missingColumn];
                            return syncWithRetry(newPayload, attempt + 1);
                        }
                    }

                    if (error) {
                        console.error(`Sync error [${supabaseTable}]:`, error);
                    }
                };

                await syncWithRetry(payload);
            } catch (err) {
                console.error(`Sync processing error [${supabaseTable}]:`, err);
            }
        };

        const collectionsToSync = [
            { firebase: 'orders', supabase: 'orders' },
            { firebase: 'customers', supabase: 'customers' },
            { firebase: 'products', supabase: 'products' },
            { firebase: 'materials', supabase: 'materials' },
            { firebase: 'simpleExpenses', supabase: 'simple_expenses' },
            { firebase: 'materialRequests', supabase: 'material_requests' },
            { firebase: 'expenseRequests', supabase: 'expense_requests' },
            { firebase: 'partners', supabase: 'partners' },
            { firebase: 'employees', supabase: 'employees' },
            { firebase: 'quotations', supabase: 'quotations' },
            { firebase: 'branches', supabase: 'branches' },
            { firebase: 'dailyStats', supabase: 'daily_stats' },
            { firebase: 'daily_settlements', supabase: 'daily_settlements' },
            { firebase: 'checklists', supabase: 'checklists' },
            { firebase: 'stockHistory', supabase: 'stock_history' },
            { firebase: 'notifications', supabase: 'notifications' },
            { firebase: 'display_board', supabase: 'display_board' }
        ];

        const unsubscribes = collectionsToSync.map(cfg => {
            const q = query(collection(db, cfg.firebase));
            return onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' || change.type === 'modified') {
                        syncTable(cfg.firebase, cfg.supabase, change.doc);
                    }
                    if (change.type === 'removed') {
                        supabase.from(cfg.supabase).delete().eq('id', change.doc.id);
                    }
                });
            }, (error) => {
                console.error(`Firestore Snapshot error [${cfg.firebase}]:`, error);
            });
        });

        return () => {
            console.log('Firebase-to-Supabase Sync Bridge Stopping');
            unsubscribes.forEach(unsub => unsub());
        };
    }, [user]);

    return <>{children}</>;
}
