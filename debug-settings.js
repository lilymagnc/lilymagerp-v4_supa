
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSettings() {
    const { data, error } = await supabase.from('system_settings').select('data').eq('id', 'settings').single();
    if (error) {
        console.error(error);
    } else {
        const s = data.data;
        console.log('Site Name:', s.siteName);
        console.log('Contact Email:', s.contactEmail);
        console.log('Contact Phone:', s.contactPhone);
        console.log('Keys:', Object.keys(s));
    }
}

checkSettings();
