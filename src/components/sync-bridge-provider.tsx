"use client";

import React, { useEffect, useRef } from 'react';
import {
    collection,
    onSnapshot,
    query,
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

        console.log('🔄 Firebase-to-Supabase Sync Bridge Active');

        const convertValue = (val: any): any => {
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
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at),
                        completed_at: convertValue(data.completedAt),
                        completed_by: data.completedBy
                    });
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
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at),
                        last_order_date: convertValue(data.lastOrderDate)
                    });
                } else if (supabaseTable === 'products') {
                    Object.assign(payload, {
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
                        created_at: convertValue(data.createdAt || data.created_at),
                        updated_at: convertValue(data.updatedAt || data.updated_at)
                    });
                } else if (supabaseTable === 'branches') {
                    Object.assign(payload, {
                        name: data.name,
                        type: data.type,
                        address: data.address,
                        phone: data.phone,
                        manager: data.manager,
                        business_number: data.businessNumber,
                        employee_count: data.employeeCount,
                        delivery_fees: convertValue(data.deliveryFees),
                        surcharges: convertValue(data.surcharges),
                        account: convertValue(data.account)
                    });
                } else if (supabaseTable === 'daily_stats') {
                    Object.assign(payload, {
                        date: id,
                        total_order_count: data.totalOrderCount,
                        total_revenue: data.totalRevenue,
                        total_settled_amount: data.totalSettledAmount,
                        branches: convertValue(data.branches),
                        last_updated: convertValue(data.lastUpdated)
                    });
                } else {
                    // Generic mapping: camelCase to snake_case
                    for (const key in data) {
                        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                        payload[snakeKey] = convertValue(data[key]);
                    }
                }

                const syncWithRetry = async (payloadToSync: any, attempt: number = 0): Promise<void> => {
                    if (attempt > 3) return;

                    // Skip initialization markers
                    if (id === '_initialized') return;

                    // Skip products with null name
                    if (supabaseTable === 'products' && !payloadToSync.name) {
                        return;
                    }

                    // Determine the unique key for upsert
                    let onConflict = 'id';
                    if (supabaseTable === 'branches') {
                        onConflict = 'name'; // branches uses name as unique key
                    } else if (supabaseTable === 'daily_stats') {
                        onConflict = 'date'; // daily_stats uses date as unique key
                    }

                    const { error } = await supabase
                        .from(supabaseTable)
                        .upsert([payloadToSync], { onConflict });

                    if (error && error.code === 'PGRST204') {
                        // Column missing - retry without that column
                        const match = error.message.match(/'(.*?)'/) || error.message.match(/"(.*?)"/);
                        let missingColumn = match ? match[1] : null;

                        if (missingColumn && missingColumn.includes('.')) {
                            missingColumn = missingColumn.split('.').pop() || null;
                        }

                        if (missingColumn && payloadToSync[missingColumn] !== undefined) {
                            const newPayload = { ...payloadToSync };
                            delete newPayload[missingColumn];
                            return syncWithRetry(newPayload, attempt + 1);
                        }
                    }

                    if (error) {
                        // Ignore duplicate key errors - data already exists
                        if (!error.message.includes('duplicate key')) {
                            console.error(`❌ Sync error [${supabaseTable}]:`, error.message);
                        }
                    } else {
                        console.log(`✅ Synced ${supabaseTable}: ${id}`);
                    }
                };

                await syncWithRetry(payload);
            } catch (err) {
                console.error(`❌ Sync processing error [${supabaseTable}]:`, err);
            }
        };

        const collectionsToSync = [
            { firebase: 'orders', supabase: 'orders' },
            { firebase: 'customers', supabase: 'customers' },
            { firebase: 'products', supabase: 'products' },
            { firebase: 'branches', supabase: 'branches' },
            { firebase: 'dailyStats', supabase: 'daily_stats' },
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
                console.error(`❌ Firestore Snapshot error [${cfg.firebase}]:`, error);
            });
        });

        return () => {
            console.log('🛑 Firebase-to-Supabase Sync Bridge Stopping');
            unsubscribes.forEach(unsub => unsub());
        };
    }, [user]);

    return <>{children}</>;
}
