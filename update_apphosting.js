const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const url = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.replace(/[^A-Za-z0-9+\/=\-_.]/g, '');

const yaml = `kind: "AppHostingYaml"
apiVersion: "v1"

env:
  - variable: NEXT_PUBLIC_SUPABASE_URL
    value: "${url}"
  - variable: NEXT_PUBLIC_SUPABASE_ANON_KEY
    value: "${key}"
`;

fs.writeFileSync('apphosting.yaml', yaml);
console.log('apphosting.yaml updated with clean values.');
console.log('Cleaned Key Length:', key.length);
