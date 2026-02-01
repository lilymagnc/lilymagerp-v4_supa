
-- Fix stock_history table schema
-- Add missing columns that might be causing 400 Bad Request on insert

DO $$
BEGIN
    -- [1] type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'type') THEN
        ALTER TABLE public.stock_history ADD COLUMN type TEXT;
    END IF;

    -- [2] item_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'item_type') THEN
        ALTER TABLE public.stock_history ADD COLUMN item_type TEXT;
    END IF;

    -- [3] item_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'item_id') THEN
        ALTER TABLE public.stock_history ADD COLUMN item_id TEXT;
    END IF;

    -- [4] item_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'item_name') THEN
        ALTER TABLE public.stock_history ADD COLUMN item_name TEXT;
    END IF;

    -- [5] quantity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'quantity') THEN
        ALTER TABLE public.stock_history ADD COLUMN quantity NUMERIC DEFAULT 0;
    END IF;

    -- [6] from_stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'from_stock') THEN
        ALTER TABLE public.stock_history ADD COLUMN from_stock NUMERIC DEFAULT 0;
    END IF;

    -- [7] to_stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'to_stock') THEN
        ALTER TABLE public.stock_history ADD COLUMN to_stock NUMERIC DEFAULT 0;
    END IF;

    -- [8] branch
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'branch') THEN
        ALTER TABLE public.stock_history ADD COLUMN branch TEXT;
    END IF;

    -- [9] operator
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'operator') THEN
        ALTER TABLE public.stock_history ADD COLUMN operator TEXT;
    END IF;

    -- [10] price
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'price') THEN
        ALTER TABLE public.stock_history ADD COLUMN price NUMERIC DEFAULT 0;
    END IF;

    -- [11] total_amount
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'total_amount') THEN
        ALTER TABLE public.stock_history ADD COLUMN total_amount NUMERIC DEFAULT 0;
    END IF;

    -- [12] note (Optional but good to have)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_history' AND column_name = 'note') THEN
        ALTER TABLE public.stock_history ADD COLUMN note TEXT;
    END IF;

END $$;
