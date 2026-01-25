import admin from 'firebase-admin';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/firebase';
import { collection, getDocs, Timestamp } from 'firebase/firestore';

// Initialize Firebase Admin SDK (server side)
let adminDb: admin.firestore.Firestore | null = null;
if (typeof window === 'undefined') {
    try {
        // Use GOOGLE_APPLICATION_CREDENTIALS env var
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        adminDb = admin.firestore();
    } catch (e) {
        console.error('Admin SDK init error:', e);
    }
}

const convertValue = (val: any): any => {
    if (!val) return val;

    // Check for Firestore Timestamp (Client or Admin SDK)
    if (val.toDate && typeof val.toDate === 'function') {
        return val.toDate().toISOString();
    }

    // Native Date
    if (val instanceof Date) return val.toISOString();

    if (Array.isArray(val)) return val.map(convertValue);

    if (typeof val === 'object') {
        const newObj: any = {};
        for (const key in val) {
            newObj[key] = convertValue(val[key]);
        }
        return newObj;
    }
    return val;
};

interface SyncProgress {
    collection: string;
    total: number;
    synced: number;
    errors: number;
}

export async function syncFirebaseToSupabase(
    onProgress?: (progress: SyncProgress) => void,
    targetCollection?: string
): Promise<{ success: boolean; message: string; details: any }> {
    const results: any = {};

    const allCollections = [
        { firebase: 'orders', supabase: 'orders', label: '주문' },
        { firebase: 'customers', supabase: 'customers', label: '고객' },
        { firebase: 'products', supabase: 'products', label: '상품' },
        { firebase: 'branches', supabase: 'branches', label: '지점' },
        { firebase: 'materials', supabase: 'materials', label: '자재' },
        { firebase: 'simpleExpenses', supabase: 'simple_expenses', label: '간편지출' },
        { firebase: 'userRoles', supabase: 'user_roles', label: '권한' },
        { firebase: 'orderTransfers', supabase: 'order_transfers', label: '주문이관' },
        { firebase: 'materialRequests', supabase: 'material_requests', label: '자재요청' },
        { firebase: 'dailyStats', supabase: 'daily_stats', label: '일별통계' },
    ];

    const collectionsToSync = targetCollection
        ? allCollections.filter(c => c.firebase === targetCollection)
        : allCollections;

    for (const cfg of collectionsToSync) {
        try {
            console.log(`Starting sync for ${cfg.firebase}...`);
            let snapshot;
            if (adminDb) {
                // Admin SDK uses its own collection method
                snapshot = await adminDb.collection(cfg.firebase).get();
            } else {
                // Client SDK fallback
                snapshot = await getDocs(collection(db, cfg.firebase));
            }
            const total = snapshot.size;
            let synced = 0;
            let errors = 0;

            results[cfg.firebase] = { total, synced: 0, errors: 0 };

            // Collect all payloads and deduplicate by conflict key
            const payloadsMap = new Map<string, any>();
            const conflictKey = cfg.supabase === 'branches' ? 'name' :
                cfg.supabase === 'daily_stats' ? 'date' :
                    'id';

            for (const doc of snapshot.docs) {
                try {
                    const data = doc.data();
                    const id = doc.id;

                    if (id === '_initialized') continue;

                    const payload: any = (cfg.supabase === 'daily_stats') ? { date: id } : { id };
                    const extraData: any = {};

                    const allowedColumns = (cfg.supabase === 'orders') ?
                        ['id', 'order_number', 'status', 'receipt_type', 'branch_id', 'branch_name', 'order_date', 'orderer', 'delivery_info', 'pickup_info', 'summary', 'payment', 'items', 'memo', 'transfer_info', 'outsource_info', 'actual_delivery_cost', 'actual_delivery_cost_cash', 'delivery_cost_status', 'delivery_cost_updated_at', 'delivery_cost_updated_by', 'delivery_cost_reason', 'delivery_profit', 'created_at', 'updated_at', 'completed_at', 'completed_by', 'extra_data'] :
                        (cfg.supabase === 'customers') ?
                            ['id', 'name', 'contact', 'company_name', 'address', 'email', 'grade', 'memo', 'points', 'type', 'birthday', 'wedding_anniversary', 'founding_anniversary', 'first_visit_date', 'other_anniversary_name', 'other_anniversary', 'special_notes', 'monthly_payment_day', 'total_spent', 'order_count', 'primary_branch', 'branch', 'branches', 'is_deleted', 'extra_data', 'created_at', 'updated_at', 'last_order_date'] :
                            (cfg.supabase === 'products') ?
                                ['id', 'name', 'main_category', 'mid_category', 'price', 'supplier', 'stock', 'size', 'color', 'branch', 'code', 'category', 'status', 'extra_data', 'created_at', 'updated_at'] :
                                (cfg.supabase === 'materials') ?
                                    ['id', 'name', 'main_category', 'mid_category', 'unit', 'spec', 'price', 'stock', 'size', 'color', 'memo', 'branch', 'supplier', 'extra_data', 'created_at', 'updated_at'] :
                                    (cfg.supabase === 'branches') ?
                                        ['id', 'name', 'type', 'address', 'phone', 'manager', 'business_number', 'employee_count', 'delivery_fees', 'surcharges', 'account', 'extra_data'] :
                                        (cfg.supabase === 'simple_expenses') ?
                                            ['id', 'expense_date', 'amount', 'category', 'sub_category', 'description', 'supplier', 'quantity', 'unit_price', 'branch_id', 'branch_name', 'receipt_url', 'receipt_file_name', 'related_request_id', 'is_auto_generated', 'inventory_updates', 'extra_data', 'created_at', 'updated_at'] :
                                            (cfg.supabase === 'order_transfers') ?
                                                ['id', 'original_order_id', 'order_branch_id', 'order_branch_name', 'process_branch_id', 'process_branch_name', 'transfer_date', 'transfer_reason', 'transfer_by', 'transfer_by_user', 'status', 'amount_split', 'original_order_amount', 'notes', 'accepted_at', 'accepted_by', 'rejected_at', 'rejected_by', 'completed_at', 'completed_by', 'cancelled_at', 'cancelled_by', 'created_at', 'updated_at'] :
                                                (cfg.supabase === 'material_requests') ?
                                                    ['id', 'request_number', 'branch_id', 'branch_name', 'requester_id', 'requester_name', 'status', 'total_amount', 'items', 'actual_purchase', 'delivery', 'created_at', 'updated_at'] :
                                                    (cfg.supabase === 'user_roles') ?
                                                        ['id', 'user_id', 'email', 'role', 'permissions', 'branch_id', 'branch_name', 'is_active', 'created_at', 'updated_at'] :
                                                        (cfg.supabase === 'daily_stats') ?
                                                            ['date', 'total_order_count', 'total_revenue', 'total_settled_amount', 'branches', 'extra_data', 'last_updated'] :
                                                            [];

                    const fieldMap: Record<string, string> = {
                        orderNumber: 'order_number',
                        receiptType: 'receipt_type',
                        branchId: 'branch_id',
                        branchName: 'branch_name',
                        orderDate: 'order_date',
                        deliveryInfo: 'delivery_info',
                        pickupInfo: 'pickup_info',
                        transferInfo: 'transfer_info',
                        actualDeliveryCost: 'actual_delivery_cost',
                        createdAt: 'created_at',
                        updatedAt: 'updated_at',
                        completedAt: 'completed_at',
                        completedBy: 'completed_by',
                        companyName: 'company_name',
                        otherAnniversaryName: 'other_anniversary_name',
                        otherAnniversary: 'other_anniversary',
                        specialNotes: 'special_notes',
                        monthlyPaymentDay: 'monthly_payment_day',
                        totalSpent: 'total_spent',
                        orderCount: 'order_count',
                        primaryBranch: 'primary_branch',
                        isDeleted: 'is_deleted',
                        lastOrderDate: 'last_order_date',
                        mainCategory: 'main_category',
                        midCategory: 'mid_category',
                        businessNumber: 'business_number',
                        employeeCount: 'employee_count',
                        deliveryFees: 'delivery_fees',
                        outsourceInfo: 'outsource_info',
                        outsource_info: 'outsource_info',
                        originalOrderId: 'original_order_id',
                        orderBranchId: 'order_branch_id',
                        orderBranchName: 'order_branch_name',
                        processBranchId: 'process_branch_id',
                        processBranchName: 'process_branch_name',
                        transferDate: 'transfer_date',
                        transferReason: 'transfer_reason',
                        transferBy: 'transfer_by',
                        transferByUser: 'transfer_by_user',
                        amountSplit: 'amount_split',
                        originalOrderAmount: 'original_order_amount',
                        acceptedAt: 'accepted_at',
                        acceptedBy: 'accepted_by',
                        rejectedAt: 'rejected_at',
                        rejectedBy: 'rejected_by',
                        cancelledAt: 'cancelled_at',
                        cancelledBy: 'cancelled_by',
                        cancelReason: 'cancel_reason',
                        totalRevenue: 'total_revenue',
                        totalOrderCount: 'total_order_count',
                        totalSettledAmount: 'total_settled_amount',
                        lastUpdated: 'last_updated',
                        expenseDate: 'expense_date',
                        date: 'expense_date',
                        subCategory: 'sub_category',
                        unitPrice: 'unit_price',
                        receiptUrl: 'receipt_url',
                        receiptFileName: 'receipt_file_name',
                        relatedRequestId: 'related_request_id',
                        isAutoGenerated: 'is_auto_generated',
                        inventoryUpdates: 'inventory_updates',
                        requestNumber: 'request_number',
                        totalAmount: 'total_amount',
                        userId: 'user_id',
                        isActive: 'is_active'
                    };

                    for (const [key, value] of Object.entries(data)) {
                        const pgKey = fieldMap[key] || key;
                        let convertedValue = convertValue(value);

                        const bigintColumns = [
                            'amount', 'unit_price', 'original_order_amount', 'partner_price',
                            'profit', 'total', 'subtotal', 'price', 'points', 'total_spent',
                            'total_revenue', 'total_settled_amount', 'quantity'
                        ];

                        if (bigintColumns.includes(pgKey) || pgKey.endsWith('_amount') || pgKey.endsWith('_price')) {
                            if (typeof convertedValue === 'number' && !isNaN(convertedValue)) {
                                convertedValue = Math.round(convertedValue);
                            }
                        }

                        if (allowedColumns.includes(pgKey) && pgKey !== 'extra_data') {
                            payload[pgKey] = convertedValue;
                        } else {
                            extraData[pgKey] = convertedValue;
                        }
                    }

                    if (cfg.supabase === 'orders') {
                        if (payload.outsource_info) {
                            extraData.outsource_info = payload.outsource_info;
                            delete payload.outsource_info;
                        }
                        payload.extra_data = {
                            ...(convertValue(data.extra_data || data.extraData || {})),
                            ...extraData
                        };
                    } else if (allowedColumns.includes('extra_data')) {
                        payload.extra_data = {
                            ...(convertValue(data.extra_data || data.extraData || {})),
                            ...extraData
                        };
                    }

                    if (cfg.supabase === 'daily_stats') {
                        payload.date = id;
                        payload.total_order_count = data.totalOrderCount;
                        payload.total_revenue = data.totalRevenue;
                        payload.total_settled_amount = data.totalSettledAmount;
                        payload.branches = convertValue(data.branches);
                        payload.last_updated = convertValue(data.lastUpdated);
                    }

                    // Store in map using conflict key to deduplicate
                    const conflictValue = payload[conflictKey];
                    if (conflictValue) {
                        payloadsMap.set(String(conflictValue), payload);
                    }
                } catch (err) {
                    errors++;
                    console.error(`Error processing ${cfg.firebase}/${doc.id}:`, err);
                }
            }

            // Batch processing from unique payloads
            const uniquePayloads = Array.from(payloadsMap.values());
            const BATCH_SIZE = 50;
            const docBatches: any[][] = [];

            for (let i = 0; i < uniquePayloads.length; i += BATCH_SIZE) {
                docBatches.push(uniquePayloads.slice(i, i + BATCH_SIZE));
            }

            // Upsert in batches
            for (const batch of docBatches) {
                const { error } = await (supabase.from(cfg.supabase) as any)
                    .upsert(batch, { onConflict: conflictKey });

                if (error) {
                    errors += batch.length;
                    console.error(`Error syncing batch for ${cfg.firebase}:`, error.message);
                } else {
                    synced += batch.length;
                }

                if (onProgress) {
                    onProgress({
                        collection: cfg.firebase,
                        total,
                        synced,
                        errors
                    });
                }
            }

            results[cfg.firebase] = { total, synced, errors };
        } catch (err) {
            console.error(`Error syncing collection ${cfg.firebase}:`, err);
            results[cfg.firebase] = { error: String(err) };
        }
    }

    return {
        success: true,
        message: 'Sync completed',
        details: results
    };
}

