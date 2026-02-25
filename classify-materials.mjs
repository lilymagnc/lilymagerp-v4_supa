import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fetchAll(table, select = '*') {
    let all = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase.from(table).select(select).range(from, from + 999);
        if (error) { console.error(`Error:`, error); break; }
        if (!data || data.length === 0) break;
        all.push(...data);
        from += 1000;
    }
    return all;
}

// === 분류 키워드 사전 ===

// 생화 (Fresh Flowers) - MF
const freshFlowerKeywords = [
    // 장미류
    '장미', '로즈', 'rose',
    // 카네이션류
    '카네이션',
    // 거베라류
    '거베라',
    // 리시안/리시안셔스
    '리시안', '리시안서스', '리시안셔스',
    // 튤립
    '튤립',
    // 국화/소국
    '국화', '소국', '퐁퐁',
    // 백합
    '백합', '릴리', '오리엔탈',
    // 수국
    '수국',
    // 안개꽃
    '안개', '안개꽃',
    // 과꽃
    '과꽃',
    // 해바라기
    '해바라기',
    // 러넌큘러스
    '러넌큘러스', '라넌큘러스', '라눈',
    // 아네모네
    '아네모네',
    // 작약/피오니
    '작약', '피오니',
    // 델피늄
    '델피', '왕델피',
    // 스톡
    '스톡',
    // 금어초
    '금어초',
    // 알스트로메리아
    '알스트로메리아', '알스트로',
    // 칼라
    '칼라',
    // 프리지아
    '프리지아',
    // 왁스플라워
    '왁스', '왁스플라워',
    // 부바르디아
    '부바르디아',
    // 스타티스
    '스타티스',
    // 히아신스
    '히아신스',
    // 수선화
    '수선화',
    // 아이리스
    '아이리스',
    // 모카라
    '모카라',
    // 글라디올러스
    '글라디올러스',
    // 크라스페디아
    '크라스페디아',
    // 프로테아
    '프로테아', '핀쿠션',
    // 레우카덴드론
    '레우카덴드론',
    // 헬레보루스
    '헬레보루스',
    // 데이지
    '데이지',
    // 다알리아/달리아
    '다알리아', '달리아', '다리아',
    // 용담
    '용담',
    // 에린지움
    '에린지움',
    // 셀로시아/맨드라미
    '셀로시아', '맨드라미',
    // 스카비오사
    '스카비오사',
    // 란타나
    '란타나',
    // 헬레늄
    '헬레늄',
    // 옥시페탈룸
    '옥시페탈', '옥시',
    // 아스타
    '아스타',
    // 아스틸베
    '아스틸베',
    // 아마릴리스
    '아마릴리스',
    // 코스모스
    '코스모스',
    // 블루스타
    '블루스타',
    // 기린초
    '기린초',
    // 센트레아
    '센트레아',
    // 밍크/밍크버들
    '밍크',
    // 미모사
    '미모사',
    // 매화/벚꽃
    '매화', '벚꽃',
    // 목련
    '목련',
    // 무스카리
    '무스카리',
    // 후룩스/플록스
    '후룩스', '플록스',
    // 시네라리아
    '시네라리아',
    // 아가판서스
    '아가판서스',
    // 베로니카
    '베로니카',
    // 디기탈리스
    '디기탈리스',
    // 유칼립투스 (절화)
    '유칼립투스', '유칼립',
    // 피코리니
    '피콜리니',
    // 기타 절화 소재
    '미스홀랜드', '이반호프',
    // 미니장미
    '미니장미',
    // 스프레이
    'sp ', 'sp)',
];

// 분화/식물 (Potted Plants) - MP
const pottedPlantKeywords = [
    '화분', '분화',
    '난', '호접란', '서양란', '심비디움', '동양란', '보석란',
    '금전수', '스투키', '몬스테라', '관엽',
    '다육', '선인장', '다육이',
    '뱅갈', '고무나무', '야자', '아레카',
    '산세베리아', '스킨답서스',
    '안스리움', '안스', '칼라데아',
    '필로덴드론', '극락조',
    '올리브나무', '레몬나무',
    '테이블야자', '켄챠야자',
    '행운목', '행운나무',
    '식물', '초화', '꽃나무',
    '화시아타', '구아바',
];

// 소재/그린 (Greenery/Filler) - 생화의 중분류로 처리
const greeneryKeywords = [
    '유칼립', '루스커스', '미스티블루',
    '아이비', '이탈리안', '스마일락스',
    '라보스타', '레몬잎', '편백',
    '살랄', '피톤', '루비',
    '미스캔서스', '드라세나',
    '아미초',
];

// 자재/소모품 (Supplies) - MM
const supplyKeywords = [
    '포장지', '리본', '쇼핑백',
    '화기', '폿', '바구니', '바스켓',
    '오아시스', '플로랄폼', '플로랄 폼',
    '셀로판', '비닐', '랩',
    '스티커', '카드', '봉투',
    '박스', 'box',
    '테이프', '가위', '칼',
    '글루건', '글루',
    '철사', '와이어',
    '매직', '마커',
    '마사', '마사토', '세척마사',
    '토분', '유리', '도자기',
    '화환', '근조', '축하',
    '캔들', '향초',
    '진기토',
    '워시리필', '핸드워시',
    '커피', '음료',
    '손그림', '오벌',
    '골드라인', '화이트스트라이프',
    '믹소불',
    '미니트리',
];

