import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function processFittoniaData() {
    const idsToRename = {
        'Ew0dVhctJ1YBQhLAp8nf': '피토니아-화이트스타', // previously '화이트스타'
        'MAT1770340160762': '피토니아-레드스타'       // previously '레드스타'
    };

    const idsToKeep = Object.keys(idsToRename);

    // Rename the specified items
    for (const id of Object.keys(idsToRename)) {
        const newName = idsToRename[id as keyof typeof idsToRename];
        console.log(`Renaming ${id} to ${newName}`);
        const { error } = await supabase.from('materials').update({ name: newName }).eq('id', id);
        if (error) console.error(error);
    }

    console.log('Fetching remaining to delete...');
    // Find all remaining materials to delete
    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;
    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name')
            .range(from, from + step - 1);
        if (error) return;
        if (!materials || materials.length === 0) break;
        allMaterials = allMaterials.concat(materials);
        from += step;
    }

    const targetsToDelete = allMaterials.filter(m => {
        // If it's one of the items we renamed and kept, do not delete it
        if (idsToKeep.includes(m.id)) return false;

        // Delete others containing related string
        const lowerName = m.name.toLowerCase();
        if (
            lowerName.includes('화이트스타') ||
            lowerName.includes('레드스타') ||
            lowerName.includes('피토니아') ||
            lowerName.includes('휘토니아') ||
            lowerName.includes('화이트레드스타')
        ) {
            return true;
        }
        return false;
    });

    const idsToDelete = targetsToDelete.map(t => t.id);

    if (idsToDelete.length > 0) {
        console.log(`Deleting ${idsToDelete.length} remaining items:`, targetsToDelete);
        const { error: deleteError } = await supabase
            .from('materials')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) {
            console.error('Delete error:', deleteError);
        } else {
            console.log('Successfully deleted related items.');
        }
    } else {
        console.log('No remaining items to delete.');
    }

    console.log('----------------------------------------------------');
    console.log('Job Complete!');
}

processFittoniaData().catch(console.error);
