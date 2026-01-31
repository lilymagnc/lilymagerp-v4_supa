-- Fix hr_documents table to use TEXT for IDs (for Firebase Sync compatibility)
DROP TABLE IF EXISTS public.hr_documents CASCADE;

CREATE TABLE public.hr_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- Changed from UUID to TEXT to accept Firebase UIDs
    user_name TEXT,
    document_type TEXT NOT NULL,
    submission_date TIMESTAMPTZ DEFAULT now(),
    status TEXT DEFAULT '처리중',
    contents JSONB,
    file_url TEXT,
    original_file_name TEXT,
    submission_method TEXT,
    extracted_from_file BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to hr_documents" ON public.hr_documents FOR ALL USING (true) WITH CHECK (true);

-- Fix email_templates table to use TEXT for IDs
DROP TABLE IF EXISTS public.email_templates CASCADE;

CREATE TABLE public.email_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    content TEXT,
    category TEXT,
    is_html BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    created_by TEXT,
    variables TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to email_templates" ON public.email_templates FOR ALL USING (true) WITH CHECK (true);
