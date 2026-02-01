
-- Add missing columns to orders table

DO $$
BEGIN
    -- [1] order_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type') THEN
        ALTER TABLE public.orders ADD COLUMN order_type TEXT DEFAULT 'store';
    END IF;

    -- [2] is_anonymous
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_anonymous') THEN
        ALTER TABLE public.orders ADD COLUMN is_anonymous BOOLEAN DEFAULT false;
    END IF;

    -- [3] register_customer
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'register_customer') THEN
        ALTER TABLE public.orders ADD COLUMN register_customer BOOLEAN DEFAULT false;
    END IF;

    -- [4] actual_delivery_cost (Standard)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'actual_delivery_cost') THEN
        ALTER TABLE public.orders ADD COLUMN actual_delivery_cost NUMERIC DEFAULT 0;
    END IF;

    -- [5] actual_delivery_cost_cash (Cash Payment to Driver)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'actual_delivery_cost_cash') THEN
        ALTER TABLE public.orders ADD COLUMN actual_delivery_cost_cash NUMERIC DEFAULT 0;
    END IF;

    -- [6] delivery_cost_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_cost_status') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_cost_status TEXT DEFAULT 'pending';
    END IF;
    
    -- [7] delivery_profit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_profit') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_profit NUMERIC DEFAULT 0;
    END IF;

    -- [8] outsource_info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'outsource_info') THEN
         ALTER TABLE public.orders ADD COLUMN outsource_info JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- [9] transfer_info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'transfer_info') THEN
        ALTER TABLE public.orders ADD COLUMN transfer_info JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    -- [10] receipt_type (Should exist but checking)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'receipt_type') THEN
        ALTER TABLE public.orders ADD COLUMN receipt_type TEXT DEFAULT 'store_pickup';
    END IF;

END $$;
