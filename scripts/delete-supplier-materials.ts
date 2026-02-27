import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function deleteSpecificSupplierMaterials() {
    console.log('Fetching all materials...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name, supplier')
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

    // Filter materials where supplier contains '노플라워' or '다이소'
    const toDelete = allMaterials.filter(m => {
        const supplier = m.supplier || '';
        return supplier.includes('노플라워') || supplier.includes('다이소');
    });

    console.log(`Found ${toDelete.length} materials from '노플라워' or '다이소'.`);

    if (toDelete.length === 0) {
        console.log('No materials to delete.');
        return;
    }

    // Delete them in batches
    const batchSize = 100;
    let totalDeleted = 0;

    for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const idsToDelete = batch.map(item => item.id);

        const { error: deleteError } = await supabase
            .from('materials')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) {
            console.error(`Error deleting batch starting at ${i}:`, deleteError);
        } else {
            totalDeleted += batch.length;
            console.log(`Deleted ${totalDeleted} / ${toDelete.length}...`);
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials deleted this run: ${totalDeleted}`);
}

deleteSpecificSupplierMaterials().catch(console.error);
