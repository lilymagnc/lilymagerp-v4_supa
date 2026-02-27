import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xphvycuaffifjgjaiqxe.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwaHZ5Y3VhZmZpZmpnamFpcXhlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTI0OSwiZXhwIjoyMDg0NDk3MjQ5fQ.nBJ86wD5wyIQaQHZ7UMCq6VAHSCCSzdAZ37e5Ld_y28';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateSupplierData() {
    console.log('Fetching materials data...');

    let allMaterials: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data: materials, error } = await supabase
            .from('materials')
            .select('id, name, supplier, main_category')
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
        let supplier = item.supplier || '';
        let mainCategory = item.main_category || '';

        let needsUpdate = false;
        let newSupplier = supplier;
        let newMainCategory = mainCategory;

        // 1. 공급업체가 헌인꽃자재인 경우 헌인자재로 변경
        if (supplier === '헌인꽃자재') {
            newSupplier = '헌인자재';
            needsUpdate = true;
        }

        // 2. 공급업체 이름(새 이름 포함)에 '자재'가 들어간 경우 1차 카테고리 업데이트
        if (newSupplier.includes('자재')) {
            if (mainCategory !== '소모품 및 부자재') {
                newMainCategory = '소모품 및 부자재';
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            toUpdate.push({
                id: item.id,
                name: item.name,
                newSupplier,
                newMainCategory
            });
        }
    }

    console.log(`${toUpdate.length} materials need supplier/category updates.`);

    // Update them
    let totalUpdated = 0;
    for (const item of toUpdate) {
        const { error } = await supabase
            .from('materials')
            .update({ supplier: item.newSupplier, main_category: item.newMainCategory })
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

updateSupplierData().catch(console.error);
