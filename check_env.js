const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const pureKey = key.replace(/[^A-Za-z0-9+\/=\-_.]/g, '');
console.log('PURE_KEY:', pureKey);
console.log('PURE_LENGTH:', pureKey.length);
console.log('REMOVED_CHARS_COUNT:', key.length - pureKey.length);




