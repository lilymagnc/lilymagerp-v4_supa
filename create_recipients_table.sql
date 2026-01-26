
-- 1. Create recipients table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact TEXT,
    address TEXT,
    detail_address TEXT,
    zip_code TEXT,
    branch_name TEXT,
    memo TEXT,
    last_order_date TIMESTAMPTZ,
    order_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_recipients_branch_name ON public.recipients(branch_name);
CREATE INDEX IF NOT EXISTS idx_recipients_contact ON public.recipients(contact);
CREATE INDEX IF NOT EXISTS idx_recipients_name ON public.recipients(name);

-- 3. Enable RLS
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

-- 4. Create policy to allow all access (for now, similar to other tables in this project)
CREATE POLICY "Enable all access for authenticated users" ON public.recipients
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Enable read access for anon" ON public.recipients
    FOR SELECT
    TO anon
    USING (true);

-- 5. Force schema reload
NOTIFY pgrst, 'reload config';
