
-- [1] BUDGETS 테이블 생성
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER,
    allocated_amount NUMERIC DEFAULT 0,
    used_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    branch_id TEXT,
    branch_name TEXT,
    department_id TEXT,
    department_name TEXT,
    approval_limits JSONB, -- { manager: 0, director: 0 ... }
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to budgets" ON public.budgets FOR ALL USING (true) WITH CHECK (true);


-- [2] POINT_HISTORY 테이블 생성 (고객 포인트 이력)
CREATE TABLE IF NOT EXISTS public.point_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_contact TEXT,
    previous_points INTEGER DEFAULT 0,
    new_points INTEGER DEFAULT 0,
    difference INTEGER DEFAULT 0,
    reason TEXT,
    modifier TEXT, -- 수정자 (직원)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.point_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to point_history" ON public.point_history FOR ALL USING (true) WITH CHECK (true);
