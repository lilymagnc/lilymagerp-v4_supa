const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const FIREBASE_SERVICE_ACCOUNT = path.resolve(__dirname, '../firebase-service-account.json');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Firebase
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT, 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const firestore = admin.firestore();

// Initialize Supabase
console.log(`Connecting to Supabase URL: ${SUPABASE_URL}`);
console.log(`Using Service Role Key (prefix): ${SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.substring(0, 10) : 'MISSING'}`);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper: Convert Firebase Timestamp to ISO String
const formatValue = (val) => {
    if (val && typeof val === 'object') {
        if (val.toDate && typeof val.toDate === 'function') {
            return val.toDate().toISOString();
        }
        if (val._seconds !== undefined) {
            return new Date(val._seconds * 1000).toISOString();
        }
    }
    return val;
};

// Helper: Transform Firestore Doc to Postgres Row
// This function handles flat fields and prepares objects as JSON (Postgres JSONB)
const transformDoc = (id, data, mapping) => {
    const row = { id };
    for (const [fsField, pgField] of Object.entries(mapping)) {
        let value = data[fsField];

        // Handle nested or renamed fields if necessary
        if (value === undefined) continue;

        // Special handling for objects -> JSONB
        if (value && typeof value === 'object' && !(value.toDate)) {
            row[pgField] = value; // Supabase client handles objects as JSONB automatically
        } else {
            row[pgField] = formatValue(value);
        }
    }
    return row;
};

async function migrateCollection(fsCollectionName, pgTableName, mapping) {
    console.log(`\n--- Migrating ${fsCollectionName} -> ${pgTableName} ---`);

    try {
        const snapshot = await firestore.collection(fsCollectionName).get();
        console.log(`Found ${snapshot.size} documents in Firestore.`);

        if (snapshot.empty) return;

        const rows = snapshot.docs.map(doc => transformDoc(doc.id, doc.data(), mapping));

        // Chunk insertion
        const chunkSize = 100;
        let successCount = 0;

        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            const { error } = await supabase.from(pgTableName).upsert(chunk);

            if (error) {
                console.error(`❌ Error migrating chunk in ${fsCollectionName} (${i}-${i + chunk.length}):`, error.message, error.details);
                // Fallback to individual for this chunk
                for (const row of chunk) {
                    const { error: singleError } = await supabase.from(pgTableName).upsert(row);
                    if (singleError) console.error(`  - Failed doc ${row.id}: ${singleError.message}`);
                    else successCount++;
                }
            } else {
                successCount += chunk.length;
                process.stdout.write('.'); // Progress
            }
        }

        console.log(`\n✅ Finished ${fsCollectionName}. Successfully migrated ${successCount}/${rows.length} records.`);
    } catch (error) {
        console.error(`❌ Fatal error migrating ${fsCollectionName}:`, error.message);
    }
}


