const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkGeneral() {
    const { data: files } = await supabase.storage.from('general').list('', { limit: 50 });
    console.log('Sample files in "general" bucket:');
    files.forEach(f => {
        if (f.metadata) {
            console.log(`- ${f.name} (${(f.metadata.size / 1024).toFixed(1)} KB)`);
        } else {
            console.log(`- [DIR] ${f.name}`);
        }
    });
}
checkGeneral();
