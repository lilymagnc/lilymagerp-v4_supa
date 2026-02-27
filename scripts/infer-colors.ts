import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Define color mappings based on keywords
const colorKeywords: { [key: string]: string[] } = {
    '흰색': ['화이트', '백색', '흰색', '스노우', '크림'],
    '핑크': ['핑크', '연핑크', '진핑크', '분홍', '피치', '살구'],
    '옐로우': ['노랑', '노란', '옐로우', '골드'],
    '레드': ['레드', '빨강', '빨간', '적색', '다크레드'],
    '오렌지': ['오렌지', '주황', '망고'],
    '블루': ['블루', '파랑', '파란', '연블루', '청색'],
    '퍼플': ['퍼플', '보라', '연보라', '라벤더', '바이올렛'],
    '그린': ['그린', '연그린', '초록', '청록'],
    '블랙': ['블랙', '검정', '검은'],
    '실버': ['실버', '은색'],
    '브라운': ['브라운', '갈색', '초코'],
};

async function inferAndUpdateColors() {
    console.log('Fetching all materials...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name, color')
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
        const name = item.name.toLowerCase();
        const currentColor = item.color || '';

        // Only infer color if it's currently empty or we want to normalize it
        let foundColor = '';

        // Find matching color from keywords
        for (const [standardColor, keywords] of Object.entries(colorKeywords)) {
            if (keywords.some(keyword => name.includes(keyword))) {
                foundColor = standardColor;
                break; // Stop at first match (assumes most prominent color)
            }
        }

        if (foundColor && currentColor !== foundColor) {
            toUpdate.push({
                id: item.id,
                name: item.name,
                newColor: foundColor,
                oldColor: currentColor
            });
        }
    }

    console.log(`${toUpdate.length} materials matched a color name and need update.`);

    if (toUpdate.length === 0) {
        console.log('No updates needed.');
        return;
    }

    let totalUpdated = 0;
    let batchCount = 0;

    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ color: item.newColor })
            .eq('id', item.id);

        if (error) {
            console.error(`Error updating id ${item.id} (${item.name}):`, error);
        } else {
            totalUpdated++;
            batchCount++;
            if (batchCount % 100 === 0) {
                console.log(`...Updated ${totalUpdated} / ${toUpdate.length}...`);
            }
        }
    }

    console.log('----------------------------------------------------');
    console.log(`Job Complete. Total materials color updated this run: ${totalUpdated}`);
}

inferAndUpdateColors().catch(console.error);
