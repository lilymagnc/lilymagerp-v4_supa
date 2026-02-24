-- 1. 직원 금융/계약 정보 테이블 (기존 인사 데이터와 분리)
CREATE TABLE IF NOT EXISTS public.employee_financials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employment_type TEXT NOT NULL DEFAULT '정규직', -- '정규직', '프리랜서', '아르바이트'
    salary_type TEXT NOT NULL DEFAULT '월급', -- '월급', '시급'
    base_salary NUMERIC NOT NULL DEFAULT 0, -- 기본급 또는 시급 금액
    bank_name TEXT, -- 주거래 은행
    account_number TEXT, -- 계좌 번호
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id) -- 직원당 1개의 금융 정보만 존재하도록 제한
);

-- RLS 정책 설정
ALTER TABLE public.employee_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "최고 관리자만 조회 및 수정 가능" ON public.employee_financials
    FOR ALL
    USING (
      (auth.jwt() ->> 'email' = 'lilymag0301@gmail.com') OR
      (auth.jwt() ->> 'email' IN (SELECT email FROM user_roles WHERE role IN ('hq_manager', 'admin')))
    );

-- 2. 월별 급여/용역 대금 명세서(정산) 테이블
CREATE TABLE IF NOT EXISTS public.salary_statements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    branch_name TEXT NOT NULL, -- 비용 처리될 지점
    payment_year_month TEXT NOT NULL, -- 예: '2026-02'
    employment_type TEXT NOT NULL, -- 결제 당시의 고용 형태 (정규직, 프리랜서 등)
    
    -- 지급 항목
    base_pay NUMERIC DEFAULT 0, -- 지급 기본급
    overtime_pay NUMERIC DEFAULT 0, -- 연장 수당 등
    meal_allowance NUMERIC DEFAULT 0, -- 식대 (비과세)
    custom_allowance_name TEXT, -- 기타 수당명
    custom_allowance NUMERIC DEFAULT 0, -- 기타 수당액
    gross_pay NUMERIC DEFAULT 0, -- 총 지급액 (세전)
    
    -- 공제 항목 (4대보험 & 세금)
    national_pension NUMERIC DEFAULT 0, -- 국민연금 (과세 4.5%)
    health_insurance NUMERIC DEFAULT 0, -- 건강보험 (과세 3.545%)
    long_term_care NUMERIC DEFAULT 0, -- 장기요양 (건보료의 12.95%)
    employment_insurance NUMERIC DEFAULT 0, -- 고용보험 (과세 0.9%)
    income_tax NUMERIC DEFAULT 0, -- 소득세 (간이세액표)
    local_income_tax NUMERIC DEFAULT 0, -- 지방소득세 (소득세 10%)
    
    freelancer_tax NUMERIC DEFAULT 0, -- 프리랜서 3.3% 사업소득세 (미적용 시 0)
    
    total_deductions NUMERIC DEFAULT 0, -- 총 공제액
    net_pay NUMERIC DEFAULT 0, -- 실 수령액 (세후)
    
    status TEXT DEFAULT 'draft', -- 'draft'(임시저장), 'confirmed'(확정/비용반영됨)
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(employee_id, payment_year_month) -- 동일 직원은 같은 월에 한 번만 정산
);

-- RLS 정책 설정
ALTER TABLE public.salary_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "급여 명세서는 최고 관리자만 접근 가능" ON public.salary_statements
    FOR ALL
    USING (
      (auth.jwt() ->> 'email' = 'lilymag0301@gmail.com') OR
      (auth.jwt() ->> 'email' IN (SELECT email FROM user_roles WHERE role IN ('hq_manager', 'admin')))
    );

-- 3. 트리거: 변경 시간 자동 업데이트
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_employee_financials_modtime
    BEFORE UPDATE ON public.employee_financials
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

CREATE TRIGGER update_salary_statements_modtime
    BEFORE UPDATE ON public.salary_statements
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
