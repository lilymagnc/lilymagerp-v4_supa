import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateChrysanthemumCategories() {
    console.log('Fetching materials containing specific flower types...');

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
        let newMain = '';
        let newMid = '';

        if (item.name.includes('국화') || item.name.includes('퐁퐁') || item.name.includes('소국')) {
            newMain = '생화';
            newMid = '국화류';
        }

        if (newMain && newMid) {
            // Check if it already has the correct categories
            if (item.main_category !== newMain || item.mid_category !== newMid) {
                toUpdate.push({
                    id: item.id,
                    name: item.name,
                    newMain,
                    newMid
                });
            }
        }
    }

    console.log(`${toUpdate.length} materials need category update.`);

    let totalUpdated = 0;
    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ main_category: item.newMain, mid_category: item.newMid })
            .eq('id', item.id);

        if (error) {
            console.error(`Error updating id ${item.id} (${item.name}):`, error);
        } else {
            totalUpdated++;
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials updated this run: ${totalUpdated}`);
}

updateChrysanthemumCategories().catch(console.error);
