require('dotenv').config({ path: '.env.local' });

console.log('Checking SUPABASE_SERVICE_ROLE_KEY...');
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`Key is PRESENT (starts with ${key.substring(0, 10)}...)`);
    if (key === 'dummy-key') {
        console.log('WARNING: Key is "dummy-key"!');
    }
} else {
    console.log('Key is MISSING or UNDEFINED in .env.local');
}

console.log('Checking NEXT_PUBLIC_SUPABASE_URL...');
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log(`URL is PRESENT: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
} else {
    console.log('URL is MISSING or UNDEFINED in .env.local');
}
