import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkWhite() {
    const { data: materials, error } = await supabase
        .from('materials')
        .select('id, name, color')
        .ilike('name', '%수국 화이트%');

    console.log(materials);

    const { data: m2, error: e2 } = await supabase
        .from('materials')
        .select('id, name, color')
        .ilike('name', '%화이트%')
        .limit(10);

    console.log('Other white:', m2);
}

checkWhite().catch(console.error);
