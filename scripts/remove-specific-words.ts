import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function removeSpecificWords() {
    console.log('Fetching materials containing "1+1" or "(월플)"...');

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

    const toUpdate = [];

    for (const item of allMaterials) {
        let newName = item.name;

        // Check if name contains 1+1 or (월플)
        if (newName.includes('1+1') || newName.includes('(월플)')) {
            // Remove 1+1
            newName = newName.replace(/1\+1/g, '');
            // Remove (월플)
            newName = newName.replace(/\(월플\)/g, '');

            // Clean up spaces
            newName = newName.replace(/\s+/g, ' ').trim();
            // Keep spaces around hyphens if they were squashed, or clean hanging hyphens
            newName = newName.replace(/-\s*-/g, '-');
            newName = newName.replace(/\s*-\s*$/, ''); // Remove trailing hyphen if it exists

            if (item.name !== newName) {
                toUpdate.push({
                    id: item.id,
                    oldName: item.name,
                    newName: newName
                });
            }
        }
    }

    console.log(`Found ${toUpdate.length} materials to update.`);

    if (toUpdate.length === 0) {
        console.log('No materials to update.');
        return;
    }

    console.log('\nPreviewing first 20 changes:');
    for (let i = 0; i < Math.min(20, toUpdate.length); i++) {
        console.log(`  "${toUpdate[i].oldName}"  =>  "${toUpdate[i].newName}"`);
    }

    let totalUpdated = 0;
    let batchCount = 0;
    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ name: item.newName })
            .eq('id', item.id);

        if (error) {
            console.error(`Error updating id ${item.id} (${item.oldName}):`, error);
        } else {
            totalUpdated++;
            batchCount++;
            if (batchCount % 100 === 0) {
                console.log(`...Updated ${totalUpdated} / ${toUpdate.length}...`);
            }
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials updated this run: ${totalUpdated}`);
}

removeSpecificWords().catch(console.error);
