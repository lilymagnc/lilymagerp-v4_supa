import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cleanName(name: string) {
    let clean = name.toLowerCase();

    // Remove common modifiers
    const modifiers = [
        '(수입)', '(국산)', '(중국)', '(베트남)', '(콜롬비아)', '(에콰도르)', '(네덜란드)',
        '(월플)', '월플', '수입',
        '1단', '반단', '10대', '5대', '1+1', '특', '상', '중', '하'
    ];

    for (const mod of modifiers) {
        const escapedMod = mod.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        clean = clean.replace(new RegExp(`\\s*${escapedMod}\\s*`, 'g'), ' ');
    }

    // Remove special characters like -, (, ), [, ]
    clean = clean.replace(/[()\[\]\-]/g, ' ');

    // Condense multiple spaces
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
}

async function analyzeSimilarNames() {
    console.log('Fetching all materials for analysis...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .range(from, from + step - 1);

        if (error || !materials || materials.length === 0) break;
        allMaterials = allMaterials.concat(materials);
        from += step;
    }

    const grouped: { [baseName: string]: string[] } = {};

    for (const item of allMaterials) {
        const baseName = cleanName(item.name);
        if (!grouped[baseName]) {
            grouped[baseName] = [];
        }
        grouped[baseName].push(item.name);
    }

    // Filter out groups with only 1 item
    const similarGroups = Object.entries(grouped)
        .filter(([_, names]) => names.length > 1)
        // Optional: Only show groups where actual names are different (not just exact duplicates)
        .filter(([_, names]) => new Set(names).size > 1)
        .sort((a, b) => b[1].length - a[1].length);

    let count = 0;
    console.log('\n--- SIMILAR NAMES ANALYSIS TOP 20 ---');
    for (const [baseName, names] of similarGroups.slice(0, 20)) {
        console.log(`\nBase Name [ ${baseName} ] (${names.length} items)`);
        const uniqueNames = Array.from(new Set(names));
        uniqueNames.forEach(n => console.log(`  - ${n}`));
        count += names.length;
    }

    console.log(`\nFound ${similarGroups.length} groups with potential variations.`);
}

analyzeSimilarNames().catch(console.error);
