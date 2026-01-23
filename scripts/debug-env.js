
const dotenv = require('dotenv');
const path = require('path');
const result = dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
console.log('Loaded keys:', Object.keys(result.parsed || {}));
