const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: '.env.local' });

// Firebase Config from restore-orders.js
const firebaseConfig = {
    apiKey: "AIzaSyApy5zme7H15h1UZd1B9hBDOOWgpbvOLJ4",
    authDomain: "lilymagerp-fs1.firebaseapp.com",
    databaseURL: "https://lilymagerp-fs1-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "lilymagerp-fs1",
    storageBucket: "lilymagerp-fs1.firebasestorage.app",
    messagingSenderId: "1069828102888",
    appId: "1:1069828102888:web:24927eab4719f3e75d475d",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role Key if available
const supabase = createClient(supabaseUrl, supabaseKey);

const toSnakeCase = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const transformData = (data) => {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(item => transformData(item));

    // Handle Firebase Timestamp
    if (data.toDate && typeof data.toDate === 'function') {
        return data.toDate().toISOString();
    }
    // Handle objects with _seconds (alternative timestamp format)
    if (data._seconds !== undefined && data._nanoseconds !== undefined) {
        return new Date(data._seconds * 1000).toISOString();
    }

    const transformed = {};
    for (const key in data) {
        let value = data[key];
        let mappedKey = toSnakeCase(key);
        transformed[mappedKey] = transformData(value);
    }
    return transformed;
};

const tableSchema = {
    'branches': ['id', 'name', 'type', 'address', 'phone', 'manager', 'business_number', 'employee_count', 'delivery_fees', 'surcharges', 'account', 'seeded', 'extra_data', 'created_at'],
    'customers': ['id', 'name', 'contact', 'company_name', 'address', 'email', 'grade', 'memo', 'points', 'type', 'birthday', 'wedding_anniversary', 'founding_anniversary', 'first_visit_date', 'other_anniversary_name', 'other_anniversary', 'special_notes', 'monthly_payment_day', 'total_spent', 'order_count', 'primary_branch', 'branch', 'branches', 'is_deleted', 'extra_data', 'created_at', 'updated_at', 'last_order_date'],
    'orders': ['id', 'order_number', 'status', 'receipt_type', 'branch_id', 'branch_name', 'order_date', 'orderer', 'delivery_info', 'pickup_info', 'summary', 'payment', 'items', 'memo', 'transfer_info', 'actual_delivery_cost', 'extra_data', 'created_at', 'updated_at', 'completed_at', 'completed_by'],
    'simple_expenses': ['id', 'expense_date', 'amount', 'category', 'sub_category', 'description', 'supplier', 'quantity', 'unit_price', 'branch_id', 'branch_name', 'receipt_url', 'receipt_file_name', 'related_request_id', 'is_auto_generated', 'inventory_updates', 'extra_data', 'created_at', 'updated_at', 'related_order_id', 'payment_method'],
    'materials': ['id', 'name', 'main_category', 'mid_category', 'unit', 'spec', 'price', 'stock', 'size', 'color', 'memo', 'branch', 'supplier', 'extra_data', 'created_at', 'updated_at'],
    'products': ['id', 'doc_id', 'name', 'main_category', 'mid_category', 'price', 'supplier', 'stock', 'size', 'color', 'branch', 'code', 'category', 'status', 'extra_data', 'created_at', 'updated_at'],
    'user_roles': ['id', 'user_id', 'email', 'role', 'permissions', 'branch_id', 'branch_name', 'is_active', 'created_at', 'updated_at']
};

const mapToTable = (table, data) => {
    const allowedColumns = tableSchema[table];
    if (!allowedColumns) return data;

    const mapped = { extra_data: {} };
    for (const key in data) {
        if (allowedColumns.includes(key)) {
            mapped[key] = data[key];
        } else if (key !== 'id') {
            mapped.extra_data[key] = data[key];
        }
    }
    if (Object.keys(mapped.extra_data).length === 0) delete mapped.extra_data;
    return mapped;
};

async function migrateCollection(fsColl, pgTable) {
    console.log(`\n📦 Migrating ${fsColl} -> ${pgTable}...`);
    try {
        const snapshot = await getDocs(collection(db, fsColl));
        console.log(`📊 Found ${snapshot.size} docs.`);

        if (snapshot.empty) return;

        const dataToInsert = snapshot.docs.map(doc => {
            let data = { id: doc.id, ...doc.data() };
            data = transformData(data);

            // Special mappings
            if (fsColl === 'simpleExpenses' || fsColl === 'simple_expenses') {
                if (data.date) { data.expense_date = data.date; delete data.date; }
            }
            if (fsColl === 'userRoles') {
                // user_roles id might not be set in doc data, using doc.id as id
            }

            data = mapToTable(pgTable, data);
            return data;
        });

        const batchSize = 50;
        for (let i = 0; i < dataToInsert.length; i += batchSize) {
            const batch = dataToInsert.slice(i, i + batchSize);
            const { error } = await supabase.from(pgTable).upsert(batch);
            if (error) {
                console.error(`❌ [${pgTable}] Error:`, error.message);
            } else {
                process.stdout.write(`⏳ Progress: ${Math.min(i + batchSize, dataToInsert.length)}/${dataToInsert.length}\r`);
            }
        }
        console.log(`\n✅ [${fsColl}] Done!`);
    } catch (error) {
        console.error(`❌ [${fsColl}] Failed:`, error);
    }
}

async function startMigration() {
    console.log('🚀 Starting Data Migration (Web SDK)...');

    await migrateCollection('branches', 'branches');
    await migrateCollection('customers', 'customers');
    await migrateCollection('products', 'products');
    await migrateCollection('materials', 'materials');
    await migrateCollection('orders', 'orders');
    await migrateCollection('simpleExpenses', 'simple_expenses');
    await migrateCollection('userRoles', 'user_roles');

    console.log('\n🎉 All migration tasks completed!');
}

startMigration();
