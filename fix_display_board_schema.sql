-- Display Board 테이블 재생성 및 권한 부여 스크립트
-- Supabase SQL Editor에서 실행해주세요.

-- 1. 기존 테이블 삭제 (필요한 경우)
DROP TABLE IF EXISTS display_board;

-- 2. 테이블 새로 생성
CREATE TABLE display_board (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 3. RLS(Row Level Security) 활성화
ALTER TABLE display_board ENABLE ROW LEVEL SECURITY;

-- 4. 권한 설정 (모든 사용자 읽기 가능, 인증된 사용자 쓰기 가능)
CREATE POLICY "Enable read access for all users" ON display_board FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON display_board FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON display_board FOR UPDATE USING (auth.role() = 'authenticated');

-- 5. 실시간(Realtime) 구독 활성화 (중요: 전광판 기능을 위해 필수)
alter publication supabase_realtime add table display_board;
