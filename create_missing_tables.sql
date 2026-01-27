-- [2] POINT_HISTORY 테이블은 이미 생성됨 (생략)


-- [3] EMAIL_TEMPLATES 테이블 생성
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    content TEXT,
    category TEXT, -- 'delivery', 'order', 'status', 'birthday', 'custom'
    is_html BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    created_by TEXT, -- user_id
    variables TEXT[], -- 템플릿 변수 목록
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to email_templates" ON public.email_templates FOR ALL USING (true) WITH CHECK (true);


-- [4] HR_DOCUMENTS 테이블 생성 (인사 서류)
CREATE TABLE IF NOT EXISTS public.hr_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id), -- 수파베이스 Auth 유저와 연결
    user_name TEXT,
    document_type TEXT NOT NULL,
    submission_date TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT '처리중', -- '처리중', '승인', '반려'
    contents JSONB, -- 신청서 상세 내용
    file_url TEXT,
    original_file_name TEXT,
    submission_method TEXT,
    extracted_from_file BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hr_documents" ON public.hr_documents FOR ALL USING (true) WITH CHECK (true);


