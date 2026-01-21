const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserRole() {
    const email = 'lilymag0301@gmail.com'; // User from screenshot/context
    console.log(`Checking role for ${email}...`);

    const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (error) {
        console.error('Error fetching user role:', error);
        return;
    }

    if (data) {
        console.log('User Role Data:', JSON.stringify(data, null, 2));
    } else {
        console.log('No user role found for this email.');
    }
}

checkUserRole();
