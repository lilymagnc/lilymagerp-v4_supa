const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('.env.local'));
const url = env.NEXT_PUBLIC_SUPABASE_URL.trim();
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY.replace(/[^A-Za-z0-9+\/=\-_.]/g, '');
const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
const privateKey = env.GOOGLE_PRIVATE_KEY?.replace(/\n/g, '\\n').replace(/\"/g, ''); 
const sheetId = env.NEXT_PUBLIC_GOOGLE_SHEET_ID?.trim();


const yaml = `kind: "AppHostingYaml"
apiVersion: "v1"

env:
  - variable: NEXT_PUBLIC_SUPABASE_URL
    value: "${url}"
  - variable: NEXT_PUBLIC_SUPABASE_ANON_KEY
    value: "${key}"
  - variable: GOOGLE_SERVICE_ACCOUNT_EMAIL
    value: "${email}"
  - variable: GOOGLE_PRIVATE_KEY
    value: "${privateKey}"
  - variable: NEXT_PUBLIC_GOOGLE_SHEET_ID
    value: "${sheetId}"
`;

fs.writeFileSync('apphosting.yaml', yaml);
console.log('apphosting.yaml updated with clean values.');
console.log('Cleaned Key Length:', key.length);
