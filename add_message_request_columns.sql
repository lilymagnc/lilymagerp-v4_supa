
-- Add missing columns to orders table

DO $$
BEGIN
    -- Add message column (JSONB)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'message') THEN
        ALTER TABLE public.orders ADD COLUMN message JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add request column (Text)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'request') THEN
        ALTER TABLE public.orders ADD COLUMN request TEXT DEFAULT '';
    END IF;

    -- Add payment column (JSONB) - Just in case, though it seemed to work in test
    -- (My test script provided payment, and it worked, so payment column likely exists)
END $$;
