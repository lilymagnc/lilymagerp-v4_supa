import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BRANCHES = [
    { name: '릴리맥여의도점', code: '1' },
    { name: '릴리맥여의도2호점', code: '2' },
    { name: '릴리맥광화문점', code: '3' },
    { name: '릴리맥NC이스트폴점', code: '4' }
];

const itemsToUpdate = [
    { newName: '장미 수입 버터컵', oldNames: ['장미 버터컵'], price: 15000, stock: 1, supplier: '꽃동산-양재', color: null },
    { newName: '장미 수입 프라우드', oldNames: [], price: 18000, stock: 1, supplier: '월드플로라', color: '레드' },
    { newName: '장미 수입 - 몬디알 화이트', oldNames: ['장미 - 몬디알'], price: 16500, stock: 1, supplier: '월드플로라', color: '기타' },
    { newName: '미니장미 수입 블랙뷰티 SP중국', oldNames: ['미니장미 - 블랙뷰티 SP', '미니장미 블랙뷰티 Sp'], price: 16500, stock: 1, supplier: '월드플로라', color: '블랙' },
    { newName: '미니장미 수입 가넷잼 sp', oldNames: ['미니장미 가넷잼 sp'], price: 24000, stock: 1, supplier: '미지정', color: null },
    { newName: '장미 수입 만달라', oldNames: ['장미 만달라'], price: 15000, stock: 5, supplier: '꽃동산-양재', color: null },
    { newName: '장미 수입 모멘텀', oldNames: ['장미 모멘텀'], price: 17000, stock: 3, supplier: '꽃동산-양재', color: null },
    { newName: '미니장미 수입 스카이풀스타연핑크sp중국', oldNames: ['미니장미 스카이풀스타연핑크sp'], price: 23800, stock: 1, supplier: '미지정', color: '핑크' },
    { newName: '미니장미 수입 아모니루sp', oldNames: ['미니장미 아모니루sp'], price: 16500, stock: 1, supplier: '미지정', color: null },
    { newName: '미니장미 수입 아프리콧 테라자sp중국', oldNames: ['미니장미 아프리콧 테라자sp'], price: 15840, stock: 1, supplier: '미지정', color: null },
    { newName: '장미 수입 옐로비치', oldNames: ['장미 옐로비치'], price: 15000, stock: 15, supplier: 'J.S플라워', color: '기타' },
    { newName: '미니장미 수입 올드로즈판타지 딸기 sp (중국)', oldNames: ['미니장미 올드로즈판타지 딸기 sp', '미니장미 올드로즈판타지 딸기 sp (중국)'], price: 15800, stock: 1, supplier: '월드플로라', color: '기타' },
    { newName: '미니장미 수입 치어걸sp 중국', oldNames: ['장미 치어걸sp'], price: 15840, stock: 1, supplier: '미지정', color: null },
    { newName: '장미 수입 캔들라이트', oldNames: ['장미 캔들라이트'], price: 15000, stock: 6, supplier: '꽃동산-양재', color: null },
    { newName: '장미 수입 컨트리블루스', oldNames: ['장미 컨트리블루스'], price: 19000, stock: 2, supplier: '미지정', color: '블루' },
    { newName: '미니장미 수입 코랄테라자sp(중국)', oldNames: ['장미 코랄테라자'], price: 16500, stock: 1, supplier: '미지정', color: null },
    { newName: '장미 수입 코럴리프', oldNames: ['장미 코럴리프'], price: 15000, stock: 1, supplier: 'JS플라워', color: '기타' },
    { newName: '장미 수입 프리덤', oldNames: ['장미 프리덤'], price: 15000, stock: 4, supplier: '꽃동산-양재', color: null },
    { newName: '미니장미 수입 프린세스 미스틱sp', oldNames: ['장미 프린세스 미스틱sp'], price: 18048, stock: 2, supplier: '월드플로라', color: '기타' },
    { newName: '미니장미 수입 프린세스 블러셔sp', oldNames: ['장미 프린세스 블러셔sp', '미니장미 - 프린세스 블러셔 sp'], price: 18500, stock: 1, supplier: '월드플로라', color: null },
    { newName: '미니장미 수입 프린세스스키 sp중국', oldNames: [], price: 0, stock: 0, supplier: '월드플로라', color: '핑크' },
    { newName: '미니장미 수입 피치테라자 SP', oldNames: ['미니장미 피치테라자 SP'], price: 16500, stock: 1, supplier: '월드플로라', color: '핑크' },
    { newName: '미니장미 수입 화이트버블sp중국', oldNames: ['미니장미 화이트버블sp'], price: 17760, stock: 3, supplier: '월드플로라', color: '흰색' },
];

async function main() {
    let nextSeq = 194;
    const pattern = 'MF1';

    for (const item of itemsToUpdate) {
        console.log(`Processing: ${item.newName}`);
        
        // Find existing ones
        const { data: existing } = await supabase
            .from('materials')
            .select('id, name, branch')
            .or(`name.eq."${item.newName}",name.in.(${item.oldNames.map(n => `"${n}"`).join(',')})`);

        if (existing && existing.length > 0) {
            console.log(`  Found ${existing.length} existing records. Updating...`);
            for (const rec of existing) {
                await supabase.from('materials').update({
                    name: item.newName,
                    price: item.price,
                    stock: item.stock,
                    color: item.color,
                    supplier: item.supplier,
                    updated_at: new Date().toISOString()
                }).eq('id', rec.id);
            }
        } else {
            console.log(`  No existing records found. Creating new for all 4 branches...`);
            const seqStr = String(nextSeq++).padStart(4, '0');
            const newRecords = BRANCHES.map(branch => ({
                id: `${pattern}${seqStr}${branch.code}`,
                name: item.newName,
                main_category: '생화',
                mid_category: '장미류',
                price: item.price,
                stock: item.stock,
                color: item.color,
                supplier: item.supplier,
                branch: branch.name,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }));
            await supabase.from('materials').insert(newRecords);
        }
    }
    console.log("Done!");
}

main();
