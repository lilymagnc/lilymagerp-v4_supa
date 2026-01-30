const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkGeneralBackups() {
    const { data: files } = await supabase.storage.from('general').list('backups', { limit: 20 });
    console.log('Files in "general/backups":');
    files.forEach(f => {
        if (f.metadata) {
            console.log(`- ${f.name} (${(f.metadata.size / 1024).toFixed(1)} KB)`);
        } else {
            console.log(`- [DIR] ${f.name}`);
        }
    });
}
checkGeneralBackups();
