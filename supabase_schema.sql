-- LilyMag ERP Supabase Schema

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS inventory_notifications;
DROP TABLE IF EXISTS recipients;
DROP TABLE IF EXISTS display_board;
DROP TABLE IF EXISTS discount_settings;
DROP TABLE IF EXISTS delivery_fees;
DROP TABLE IF EXISTS workers;
DROP TABLE IF EXISTS checklists;
DROP TABLE IF EXISTS checklist_templates;
DROP TABLE IF EXISTS daily_settlements;
DROP TABLE IF EXISTS photso; -- Typo in some previous drops?
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS albums;
DROP TABLE IF EXISTS budgets;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS quotations;
DROP TABLE IF EXISTS calendar_events;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS partners;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS purchase_batches;
DROP TABLE IF EXISTS material_requests;
DROP TABLE IF EXISTS stock_history;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS materials;
DROP TABLE IF EXISTS supplier_suggestions;
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
DROP TABLE IF EXISTS daily_stats;

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
    seeded BOOLEAN DEFAULT FALSE,
    extra_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 사용자 정보(Users)
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
    anniversary TEXT,
    special_notes TEXT,
    monthly_payment_day TEXT,
    total_spent BIGINT DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    primary_branch TEXT,
    branch TEXT,
    branches JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    extra_data JSONB,
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
    branch_id TEXT,
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
    actual_delivery_cost BIGINT,
    extra_data JSONB,
    outsource_info JSONB,
    actual_delivery_cost_cash BIGINT,
    delivery_cost_status TEXT,
    delivery_cost_updated_at TIMESTAMP WITH TIME ZONE,
    delivery_cost_updated_by TEXT,
    delivery_cost_reason TEXT,
    delivery_profit BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by TEXT
);

-- 7. 주문 이관 이력(Order Transfers)
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
    extra_data JSONB,
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
    extra_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. 상품(Products)
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    doc_id TEXT,
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
    extra_data JSONB,
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
    requester_id TEXT,
    requester_name TEXT,
    items JSONB,
    actual_purchase JSONB,
    delivery JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. 구매 배치(Purchase Batches)
