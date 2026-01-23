-- 1. Orders 테이블 누락된 컬럼 추가
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outsource_info JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_cost_cash BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_updated_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_profit BIGINT;

-- 2. Order Transfers 테이블 누락된 컬럼 추가
ALTER TABLE order_transfers ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 3. Daily Stats 테이블 생성 및 권한 설정 (이미 있는 경우 무시)
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    total_order_count INTEGER DEFAULT 0,
    total_revenue BIGINT DEFAULT 0,
    total_settled_amount BIGINT DEFAULT 0,
    branches JSONB DEFAULT '{}',
    extra_data JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS 비활성화 또는 단순화 (개발 편의를 위해 모든 접근 허용)
ALTER TABLE daily_stats DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE daily_stats TO anon, authenticated, service_role;

-- 4. Material Requests 테이블 누락된 컬럼 추가
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS requester_id TEXT;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS requester_name TEXT;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS actual_purchase JSONB;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS delivery JSONB;
