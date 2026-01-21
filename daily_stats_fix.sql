-- 36. 지점별 통계(Daily Stats) 생성
CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    total_order_count INTEGER DEFAULT 0,
    total_revenue BIGINT DEFAULT 0,
    total_settled_amount BIGINT DEFAULT 0,
    branches JSONB DEFAULT '{}',
    extra_data JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 37. 통계 업데이트 RPC(increment_daily_stats) 생성
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

-- 권한 부여 (필요한 경우)
-- 권한 부여
GRANT ALL ON TABLE daily_stats TO anon, authenticated, service_role;

-- RLS(Row Level Security) 설정 (혹시 켜져있다면)
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 읽기/쓰기 허용 정책 생성
CREATE POLICY "Enable all access for all users" ON daily_stats
    FOR ALL
    USING (true)
    WITH CHECK (true);