CREATE TABLE purchase_batches (
    id TEXT PRIMARY KEY,
    batch_number TEXT,
    purchase_date TIMESTAMP WITH TIME ZONE,
    purchaser_id TEXT,
    purchaser_name TEXT,
    included_requests TEXT[],
    purchased_items JSONB,
    total_cost BIGINT DEFAULT 0,
    delivery_plan JSONB,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. 알림(Notifications)
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

-- 17. 거래처(Partners)
CREATE TABLE partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    category TEXT,
    contact TEXT,
    contact_person TEXT,
    email TEXT,
    address TEXT,
    business_number TEXT,
    ceo_name TEXT,
    bank_account TEXT,
    branch TEXT,
    items TEXT,
    memo TEXT,
    default_margin_percent INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. 직원(Employees)
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

-- 19. 일정(Calendar Events)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 20. 견적서(Quotations)
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

-- 21. 카테고리(Categories)
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT, -- 'main', 'mid'
    parent_category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. 시스템 설정(System Settings)
CREATE TABLE system_settings (
    id TEXT PRIMARY KEY DEFAULT 'settings',
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 23. 앨범(Albums)
CREATE TABLE albums (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    photo_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT TRUE,
    thumbnail_url TEXT,
    branch_id TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 24. 사진(Photos)
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    album_id TEXT REFERENCES albums(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    preview_url TEXT,
    name TEXT,
    filename TEXT,
    size BIGINT,
    width INTEGER,
    height INTEGER,
    "order" INTEGER,
    type TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 25. 예산(Budgets)
CREATE TABLE budgets (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    fiscal_year INTEGER,
    fiscal_month INTEGER,
    allocated_amount BIGINT,
    used_amount BIGINT DEFAULT 0,
    remaining_amount BIGINT,
    branch_id TEXT,
    branch_name TEXT,
    department_id TEXT,
    department_name TEXT,
    approval_limits JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 26. 체크리스트 기록(Checklists)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 27. 일일 정산(Daily Settlements)
CREATE TABLE daily_settlements (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    branch_name TEXT,
    date TEXT,
    settlement_data JSONB,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 28. 체크리스트 템플릿(Checklist Templates)
CREATE TABLE checklist_templates (
    id TEXT PRIMARY KEY,
    name TEXT,
    category TEXT,
    items JSONB,
    branch_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 29. 근무자(Workers)
CREATE TABLE workers (
    id TEXT PRIMARY KEY,
    name TEXT,
    branch_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 30. 배송비(Delivery Fees)
CREATE TABLE delivery_fees (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    branch_name TEXT,
    district TEXT,
    fee BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 31. 할인 설정(Discount Settings)
CREATE TABLE discount_settings (
    id TEXT PRIMARY KEY DEFAULT 'settings',
    data JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 32. 전광판(Display Board)
CREATE TABLE display_board (
    id TEXT PRIMARY KEY,
    type TEXT,
    title TEXT,
    content TEXT,
    branch_id TEXT,
    branch_name TEXT,
    priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    transfer_id TEXT,
    order_id TEXT,
    deactivated_at TIMESTAMP WITH TIME ZONE,
    extra_data JSONB
);

-- 33. 수령자(Recipients)
CREATE TABLE recipients (
    id TEXT PRIMARY KEY,
    name TEXT,
    contact TEXT,
    address TEXT,
    district TEXT,
    branch_name TEXT,
    order_count INTEGER DEFAULT 0,
    last_order_date TIMESTAMP WITH TIME ZONE,
    email TEXT,
    marketing_consent BOOLEAN DEFAULT FALSE,
    source TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 34. 재고 알림(Inventory Notifications)
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

-- 35. 감사 로그(Audit Logs)
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

-- 36. 지점별 통계(Daily Stats)
CREATE TABLE daily_stats (
    date TEXT PRIMARY KEY,
    total_order_count INTEGER DEFAULT 0,
    total_revenue BIGINT DEFAULT 0,
    total_settled_amount BIGINT DEFAULT 0,
    branches JSONB DEFAULT '{}',
    extra_data JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 37. 통계 업데이트 RPC(increment_daily_stats)
CREATE OR REPLACE FUNCTION increment_daily_stats(
    p_date TEXT,
    p_branch_key TEXT,
    p_order_count_delta INTEGER,
    p_revenue_delta BIGINT,
    p_settled_amount_delta BIGINT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_stats (
        date, 
        total_order_count, 
        total_revenue, 
        total_settled_amount, 
        branches,
        last_updated
    )
    VALUES (
        p_date, 
        p_order_count_delta, 
        p_revenue_delta, 
        p_settled_amount_delta, 
        jsonb_build_object(p_branch_key, jsonb_build_object(
            'orderCount', p_order_count_delta,
            'revenue', p_revenue_delta,
            'settledAmount', p_settled_amount_delta
        )),
        NOW()
    )
    ON CONFLICT (date) DO UPDATE SET
        total_order_count = daily_stats.total_order_count + p_order_count_delta,
        total_revenue = daily_stats.total_revenue + p_revenue_delta,
        total_settled_amount = daily_stats.total_settled_amount + p_settled_amount_delta,
        branches = jsonb_set(
            CASE 
                WHEN daily_stats.branches ? p_branch_key THEN daily_stats.branches 
                ELSE daily_stats.branches || jsonb_build_object(p_branch_key, jsonb_build_object('orderCount', 0, 'revenue', 0, 'settledAmount', 0))
            END,
            ARRAY[p_branch_key],
            jsonb_build_object(
                'orderCount', (COALESCE((daily_stats.branches->p_branch_key->>'orderCount')::INTEGER, 0) + p_order_count_delta),
                'revenue', (COALESCE((daily_stats.branches->p_branch_key->>'revenue')::BIGINT, 0) + p_revenue_delta),
                'settledAmount', (COALESCE((daily_stats.branches->p_branch_key->>'settledAmount')::BIGINT, 0) + p_settled_amount_delta)
            )
        ),
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- 38. 공급업체 제안(Supplier Suggestions)
CREATE TABLE supplier_suggestions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 추가 인덱스
CREATE INDEX idx_users_franchise ON users(franchise);
CREATE INDEX idx_customers_contact ON customers(contact);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_order_transfers_status ON order_transfers(status);
CREATE INDEX idx_expense_requests_branch ON expense_requests(branch_id);
CREATE INDEX idx_simple_expenses_branch ON simple_expenses(branch_id);
CREATE INDEX idx_simple_expenses_date ON simple_expenses(expense_date);
CREATE INDEX idx_materials_branch ON materials(branch);
CREATE INDEX idx_products_branch ON products(branch);
CREATE INDEX idx_stock_history_occurred_at ON stock_history(occurred_at);
CREATE INDEX idx_calendar_events_start ON calendar_events(start_date);
CREATE INDEX idx_photos_album_id ON photos(album_id);
CREATE INDEX idx_checklists_branch_date ON checklists(branch_id, record_date);
CREATE INDEX idx_daily_settlements_branch_date ON daily_settlements(branch_id, date);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_branch_id ON notifications(branch_id);
