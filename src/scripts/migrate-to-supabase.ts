import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

// .env.local 파일 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase URL 또는 Anon Key가 없습니다. .env.local 파일을 확인하세요.');
    process.exit(1);
}

// Firebase Admin 초기화
const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ [오류] service-account.json 파일이 루트 디렉토리에 없습니다.');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    databaseURL: "https://lilymagerp-fs1-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.firestore();
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 테이블별 명시적 컬럼 정의 (이외의 필드는 extra_data로 이동)
const tableSchema: Record<string, string[]> = {
    'branches': ['id', 'name', 'type', 'address', 'phone', 'manager', 'business_number', 'employee_count', 'delivery_fees', 'surcharges', 'account', 'seeded', 'extra_data', 'created_at'],
    'customers': ['id', 'name', 'contact', 'company_name', 'address', 'email', 'grade', 'memo', 'points', 'type', 'birthday', 'wedding_anniversary', 'founding_anniversary', 'first_visit_date', 'other_anniversary_name', 'other_anniversary', 'anniversary', 'special_notes', 'monthly_payment_day', 'total_spent', 'order_count', 'primary_branch', 'branch', 'branches', 'is_deleted', 'extra_data', 'created_at', 'updated_at', 'last_order_date'],
    'orders': ['id', 'order_number', 'status', 'receipt_type', 'branch_id', 'branch_name', 'order_date', 'orderer', 'delivery_info', 'pickup_info', 'summary', 'payment', 'items', 'memo', 'transfer_info', 'actual_delivery_cost', 'extra_data', 'created_at', 'updated_at', 'completed_at', 'completed_by'],
    'simple_expenses': ['id', 'expense_date', 'amount', 'category', 'sub_category', 'description', 'supplier', 'quantity', 'unit_price', 'branch_id', 'branch_name', 'receipt_url', 'receipt_file_name', 'related_request_id', 'is_auto_generated', 'inventory_updates', 'extra_data', 'created_at', 'updated_at'],
    'materials': ['id', 'name', 'main_category', 'mid_category', 'unit', 'spec', 'price', 'stock', 'size', 'color', 'memo', 'branch', 'supplier', 'extra_data', 'created_at', 'updated_at'],
    'products': ['id', 'doc_id', 'name', 'main_category', 'mid_category', 'price', 'supplier', 'stock', 'size', 'color', 'branch', 'code', 'category', 'status', 'extra_data', 'created_at', 'updated_at'],
};

