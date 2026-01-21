const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function testInsert() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Testing insert into "branches"...');
    const { data, error } = await supabase
        .from('branches')
        .insert([{ id: 'test-branch', name: 'Test Branch' }]);

    if (error) {
        console.error('❌ Insert failed:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        console.error('Code:', error.code);
    } else {
        console.log('✅ Insert successful!', data);

        // Cleanup
        await supabase.from('branches').delete().eq('id', 'test-branch');
        console.log('Cleaned up test record.');
    }
}

testInsert();
