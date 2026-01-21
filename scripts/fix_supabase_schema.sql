-- Run this SQL in your Supabase SQL Editor to add missing columns to the orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_delivery_cost_cash BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_updated_by TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_cost_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_profit BIGINT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS outsource_info JSONB;
