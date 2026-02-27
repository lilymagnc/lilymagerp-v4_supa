import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateGreenCategories() {
    console.log('Fetching all materials...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name, main_category, mid_category')
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

    const toUpdate = [];

    for (const item of allMaterials) {
        const name = item.name;

        if (name.includes('소재')) {
            const targetMain = '생화';
            const targetMid = '소재(그린)';

            if (item.main_category !== targetMain || item.mid_category !== targetMid) {
                toUpdate.push({
                    id: item.id,
                    name: item.name,
                    newMain: targetMain,
                    newMid: targetMid
                });
            }
        }
    }

    console.log(`${toUpdate.length} materials contain "소재" and need category update.`);

    if (toUpdate.length === 0) {
        console.log('No updates needed.');
        return;
    }

    let totalUpdated = 0;
    let batchCount = 0;

    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ main_category: item.newMain, mid_category: item.newMid })
            .eq('id', item.id);

        if (error) {
            console.error(`Error updating id ${item.id} (${item.name}):`, error);
        } else {
            totalUpdated++;
            batchCount++;
            if (batchCount % 50 === 0) {
                console.log(`...Updated ${totalUpdated} / ${toUpdate.length}...`);
            }
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials categories updated to "소재(그린)": ${totalUpdated}`);
}

updateGreenCategories().catch(console.error);
