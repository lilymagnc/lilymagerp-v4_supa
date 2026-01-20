-- 기존 테이블 삭제 (초기화용, 순서 주의: 외래 키 참조 관계 고려)
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS inventory_notifications;
DROP TABLE IF EXISTS workers;
DROP TABLE IF EXISTS checklists;
DROP TABLE IF EXISTS checklist_templates;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS supplier_suggestions;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS quotations;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS partners;
DROP TABLE IF EXISTS material_requests;
DROP TABLE IF EXISTS stock_history;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS fixed_cost_templates;
DROP TABLE IF EXISTS simple_expenses;
DROP TABLE IF EXISTS expense_requests;
DROP TABLE IF EXISTS order_transfers;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS point_history;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS branches;

-- 1. 지점(Branches)
CREATE TABLE branches (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT,
    address TEXT,
    phone TEXT,
    manager TEXT,
    business_number TEXT,
    employee_count INTEGER,
    delivery_fees JSONB,
    surcharges JSONB,
    account TEXT,
    seeded BOOLEAN DEFAULT FALSE, -- 추가
    extra_data JSONB, -- 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 사용자 정보(Users) - 파이어베이스 Auth 보조용
CREATE TABLE users (
    email TEXT PRIMARY KEY,
    name TEXT,
    role TEXT,
    franchise TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 사용자 권한(User Roles)
CREATE TABLE user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- email
    email TEXT,
    role TEXT,
    permissions JSONB,
    branch_id TEXT,
    branch_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 고객(Customers)
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    company_name TEXT,
    address TEXT,
    email TEXT,
    grade TEXT DEFAULT '신규',
    memo TEXT,
    points INTEGER DEFAULT 0,
    type TEXT DEFAULT 'personal',
    birthday TEXT,
    wedding_anniversary TEXT,
    founding_anniversary TEXT,
    first_visit_date TEXT,
    other_anniversary_name TEXT,
    other_anniversary TEXT,
    anniversary TEXT, -- 추가
    special_notes TEXT,
    monthly_payment_day TEXT,
    total_spent BIGINT DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    primary_branch TEXT,
    branch TEXT, -- 추가 (단일 지점 배정용)
    branches JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    extra_data JSONB, -- 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_order_date TIMESTAMP WITH TIME ZONE
);

-- 5. 포인트 이력(Point History)
CREATE TABLE point_history (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    customer_name TEXT,
    customer_contact TEXT,
    previous_points INTEGER,
    new_points INTEGER,
    difference INTEGER,
    reason TEXT,
    modifier TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 주문(Orders)
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_number TEXT,
    status TEXT DEFAULT 'processing',
    receipt_type TEXT,
    branch_id TEXT, -- 추가
    branch_name TEXT,
    order_date TIMESTAMP WITH TIME ZONE,
    orderer JSONB,
    delivery_info JSONB,
    pickup_info JSONB,
    summary JSONB,
    payment JSONB,
    items JSONB,
    memo TEXT,
    transfer_info JSONB,
    actual_delivery_cost BIGINT, -- 추가
    extra_data JSONB, -- 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT
);

-- 7. 이관 내역(Order Transfers)
CREATE TABLE order_transfers (
    id TEXT PRIMARY KEY,
    original_order_id TEXT,
    order_branch_id TEXT,
    order_branch_name TEXT,
    process_branch_id TEXT,
    process_branch_name TEXT,
    transfer_date TIMESTAMP WITH TIME ZONE,
    transfer_reason TEXT,
    transfer_by TEXT,
    transfer_by_user TEXT,
    status TEXT DEFAULT 'pending',
    amount_split JSONB,
    original_order_amount BIGINT,
    notes TEXT,
    accepted_at TIMESTAMP WITH TIME ZONE,
    accepted_by TEXT,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancelled_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 비용 신청(Expense Requests)
CREATE TABLE expense_requests (
    id TEXT PRIMARY KEY,
    request_number TEXT,
    status TEXT DEFAULT 'pending',
    branch_id TEXT,
    branch_name TEXT,
    total_amount BIGINT DEFAULT 0,
    total_tax_amount BIGINT DEFAULT 0,
    items JSONB,
    approval_records JSONB,
    required_approval_level INTEGER,
    current_approval_level INTEGER DEFAULT 1,
    fiscal_year INTEGER,
    fiscal_month INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method TEXT,
    payment_date TEXT,
    payment_reference TEXT
);

-- 9. 간편 지출(Simple Expenses)
CREATE TABLE simple_expenses (
    id TEXT PRIMARY KEY,
    expense_date TIMESTAMP WITH TIME ZONE,
    amount BIGINT,
    category TEXT,
    sub_category TEXT,
    description TEXT,
    supplier TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price BIGINT DEFAULT 0,
    branch_id TEXT,
    branch_name TEXT,
    receipt_url TEXT,
    receipt_file_name TEXT,
    related_request_id TEXT,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    inventory_updates JSONB,
    extra_data JSONB, -- 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. 고정비 템플릿(Fixed Cost Templates)
CREATE TABLE fixed_cost_templates (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    branch_name TEXT,
    items JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. 자재(Materials)
CREATE TABLE materials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    main_category TEXT,
    mid_category TEXT,
    unit TEXT,
    spec TEXT,
    price BIGINT DEFAULT 0,
    stock INTEGER DEFAULT 0,
    size TEXT, 
    color TEXT,
    memo TEXT,
    branch TEXT,
    supplier TEXT,
    extra_data JSONB, -- 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. 상품(Products)
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    doc_id TEXT, -- Firebase doc id
    name TEXT NOT NULL,
    main_category TEXT,
    mid_category TEXT,
    price BIGINT DEFAULT 0,
    supplier TEXT,
    stock INTEGER DEFAULT 0,
    size TEXT,
    color TEXT,
    branch TEXT,
    code TEXT,
    category TEXT,
    status TEXT,
    extra_data JSONB, -- 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. 재고 이력(Stock History)
CREATE TABLE stock_history (
    id TEXT PRIMARY KEY,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type TEXT, -- 'in', 'out', 'manual_update'
    item_type TEXT, -- 'material', 'product'
    item_id TEXT,
    item_name TEXT,
    quantity INTEGER,
    from_stock INTEGER,
    to_stock INTEGER,
    resulting_stock INTEGER,
    branch TEXT,
    operator TEXT,
    supplier TEXT,
    price BIGINT,
    total_amount BIGINT,
    related_request_id TEXT,
    notes TEXT
);

-- 14. 자재 요청(Material Requests)
CREATE TABLE material_requests (
    id TEXT PRIMARY KEY,
    request_number TEXT,
    status TEXT,
    branch_id TEXT,
    branch_name TEXT,
    items JSONB,
    total_estimated_amount BIGINT,
    requested_at TIMESTAMP WITH TIME ZONE,
    actual_delivery JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. 거래처(Partners)
CREATE TABLE partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    contact TEXT,
    contact_person TEXT,
    email TEXT,
    address TEXT,
    branch TEXT,
    items TEXT,
    memo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. 직원(Employees)
CREATE TABLE employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    position TEXT,
    department TEXT,
    contact TEXT,
    address TEXT,
    hire_date TIMESTAMP WITH TIME ZONE,
    birth_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. 일정(Calendar Events)
CREATE TABLE calendar_events (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    branch_name TEXT,
    status TEXT,
    related_id TEXT,
    color TEXT,
    is_all_day BOOLEAN,
    created_by TEXT,
    created_by_role TEXT,
    created_by_branch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. 견적서(Quotations)
CREATE TABLE quotations (
    id TEXT PRIMARY KEY,
    quotation_number TEXT,
    customer_id TEXT,
    customer_name TEXT,
    customer_contact TEXT,
    branch_id TEXT,
    items JSONB,
    total_amount BIGINT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 19. 카테고리(Categories)
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- 'main', 'mid'
    parent_category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 20. 시스템 설정(System Settings)
CREATE TABLE system_settings (
    id TEXT PRIMARY KEY DEFAULT 'settings',
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. 앨범(Albums)
CREATE TABLE albums (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT, -- 추가
    photo_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    thumbnail_url TEXT,
    branch_id TEXT, -- 추가
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 23. 사진(Photos) - 앨범 하위 데이터
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    album_id TEXT REFERENCES albums(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    thumbnail_url TEXT, -- 추가
    preview_url TEXT, -- 추가
    name TEXT,
    filename TEXT, -- 추가
    size BIGINT,
    width INTEGER, -- 추가
    height INTEGER, -- 추가
    "order" INTEGER, -- 추가
    type TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 24. 체크리스트 기록(Checklist Records)
CREATE TABLE checklists (
    id TEXT PRIMARY KEY,
    template_id TEXT,
    branch_id TEXT,
    branch_name TEXT,
    record_date TEXT,
    week TEXT,
    month TEXT,
    category TEXT,
    open_worker TEXT,
    close_worker TEXT,
    responsible_person TEXT,
    items JSONB,
    completed_by TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT,
    notes TEXT,
    weather TEXT,
    special_events TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 27. 감사 로그(Audit Logs)
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    action TEXT,
    entity_type TEXT,
    entity_id TEXT,
    entity_name TEXT,
    branch_id TEXT,
    branch_name TEXT,
    operator_id TEXT,
    operator_name TEXT,
    details JSONB,
    user_agent TEXT
);

-- 28. 재고 알림(Inventory Notifications)
CREATE TABLE inventory_notifications (
    id TEXT PRIMARY KEY,
    type TEXT,
    material_id TEXT,
    material_name TEXT,
    branch_id TEXT,
    branch_name TEXT,
    current_stock INTEGER,
    threshold INTEGER,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 29. 일반 알림(Notifications)
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    type TEXT,
    sub_type TEXT,
    title TEXT,
    message TEXT,
    severity TEXT,
    user_id TEXT,
    user_role TEXT,
    branch_id TEXT,
    department_id TEXT,
    related_id TEXT,
    related_type TEXT,
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN DEFAULT FALSE,
    auto_expire BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 추가 인덱스
CREATE INDEX idx_users_franchise ON users(franchise);
CREATE INDEX idx_customers_contact ON customers(contact);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_branch_name ON orders(branch_name);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_simple_expenses_date ON simple_expenses(expense_date);
CREATE INDEX idx_simple_expenses_branch_id ON simple_expenses(branch_id);
CREATE INDEX idx_stock_history_item_id ON stock_history(item_id);
CREATE INDEX idx_stock_history_occurred_at ON stock_history(occurred_at);
CREATE INDEX idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX idx_checklists_record_date ON checklists(record_date);
CREATE INDEX idx_photos_album_id ON photos(album_id);

-- 34. 배송비 설정(Delivery Fees)
CREATE TABLE delivery_fees (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
    branch_name TEXT,
    district TEXT NOT NULL,
    fee INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 35. 할인 설정(Discount Settings)
CREATE TABLE discount_settings (
    id TEXT PRIMARY KEY DEFAULT 'settings',
    global_settings JSONB,
    branch_settings JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_delivery_fees_branch_id ON delivery_fees(branch_id);

-- 30. 고정비 템플릿(Fixed Cost Templates) 제거됨 (상단 중첩)

-- 31. 구매처 자동완성(Supplier Suggestions)
CREATE TABLE supplier_suggestions (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    frequency INTEGER DEFAULT 1,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fixed_cost_templates_branch_id ON fixed_cost_templates(branch_id);
CREATE INDEX idx_supplier_suggestions_name ON supplier_suggestions(name);

-- 32. 체크리스트 템플릿(Checklist Templates)
CREATE TABLE checklist_templates (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    items JSONB,
    branch_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 33. 근무자 목록(Workers)
CREATE TABLE workers (
    id TEXT PRIMARY KEY,
    name TEXT,
    branch_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_checklist_templates_branch_id ON checklist_templates(branch_id);
CREATE INDEX idx_workers_branch_id ON workers(branch_id);