// Define Mappings (Firestore Field -> Postgres Column)
const mappings = {
    branches: {
        name: 'name',
        type: 'type',
        address: 'address',
        phone: 'phone',
        manager: 'manager',
        businessNumber: 'business_number',
        employeeCount: 'employee_count',
        deliveryFees: 'delivery_fees',
        surcharges: 'surcharges',
        account: 'account',
        seeded: 'seeded',
        extraData: 'extra_data',
        createdAt: 'created_at'
    },
    customers: {
        name: 'name',
        contact: 'contact',
        companyName: 'company_name',
        address: 'address',
        email: 'email',
        grade: 'grade',
        memo: 'memo',
        points: 'points',
        type: 'type',
        birthday: 'birthday',
        weddingAnniversary: 'wedding_anniversary',
        foundingAnniversary: 'founding_anniversary',
        firstVisitDate: 'first_visit_date',
        otherAnniversaryName: 'other_anniversary_name',
        otherAnniversary: 'other_anniversary',
        specialNotes: 'special_notes',
        monthlyPaymentDay: 'monthly_payment_day',
        totalSpent: 'total_spent',
        orderCount: 'order_count',
        primaryBranch: 'primary_branch',
        branch: 'branch',
        branches: 'branches',
        isDeleted: 'is_deleted',
        extraData: 'extra_data',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        lastOrderDate: 'last_order_date'
    },
    products: {
        name: 'name',
        mainCategory: 'main_category',
        midCategory: 'mid_category',
        price: 'price',
        supplier: 'supplier',
        stock: 'stock',
        size: 'size',
        color: 'color',
        branch: 'branch',
        code: 'code',
        category: 'category',
        status: 'status',
        extraData: 'extra_data',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    materials: {
        name: 'name',
        mainCategory: 'main_category',
        midCategory: 'mid_category',
        unit: 'unit',
        spec: 'spec',
        price: 'price',
        stock: 'stock',
        size: 'size',
        color: 'color',
        memo: 'memo',
        branch: 'branch',
        supplier: 'supplier',
        extraData: 'extra_data',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    orders: {
        orderNumber: 'order_number',
        status: 'status',
        receiptType: 'receipt_type',
        branchId: 'branch_id',
        branchName: 'branch_name',
        orderDate: 'order_date',
        orderer: 'orderer',
        deliveryInfo: 'delivery_info',
        pickupInfo: 'pickup_info',
        summary: 'summary',
        payment: 'payment',
        items: 'items',
        memo: 'memo',
        transferInfo: 'transfer_info',
        actualDeliveryCost: 'actual_delivery_cost',
        extraData: 'extra_data',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        completedAt: 'completed_at',
        completedBy: 'completed_by'
    },
    order_transfers: {
        originalOrderId: 'original_order_id',
        orderBranchId: 'order_branch_id',
        orderBranchName: 'order_branch_name',
        processBranchId: 'process_branch_id',
        processBranchName: 'process_branch_name',
        transferDate: 'transfer_date',
        transferReason: 'transfer_reason',
        transferBy: 'transfer_by',
        transferByUser: 'transfer_by_user',
        status: 'status',
        amountSplit: 'amount_split',
        originalOrderAmount: 'original_order_amount',
        notes: 'notes',
        acceptedAt: 'accepted_at',
        acceptedBy: 'accepted_by',
        rejectedAt: 'rejected_at',
        rejectedBy: 'rejected_by',
        completedAt: 'completed_at',
        completedBy: 'completed_by',
        cancelledAt: 'cancelled_at',
        cancelledBy: 'cancelled_by',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    expense_requests: {
        requestNumber: 'request_number',
        status: 'status',
        branchId: 'branch_id',
        branchName: 'branch_name',
        totalAmount: 'total_amount',
        totalTaxAmount: 'total_tax_amount',
        items: 'items',
        approvalRecords: 'approval_records',
        requiredApprovalLevel: 'required_approval_level',
        currentApprovalLevel: 'current_approval_level',
        fiscalYear: 'fiscal_year',
        fiscalMonth: 'fiscal_month',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        submittedAt: 'submitted_at',
        approvedAt: 'approved_at',
        paidAt: 'paid_at',
        paymentMethod: 'payment_method',
        paymentDate: 'payment_date',
        paymentReference: 'payment_reference'
    },
    simple_expenses: {
        expenseDate: 'expense_date',
        amount: 'amount',
        category: 'category',
        subCategory: 'sub_category',
        description: 'description',
        supplier: 'supplier',
        quantity: 'quantity',
        unitPrice: 'unit_price',
        branchId: 'branch_id',
        branchName: 'branch_name',
        receiptUrl: 'receipt_url',
        receiptFileName: 'receipt_file_name',
        relatedRequestId: 'related_request_id',
        isAutoGenerated: 'is_auto_generated',
        inventoryUpdates: 'inventory_updates',
        extraData: 'extra_data',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    user_roles: {
        userId: 'user_id',
        email: 'email',
        role: 'role',
        permissions: 'permissions',
        branchId: 'branch_id',
        branchName: 'branch_name',
        isActive: 'is_active',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    albums: {
        title: 'title',
        description: 'description',
        category: 'category',
        photoCount: 'photo_count',
        isPublic: 'is_public',
        thumbnailUrl: 'thumbnail_url',
        branchId: 'branch_id',
        createdBy: 'created_by',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    audit_logs: {
        createdAt: 'created_at',
        action: 'action',
        entityType: 'entity_type',
        entityId: 'entity_id',
        entityName: 'entity_name',
        branchId: 'branch_id',
        branchName: 'branch_name',
        operatorId: 'operator_id',
        operatorName: 'operator_name',
        details: 'details',
        userAgent: 'user_agent'
    },
    notifications: {
        type: 'type',
        subType: 'sub_type',
        title: 'title',
        message: 'message',
        severity: 'severity',
        userId: 'user_id',
        userRole: 'user_role',
        branchId: 'branch_id',
        departmentId: 'department_id',
        relatedId: 'related_id',
        relatedType: 'related_type',
        actionUrl: 'action_url',
        isRead: 'is_read',
        readAt: 'read_at',
        isArchived: 'is_archived',
        autoExpire: 'auto_expire',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    }
};

async function runMigration() {
    console.log('🚀 Starting Data Migration...');

    // Migration Sequence
    await migrateCollection('branches', 'branches', mappings.branches);
    await migrateCollection('customers', 'customers', mappings.customers);
    await migrateCollection('products', 'products', mappings.products);
    await migrateCollection('materials', 'materials', mappings.materials);
    await migrateCollection('orders', 'orders', mappings.orders);
    await migrateCollection('order_transfers', 'order_transfers', mappings.order_transfers);
    await migrateCollection('expense_requests', 'expense_requests', mappings.expense_requests);
    await migrateCollection('simple_expenses', 'simple_expenses', mappings.simple_expenses);
    await migrateCollection('userRoles', 'user_roles', mappings.user_roles);
    await migrateCollection('albums', 'albums', mappings.albums);
    await migrateCollection('audit_logs', 'audit_logs', mappings.audit_logs);
    await migrateCollection('notifications', 'notifications', mappings.notifications);

    console.log('\n✅ Migration Phase 1 Complete!');
}

runMigration().catch(err => console.error('Migration failed:', err));
