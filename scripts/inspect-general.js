const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectGeneral() {
    console.log('--- Inspecting "general" bucket ---');
    const { data: files } = await supabase.storage.from('general').list('', { limit: 20 });
    console.log('First 20 files:');
    files.forEach(f => console.log(`- ${f.name} (${(f.metadata.size / 1024).toFixed(1)} KB)`));
}
inspectGeneral();