function classifyMaterial(name, currentMain) {
    if (!name) return null;
    const n = name.toLowerCase().trim();

    // 외부발주 건은 이름에서 유형 추출
    if (n.includes('외부발주')) {
        if (n.includes('분화') || n.includes('화분') || n.includes('난') || n.includes('금전수') || n.includes('스투키'))
            return { main: '분화', mid: '기타' };
        if (n.includes('생화') || n.includes('꽃다발') || n.includes('꽃바구니'))
            return { main: '생화', mid: '기타' };
        return null;
    }

    // 자재/소모품 먼저 체크 (화기, 포장지 등 명확한 것)
    for (const kw of supplyKeywords) {
        if (n.includes(kw.toLowerCase())) return { main: '기타자재', mid: '소모품' };
    }

    // 분화/식물
    for (const kw of pottedPlantKeywords) {
        if (n.includes(kw.toLowerCase())) return { main: '분화', mid: '기타' };
    }

    // 소재/그린
    for (const kw of greeneryKeywords) {
        if (n.includes(kw.toLowerCase())) return { main: '생화', mid: '소재류' };
    }

    // 생화
    for (const kw of freshFlowerKeywords) {
        if (n.includes(kw.toLowerCase())) {
            // 중분류 자동 결정
            let mid = '기타';
            if (n.includes('장미') || n.includes('로즈')) mid = '장미';
            else if (n.includes('카네이션')) mid = '카네이션류';
            else if (n.includes('거베라')) mid = '거베라류';
            else if (n.includes('리시안')) mid = '리시안셔스';
            else if (n.includes('튤립')) mid = '튤립';
            else if (n.includes('국화') || n.includes('소국') || n.includes('퐁퐁')) mid = '국화류';
            else if (n.includes('백합') || n.includes('릴리') || n.includes('오리엔탈')) mid = '백합류';
            else if (n.includes('수국')) mid = '수국';
            else if (n.includes('안개')) mid = '안개꽃';
            else if (n.includes('해바라기')) mid = '해바라기';
            else if (n.includes('러넌') || n.includes('라넌') || n.includes('라눈')) mid = '러넌큘러스';
            else if (n.includes('델피')) mid = '델피늄';
            else if (n.includes('스톡')) mid = '스톡';
            else if (n.includes('프리지아')) mid = '프리지아';
            else if (n.includes('작약') || n.includes('피오니')) mid = '작약/피오니';
            else if (n.includes('금어초')) mid = '금어초';
            else if (n.includes('왁스')) mid = '필러플라워';
            else if (n.includes('칼라')) mid = '칼라';
            else mid = '필러플라워';
            return { main: '생화', mid };
        }
    }

    return null; // 분류 불가
}

async function main() {
    const log = [];
    const p = (...args) => { const line = args.join(' '); console.log(line); log.push(line); };

    const all = await fetchAll('materials', 'id,name,main_category,mid_category');
    p(`총 자재: ${all.length}개\n`);

    // 분류 시뮬레이션
    const results = { changed: [], unchanged: [], unclassified: [] };

    for (const m of all) {
        // 이미 올바르게 분류된 것은 건너뛰기
        if (m.main_category === '생화' && m.mid_category !== '기타') {
            results.unchanged.push(m);
            continue;
        }
        if (m.main_category === '화분') {
            results.unchanged.push(m);
            continue;
        }

        const classification = classifyMaterial(m.name, m.main_category);
        if (classification) {
            const isChanged = classification.main !== m.main_category || classification.mid !== m.mid_category;
            if (isChanged) {
                results.changed.push({
                    ...m,
                    newMain: classification.main,
                    newMid: classification.mid
                });
            } else {
                results.unchanged.push(m);
            }
        } else {
            results.unclassified.push(m);
        }
    }

    p(`=== 분류 결과 시뮬레이션 ===`);
    p(`  변경 대상: ${results.changed.length}개`);
    p(`  유지: ${results.unchanged.length}개`);
    p(`  미분류(자동 분류 불가): ${results.unclassified.length}개`);

    // 변경 후 카테고리별 집계
    const newCats = {};
    const allClassified = [
        ...results.unchanged.map(m => ({ main: m.main_category, mid: m.mid_category })),
        ...results.changed.map(m => ({ main: m.newMain, mid: m.newMid })),
        ...results.unclassified.map(m => ({ main: m.main_category, mid: m.mid_category }))
    ];
    allClassified.forEach(m => {
        const key = m.main;
        if (!newCats[key]) newCats[key] = 0;
        newCats[key]++;
    });
    p('\n=== 변경 후 대분류 현황 ===');
    Object.entries(newCats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => p(`  ${k}: ${v}개`));

    // 변경 후 중분류 집계
    const newSubCats = {};
    allClassified.forEach(m => {
        const key = `${m.main} > ${m.mid}`;
        if (!newSubCats[key]) newSubCats[key] = 0;
        newSubCats[key]++;
    });
    p('\n=== 변경 후 대분류 > 중분류 ===');
    Object.entries(newSubCats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => p(`  ${k}: ${v}개`));

    // 변경 샘플 출력
    p('\n=== 변경 샘플 (처음 30개) ===');
    results.changed.slice(0, 30).forEach(m => {
        p(`  "${m.name}" : ${m.main_category}>${m.mid_category} → ${m.newMain}>${m.newMid}`);
    });

    // 미분류 샘플
    p(`\n=== 미분류 샘플 (처음 30개) ===`);
    results.unclassified.slice(0, 30).forEach(m => {
        p(`  "${m.name}" [현재: ${m.main_category}>${m.mid_category}]`);
    });

    fs.writeFileSync('result_log.txt', log.join('\n'), 'utf8');
    p('\n✅ 시뮬레이션 결과가 result_log.txt에 저장되었습니다.');
    p('⚠️  아직 실제 DB는 변경되지 않았습니다!');
}

main().catch(console.error);
