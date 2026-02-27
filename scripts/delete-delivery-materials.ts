import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteDeliveryMaterials() {
    console.log('Fetching materials containing "배송"...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .ilike('name', '%배송%')
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

    console.log(`Found ${allMaterials.length} materials with "배송" in their name.`);

    if (allMaterials.length === 0) {
        console.log('No materials to delete.');
        return;
    }

    // Delete them in batches
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < allMaterials.length; i += batchSize) {
        const batch = allMaterials.slice(i, i + batchSize);
        const idsToDelete = batch.map(item => item.id);

        const { error: deleteError } = await supabase
            .from('materials')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) {
            console.error(`Error deleting batch starting at ${i}:`, deleteError);
        } else {
            totalDeleted += batch.length;
            console.log(`Deleted ${totalDeleted} / ${allMaterials.length}...`);
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials deleted this run: ${totalDeleted}`);
}

deleteDeliveryMaterials().catch(console.error);
