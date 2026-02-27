import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function removeDuplicates() {
    console.log('Fetching all materials...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .range(from, from + step - 1);

        if (error) {
            console.error(`Error fetching materials from ${from}:`, error);
            return;
        }

        if (!materials || materials.length === 0) {
            break;
        }

        allMaterials = allMaterials.concat(materials);
        from += step;
    }

    console.log(`Found ${allMaterials.length} total materials.`);

    const nameMap = new Map<string, any[]>();
    for (const item of allMaterials) {
        const name = item.name.trim(); // Trim spaces around exact names just in case
        if (!nameMap.has(name)) {
            nameMap.set(name, []);
        }
        nameMap.get(name)!.push(item);
    }

    let totalDeleted = 0;

    for (const [name, items] of nameMap.entries()) {
        if (items.length > 1) {
            console.log(`Duplicate found for "${name}": ${items.length} items. Keep 1, delete ${items.length - 1}`);
            // Keep the first one, delete the rest
            const idsToDelete = items.slice(1).map(i => i.id);

            const { error: deleteError } = await supabase
                .from('materials')
                .delete()
                .in('id', idsToDelete);

            if (deleteError) {
                console.error(`Error deleting duplicates for ${name}:`, deleteError);
            } else {
                totalDeleted += idsToDelete.length;
            }
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total duplicates deleted this run: ${totalDeleted}`);
}

removeDuplicates().catch(console.error);
