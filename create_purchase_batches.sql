-- Create purchase_batches table
CREATE TABLE IF NOT EXISTS public.purchase_batches (
    id UUID PRIMARY KEY,
    batch_number TEXT NOT NULL,
    purchase_date TIMESTAMPTZ NOT NULL,
    purchaser_id TEXT,
    purchaser_name TEXT,
    included_requests TEXT[], -- Array of Material Request IDs
    purchased_items JSONB[] DEFAULT '{}', -- Array of ActualPurchaseItem objects
    total_cost NUMERIC DEFAULT 0,
    delivery_plan JSONB[] DEFAULT '{}', -- Array of DeliveryPlanItem objects
    status TEXT DEFAULT 'planning', -- planning, purchasing, completed
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.purchase_batches ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow authenticated users to read purchase_batches" ON public.purchase_batches;
CREATE POLICY "Allow authenticated users to read purchase_batches"
    ON public.purchase_batches
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert purchase_batches" ON public.purchase_batches;
CREATE POLICY "Allow authenticated users to insert purchase_batches"
    ON public.purchase_batches
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update purchase_batches" ON public.purchase_batches;
CREATE POLICY "Allow authenticated users to update purchase_batches"
    ON public.purchase_batches
    FOR UPDATE
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete purchase_batches" ON public.purchase_batches;
CREATE POLICY "Allow authenticated users to delete purchase_batches"
    ON public.purchase_batches
    FOR DELETE
    TO authenticated
    USING (true);
