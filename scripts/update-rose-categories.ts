import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateRoseCategories() {
    console.log('Fetching materials containing "장미"...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name, main_category, mid_category')
            .ilike('name', '%장미%')
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

    console.log(`Found ${allMaterials.length} materials with "장미" in their name.`);

    // Filter those that are not already "생화 / 장미류"
    const toUpdate = allMaterials.filter(m => m.main_category !== '생화' || m.mid_category !== '장미류');

    console.log(`${toUpdate.length} materials need category update.`);

    let totalUpdated = 0;
    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ main_category: '생화', mid_category: '장미류' })
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

updateRoseCategories().catch(console.error);