// 유틸리티: camelCase를 snake_case로 변환
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// 유틸리티: 데이터를 Supabase 테이블 구조에 맞게 매핑
const mapToTable = (table: string, data: any) => {
    const allowedColumns = tableSchema[table];
    if (!allowedColumns) return data; // 스크립트에 컬럼 정의가 없으면 그대로 반환 (위험)

    const mapped: any = { extra_data: {} };
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

// 유틸리티: Firebase 데이터를 Supabase 형식으로 변환 (Admin SDK 타입 대응 및 키 매핑)
const transformData = (data: any) => {
    if (!data || typeof data !== 'object') return data;

    const transformed: any = {};
    for (const key in data) {
        let value = data[key];
        let mappedKey = toSnakeCase(key);

        // Admin SDK의 Timestamp 처리
        if (value && typeof value === 'object' && value.constructor.name === 'Timestamp') {
            transformed[mappedKey] = (value as admin.firestore.Timestamp).toDate().toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor.name !== 'Object') {
            // 특수한 Firestore 객체들 처리
            transformed[mappedKey] = JSON.stringify(value);
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            transformed[mappedKey] = transformData(value);
        } else if (Array.isArray(value)) {
            transformed[mappedKey] = value.map(item => (typeof item === 'object' ? transformData(item) : item));
        } else {
            transformed[mappedKey] = value;
        }
    }
    return transformed;
};

const collectionMappings: Record<string, { table: string, transform?: (data: any) => any }> = {
    'branches': { table: 'branches' },
    'users': { table: 'users' },
    'userRoles': { table: 'user_roles' },
    'customers': { table: 'customers' },
    'pointHistory': {
        table: 'point_history',
        transform: (data) => {
            return { ...data, created_at: data.timestamp };
        }
    },
    'orders': { table: 'orders' },
    'orderTransfers': { table: 'order_transfers' },
    'expenseRequests': { table: 'expense_requests' },
    'simpleExpenses': {
        table: 'simple_expenses',
        transform: (data) => {
            return { ...data, expense_date: data.date };
        }
    },
    'fixedCostTemplates': { table: 'fixed_cost_templates' },
    'materials': { table: 'materials' },
    'products': { table: 'products' },
    'stockHistory': {
        table: 'stock_history',
        transform: (data) => {
            return { ...data, occurred_at: data.date };
        }
    },
    'materialRequests': { table: 'material_requests' },
    'partners': { table: 'partners' },
    'employees': { table: 'employees' },
    'calendarEvents': { table: 'calendar_events' },
    'quotations': { table: 'quotations' },
    'categories': { table: 'categories' },
    'supplierSuggestions': { table: 'supplier_suggestions' },
    'albums': { table: 'albums' },
    'checklistTemplates': { table: 'checklist_templates' },
    'checklists': {
        table: 'checklists',
        transform: (data) => {
            return { ...data, record_date: data.date };
        }
    },
    'workers': { table: 'workers' },
    'auditLogs': { table: 'audit_logs' },
    'inventoryNotifications': { table: 'inventory_notifications' },
};

async function migrateCollection(firebaseColl: string, mapping: any) {
    console.log(`\n📦 [${firebaseColl}] 마이그레이션 시작...`);
    try {
        const snapshot = await db.collection(firebaseColl).get();
        console.log(`📊 발견된 문서: ${snapshot.size}개`);

        if (snapshot.empty) return;

        const dataToInsert = snapshot.docs.map(doc => {
            let data = { id: doc.id, ...doc.data() };
            data = transformData(data);
            if (mapping.transform) {
                data = mapping.transform(data);
            }

            // 예약어 및 구 필드 정리
            if (firebaseColl === 'simpleExpenses' || firebaseColl === 'stockHistory' || firebaseColl === 'checklists') {
                delete (data as any).date;
            }
            if (firebaseColl === 'pointHistory' || firebaseColl === 'auditLogs') {
                delete (data as any).timestamp;
            }

            // 테이블 구조에 맞춰 여분의 데이터는 extra_data로 격리
            data = mapToTable(mapping.table, data);

            return data;
        });

        const batchSize = 50;
        for (let i = 0; i < dataToInsert.length; i += batchSize) {
            const batch = dataToInsert.slice(i, i + batchSize);
            const { error } = await supabase.from(mapping.table).upsert(batch);
            if (error) {
                console.error(`❌ [${mapping.table}] 삽입 오류:`, error.message);
            } else {
                process.stdout.write(`⏳ 처리 중: ${Math.min(i + batchSize, dataToInsert.length)}/${dataToInsert.length}\r`);
            }
        }
        console.log(`\n✅ [${firebaseColl}] 완료!`);
    } catch (error) {
        console.error(`❌ [${firebaseColl}] 마이그레이션 실패:`, error);
    }
}

async function migratePhotos() {
    console.log(`\n📦 [Photos (Subcollection Group)] 마이그레이션 시작...`);
    try {
        const snapshot = await db.collectionGroup('photos').get();
        if (snapshot.empty) return;
        const dataToInsert = snapshot.docs.map(doc => {
            const albumId = doc.ref.parent.parent?.id;
            return transformData({ id: doc.id, album_id: albumId, ...doc.data() });
        });
        for (let i = 0; i < dataToInsert.length; i += 50) {
            await supabase.from('photos').upsert(dataToInsert.slice(i, i + 50));
        }
        console.log(`✅ [Photos] 완료!`);
    } catch (error) { }
}

async function migrateSystemSettings() {
    console.log(`\n📦 [System Settings] 마이그레이션 시작...`);
    try {
        const doc = await db.collection('system').doc('settings').get();
        if (doc.exists) {
            const data = transformData(doc.data());
            await supabase.from('system_settings').upsert({ id: 'settings', data });
            console.log(`✅ [System Settings] 완료!`);
        }
    } catch (error) { }
}

async function startMigration() {
    console.log('🚀 === Firebase Admin 기반 마이그레이션 시작 ===');
    for (const [firebaseColl, mapping] of Object.entries(collectionMappings)) {
        await migrateCollection(firebaseColl, mapping);
    }
    await migratePhotos();
    await migrateSystemSettings();
    console.log('\n🎉 === 모든 마이그레이션 작업이 완료되었습니다! ===');
}

startMigration();
