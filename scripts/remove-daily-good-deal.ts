import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function removeDailyGoodDeal() {
    console.log('Fetching materials containing "데일리굿딜"...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .ilike('name', '%데일리굿딜%')
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

    console.log(`Found ${allMaterials.length} materials with "데일리굿딜" in their name.`);

    if (allMaterials.length === 0) {
        console.log('No materials to update.');
        return;
    }

    const toUpdate = [];

    for (const item of allMaterials) {
        // Remove "데일리굿딜"
        let newName = item.name.replace(/데일리굿딜/g, '');

        // Clean up resulting weird formatting like "장미 -  나이팅게일", "장미 -나이팅게일" 
        // Double spaces to single space
        newName = newName.replace(/\s+/g, ' ');
        // Adjust hyphens if they are left hanging
        newName = newName.replace(/-\s*-/g, '-');
        newName = newName.replace(/장미\s*-\s*/, '장미 - '); // ensuring spacing around hyphen post removal

        newName = newName.trim();

        if (item.name !== newName) {
            toUpdate.push({
                id: item.id,
                oldName: item.name,
                newName: newName
            });
        }
    }

    console.log(`Prepared ${toUpdate.length} materials for name update. Previews:`);
    for (let i = 0; i < Math.min(10, toUpdate.length); i++) {
        console.log(`  "${toUpdate[i].oldName}"  =>  "${toUpdate[i].newName}"`);
    }

    let totalUpdated = 0;
    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ name: item.newName })
            .eq('id', item.id);

        if (error) {
            console.error(`Error updating id ${item.id} (${item.oldName}):`, error);
        } else {
            totalUpdated++;
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials updated this run: ${totalUpdated}`);
}

removeDailyGoodDeal().catch(console.error);
