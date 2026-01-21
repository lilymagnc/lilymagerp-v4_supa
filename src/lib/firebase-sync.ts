import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import {
    collection,
    getDocs,
    Timestamp
} from 'firebase/firestore';

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

interface SyncProgress {
    collection: string;
    total: number;
    synced: number;
    errors: number;
}

export async function syncFirebaseToSupabase(
    onProgress?: (progress: SyncProgress) => void
): Promise<{ success: boolean; message: string; details: any }> {
    const results: any = {};

    const collectionsToSync = [
        { firebase: 'orders', supabase: 'orders' },
        { firebase: 'customers', supabase: 'customers' },
        { firebase: 'products', supabase: 'products' },
        { firebase: 'branches', supabase: 'branches' },
        { firebase: 'dailyStats', supabase: 'daily_stats' },
    ];

    for (const cfg of collectionsToSync) {
        try {
            const snapshot = await getDocs(collection(db, cfg.firebase));
            const total = snapshot.size;
            let synced = 0;
            let errors = 0;

            results[cfg.firebase] = { total, synced: 0, errors: 0 };

            for (const doc of snapshot.docs) {
                try {
                    const data = doc.data();
                    const id = doc.id;

                    // Skip initialization markers
                    if (id === '_initialized') continue;

                    const payload: any = { id };

                    // Map data based on collection type
                    if (cfg.supabase === 'orders') {
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
                    } else if (cfg.supabase === 'customers') {
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
                    } else if (cfg.supabase === 'products') {
                        if (!data.name) continue; // Skip products without name
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
                    } else if (cfg.supabase === 'branches') {
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
                    } else if (cfg.supabase === 'daily_stats') {
                        Object.assign(payload, {
                            date: id,
                            total_order_count: data.totalOrderCount,
                            total_revenue: data.totalRevenue,
                            total_settled_amount: data.totalSettledAmount,
                            branches: convertValue(data.branches),
                            last_updated: convertValue(data.lastUpdated)
                        });
                    }

                    // Determine unique key for upsert
                    let onConflict = 'id';
                    if (cfg.supabase === 'branches') onConflict = 'name';
                    else if (cfg.supabase === 'daily_stats') onConflict = 'date';

                    const { error } = await supabase
                        .from(cfg.supabase)
                        .upsert([payload], { onConflict });

                    if (error && !error.message.includes('duplicate key')) {
                        errors++;
                        console.error(`Error syncing ${cfg.firebase}/${id}:`, error.message);
                    } else {
                        synced++;
                    }
                } catch (err) {
                    errors++;
                    console.error(`Error processing ${cfg.firebase}/${doc.id}:`, err);
                }

                // Report progress
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
