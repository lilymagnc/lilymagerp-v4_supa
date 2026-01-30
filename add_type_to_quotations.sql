
-- Add 'type' column to quotations table
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'quotation';
