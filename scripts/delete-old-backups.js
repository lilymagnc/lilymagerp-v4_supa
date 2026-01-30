const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupGeneralBackups() {
    console.log('--- Cleaning up redundant backups in "general/backups" ---');

    try {
        // 1. List all folders in general/backups
        let { data: folders, error: lError } = await supabase.storage.from('general').list('backups', { limit: 1000 });
        if (lError) throw lError;

        if (!folders || folders.length === 0) {
            console.log('No backups found in general/backups.');
            return;
        }

        console.log(`Found ${folders.length} backup folders to remove.`);

        for (const folder of folders) {
            console.log(`Processing folder: backups/${folder.name}`);

            // List files inside the folder
            const { data: files, error: fError } = await supabase.storage.from('general').list(`backups/${folder.name}`);
            if (fError) {
                console.error(`Error listing files in ${folder.name}:`, fError.message);
                continue;
            }

            if (files && files.length > 0) {
                const pathsToDelete = files.map(f => `backups/${folder.name}/${f.name}`);
                console.log(`Deleting ${pathsToDelete.length} files...`);

                const { error: dError } = await supabase.storage.from('general').remove(pathsToDelete);
                if (dError) {
                    console.error(`Failed to delete files in ${folder.name}:`, dError.message);
                } else {
                    console.log(`Successfully cleared folder: ${folder.name}`);
                }
            } else {
                console.log(`Folder ${folder.name} is already empty.`);
            }
        }

        console.log('\n✅ Redundant "general/backups" storage has been cleared.');

    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanupGeneralBackups();
