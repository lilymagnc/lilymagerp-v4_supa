-- Discount Settings 테이블 재생성 및 데이터 컬럼 추가를 위한 스크립트
-- 이 스크립트를 Supabase SQL Editor에서 실행해주세요.

-- 1. 기존 테이블이 있다면 삭제 (데이터가 손실될 수 있으므로 주의, 하지만 현재 구조가 잘못되었으므로 재생성 권장)
DROP TABLE IF EXISTS discount_settings;

-- 2. 테이블 새로 생성
CREATE TABLE discount_settings (
    id TEXT PRIMARY KEY DEFAULT 'settings',
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 초기 기본값 설정 (선택사항, 앱에서 자동으로 생성하지만 미리 넣어두면 좋음)
INSERT INTO discount_settings (id, data)
VALUES ('settings', '{
    "globalSettings": {
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2030-12-31T23:59:59.999Z",
        "allowDuplicateDiscount": false,
        "allowPointAccumulation": true,
        "minOrderAmount": 10000
    },
    "branchSettings": {}
}'::jsonb);

-- 4. 권한 부여 (필요한 경우)
ALTER TABLE discount_settings ENABLE ROW LEVEL SECURITY;

-- 4-1. 모든 사용자가 읽을 수 있도록 허용 (또는 인증된 사용자만)
CREATE POLICY "Enable read access for all users" ON discount_settings FOR SELECT USING (true);

-- 4-2. 인증된 사용자(관리자 등)만 수정 가능하도록 허용 (여기서는 간단히 모든 인증된 사용자에게 insert/update 허용 예시)
CREATE POLICY "Enable insert for authenticated users only" ON discount_settings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON discount_settings FOR UPDATE USING (auth.role() = 'authenticated');
