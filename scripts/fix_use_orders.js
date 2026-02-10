const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('src/hooks/use-orders.ts');
const cleanPath = path.resolve('src/hooks/use-orders.clean.ts');

let content = fs.readFileSync(targetPath, 'utf8');
const cleanContent = fs.readFileSync(cleanPath, 'utf8');

// Marker for start of garbage
const startMarker = '// ... (keeping existing mapRowToOrder';
const startIndex = content.indexOf(startMarker);

// Marker for end of garbage. 
// It ends with '});' and next line starts 'const fetchOrders'.
// But we need to be careful.
// Let's find 'const fetchOrders = useCallback'.
const endMarker = 'const fetchOrders = useCallback';
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found!');
    console.log('Start:', startIndex, 'End:', endIndex);
    process.exit(1);
}

console.log('Replacing from', startIndex, 'to', endIndex);

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

let newContent = before + cleanContent + '\n\n' + after;

// Also update useEffect to use initialFetch
// Current useEffect might look like:
// useEffect(() => {
//     fetchOrders();
//   }, [fetchOrders]);

const useEffectOld = `useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);`;

const useEffectNew = `useEffect(() => {
    if (initialFetch) {
      fetchOrders();
    }
  }, [fetchOrders, initialFetch]);`;

// Try to replace useEffect. Note: whitespace might vary.
// We can use regex or just append if we can't find it?
// Actually, earlier failed edits might have left it standard.
// Let's try simple replacement.

if (newContent.includes('fetchOrders();')) {
    // It seems useEffect is there.
    // Let's try to find the block.
    // Simple regex replacement
    newContent = newContent.replace(
        /useEffect\(\(\) => \{\s*fetchOrders\(\);\s*\}, \[fetchOrders\]\);/g,
        useEffectNew
    );
}

fs.writeFileSync(targetPath, newContent, 'utf8');
console.log('Fixed use-orders.ts');
