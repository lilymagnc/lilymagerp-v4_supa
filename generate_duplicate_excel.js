
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllOrders(start, end) {
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .gte('order_date', start.toISOString())
            .lte('order_date', end.toISOString())
            .range(from, from + 999);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
    }
    return all;
}

async function generate() {
    console.log('📊 Generating Duplicate Orders Excel for Review (Jan 2026)...');

    const start = new Date('2025-12-31T15:00:00Z');
    const end = new Date('2026-01-31T14:59:59Z');

    const orders = await getAllOrders(start, end);
    console.log(`- Total orders fetched: ${orders.length}`);

    // Grouping for duplicates
    const groups = new Map();
    orders.forEach(o => {
        const datePart = o.order_date ? o.order_date.split('T')[0] : 'NoDate';
        const name = o.orderer?.name || '익명/미입력';
        const total = o.summary?.total || 0;
        const branch = o.branch_name || '지점불명';
        const firstItem = (o.items && o.items[0]?.name) || '상품명없음';

        // Fingerprint for potential duplicates
        const fingerprint = `${datePart}|${name}|${total}|${branch}|${firstItem}`;

        if (!groups.has(fingerprint)) groups.set(fingerprint, []);
        groups.get(fingerprint).push(o);
    });

    const excelData = [];
    let groupIdCounter = 1;

    groups.forEach((list, fp) => {
        if (list.length > 1) {
            // Sort by creation time to help user decide which one is original
            list.sort((a, b) => new Date(a.order_date || 0) - new Date(b.order_date || 0));

            list.forEach((o, index) => {
                excelData.push({
                    '그룹ID': groupIdCounter,
                    '유형': index === 0 ? '원본의심(최초)' : '중복의심',
                    '주문날짜(KST)': o.order_date ? new Date(o.order_date).toLocaleString('ko-KR') : '',
                    '지점': o.branch_name,
                    '주문자명': o.orderer?.name || '',
                    '금액': o.summary?.total || 0,
                    '상품명(첫항목)': (o.items && o.items[0]?.name) || '',
                    '상태': o.status,
                    '결제상태': o.payment?.status || '',
                    '주문번호': o.order_number || '',
                    '관리ID(삭제시필요)': o.id,
                    '비고': `해당 그룹 총 ${list.length}건 발견`
                });
            });
            groupIdCounter++;
        }
    });

    if (excelData.length === 0) {
        console.log('✅ No duplicates found based on the criteria.');
        return;
    }

    console.log(`- Identified ${excelData.length} records in ${groupIdCounter - 1} duplicate groups.`);

    // Create Workbook
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    const wscols = [
        { wch: 8 },  // 그룹ID
        { wch: 15 }, // 유형
        { wch: 25 }, // 주문날짜
        { wch: 15 }, // 지점
        { wch: 15 }, // 주문자명
        { wch: 12 }, // 금액
        { wch: 30 }, // 상품명
        { wch: 10 }, // 상태
        { wch: 10 }, // 결제상태
        { wch: 15 }, // 주문번호
        { wch: 25 }, // 관리ID
        { wch: 20 }  // 비고
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "1월 중복주문 검토");

    const fileName = 'January_Duplicates_Review_2026.xlsx';
    XLSX.writeFile(wb, fileName);

    console.log(`\n✅ Excel file created: ${fileName}`);
    console.log('이 파일을 열어 그룹ID가 같은 항목들을 비교하신 후, 중복이라고 확신되는 행의 관리ID를 알려주시면 정리해드리겠습니다.');
    process.exit(0);
}

generate().catch(console.error);
