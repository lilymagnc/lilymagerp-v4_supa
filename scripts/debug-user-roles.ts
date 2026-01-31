
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUserRoles() {
    console.log('Checking user_roles table...');

    // Count rows
    const { count, error: countError } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error counting user_roles:', countError);
    } else {
        console.log(`Total rows in user_roles: ${count}`);
    }

    // Check for duplicates
    const { data: roles, error: fetchError } = await supabase
        .from('user_roles')
        .select('email, id');

    if (fetchError) {
        console.error('Error fetching user_roles:', fetchError);
        return;
    }

    if (roles) {
        const emailCounts: Record<string, number> = {};
        roles.forEach((r: any) => {
            const email = r.email || 'unknown';
            emailCounts[email] = (emailCounts[email] || 0) + 1;
        });

        const duplicates = Object.entries(emailCounts).filter(([_, c]) => c > 1);
        if (duplicates.length > 0) {
            console.log('Found duplicates by email:', duplicates);
        } else {
            console.log('No duplicates found by email.');
        }
    }
}

checkUserRoles();
