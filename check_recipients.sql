
-- Check if recipients table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'recipients'
) as table_exists;

-- Force schema cache reload by notifying pgrst
NOTIFY pgrst, 'reload config';
