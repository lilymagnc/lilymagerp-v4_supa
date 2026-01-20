const fs = require('fs');
const content = fs.readFileSync('c:/lilymagerp-v3/src/hooks/use-orders.ts', 'utf8');

try {
    // This is a very basic check, won't work perfectly for TS but might catch basic brace issues
    let braces = 0;
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') braces++;
        if (content[i] === '}') braces--;
    }
    console.log('Brace count:', braces);

    // Check if useOrders is actually visible
    if (content.indexOf('export function useOrders') !== -1) {
        console.log('Found useOrders export');
    }
} catch (e) {
    console.error(e);
}
