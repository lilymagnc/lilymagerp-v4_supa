
// 한글 폰트 카탈로그 - 구글 폰트 + 네이버 폰트 + 눈누(CDN) 무료 폰트
// 모든 폰트는 상업적 사용 가능 (SIL OFL / Apache 2.0 / 자체 무료 라이선스)
// 사용자가 폰트 마법사에서 선택하면 메시지 인쇄 시 사용 가능

export interface FontCatalogItem {
    name: string;         // 표시 이름 (한글)
    family: string;       // CSS font-family
    url: string;          // CSS URL
    source: 'google' | 'naver' | 'noonnu';  // 출처
    category: string;     // 분류
    preview: string;      // 미리보기 텍스트
}

export const FONT_CATEGORIES = [
    { id: 'gothic', label: '고딕체', icon: '🔤' },
    { id: 'myeongjo', label: '명조체', icon: '📜' },
    { id: 'handwriting', label: '손글씨', icon: '✏️' },
    { id: 'design', label: '디자인체', icon: '🎨' },
    { id: 'round', label: '둥근체', icon: '⭕' },
    { id: 'coding', label: '코딩체', icon: '💻' },
] as const;

export const FONT_CATALOG: FontCatalogItem[] = [

    // ═══════════════════════════════════════════
    // 🔤 고딕체 (Gothic / Sans-Serif)
    // ═══════════════════════════════════════════
    { name: 'Noto Sans KR', family: 'Noto Sans KR', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap', source: 'google', category: 'gothic', preview: '구글 기본 한글 고딕' },
    { name: 'Nanum Gothic', family: 'Nanum Gothic', url: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap', source: 'google', category: 'gothic', preview: '부드러운 나눔 고딕' },
    { name: 'Gothic A1', family: 'Gothic A1', url: 'https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700&display=swap', source: 'google', category: 'gothic', preview: '모던한 고딕 A1' },
    { name: 'IBM Plex Sans KR', family: 'IBM Plex Sans KR', url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap', source: 'google', category: 'gothic', preview: '전문적인 IBM 고딕' },
    { name: 'Do Hyeon', family: 'Do Hyeon', url: 'https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap', source: 'google', category: 'gothic', preview: '또렷한 도현체' },
    { name: 'Black Han Sans', family: 'Black Han Sans', url: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap', source: 'google', category: 'gothic', preview: '굵고 강한 블랙한산스' },
    { name: 'NanumSquare', family: 'NanumSquare', url: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-square.css', source: 'naver', category: 'gothic', preview: '깔끔한 나눔스퀘어' },
    { name: 'NanumSquare Neo', family: 'NanumSquareNeo', url: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-square-neo.css', source: 'naver', category: 'gothic', preview: '나눔스퀘어 네오' },
    { name: 'NanumBarunGothic', family: 'NanumBarunGothic', url: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-barun-gothic.css', source: 'naver', category: 'gothic', preview: '나눔바른고딕' },
    { name: 'Pretendard', family: 'Pretendard', url: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css', source: 'noonnu', category: 'gothic', preview: '프리텐다드 모던 고딕' },
    { name: 'SUIT', family: 'SUIT', url: 'https://cdn.jsdelivr.net/gh/sun-typeface/SUIT@2/fonts/static/woff2/SUIT.css', source: 'noonnu', category: 'gothic', preview: 'SUIT 깔끔한 고딕' },
    { name: 'Wanted Sans', family: 'WantedSans', url: 'https://cdn.jsdelivr.net/gh/nicejune/wantedsans/packages/wanted-sans/fonts/webfonts/variable/complete/WantedSansVariable.min.css', source: 'noonnu', category: 'gothic', preview: '원티드 산스 고딕' },
    { name: '에스코어드림', family: 'S-CoreDream', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-3Light.woff', source: 'noonnu', category: 'gothic', preview: '에스코어 드림' },

    // ═══════════════════════════════════════════
    // 📜 명조체 (Myeongjo / Serif)
    // ═══════════════════════════════════════════
    { name: 'Noto Serif KR', family: 'Noto Serif KR', url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap', source: 'google', category: 'myeongjo', preview: '우아한 노토 세리프' },
    { name: 'Nanum Myeongjo', family: 'Nanum Myeongjo', url: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap', source: 'google', category: 'myeongjo', preview: '전통적인 나눔명조' },
    { name: 'Gowun Batang', family: 'Gowun Batang', url: 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap', source: 'google', category: 'myeongjo', preview: '고운 바탕체' },
    { name: 'Song Myung', family: 'Song Myung', url: 'https://fonts.googleapis.com/css2?family=Song+Myung&display=swap', source: 'google', category: 'myeongjo', preview: '송명체 클래식' },
    { name: 'Hahmlet', family: 'Hahmlet', url: 'https://fonts.googleapis.com/css2?family=Hahmlet:wght@400;500;700&display=swap', source: 'google', category: 'myeongjo', preview: '현대적 함렛체' },
    { name: 'Diphylleia', family: 'Diphylleia', url: 'https://fonts.googleapis.com/css2?family=Diphylleia&display=swap', source: 'google', category: 'myeongjo', preview: '감성적인 디필레이아' },
    { name: 'MaruBuri', family: 'MaruBuri', url: 'https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css', source: 'naver', category: 'myeongjo', preview: '마루 부리 명조' },
    { name: 'KoPub 바탕', family: 'KoPub Batang', url: 'https://cdn.jsdelivr.net/gh/nicejune/kopub/KoPubBatang.css', source: 'noonnu', category: 'myeongjo', preview: '코퍼브 바탕체' },
    { name: 'Bookk 명조', family: 'BookkMyungjo', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2302@1.0/BookkMyungjo-Bd.woff2', source: 'noonnu', category: 'myeongjo', preview: '북크 명조체' },

    // ═══════════════════════════════════════════
    // ✏️ 손글씨 (Handwriting)
    // ═══════════════════════════════════════════
    { name: 'Nanum Pen Script', family: 'Nanum Pen Script', url: 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap', source: 'google', category: 'handwriting', preview: '편안한 나눔펜체' },
    { name: 'Nanum Brush Script', family: 'Nanum Brush Script', url: 'https://fonts.googleapis.com/css2?family=Nanum+Brush+Script&display=swap', source: 'google', category: 'handwriting', preview: '붓으로 쓴 나눔체' },
    { name: 'Gaegu', family: 'Gaegu', url: 'https://fonts.googleapis.com/css2?family=Gaegu:wght@300;400;700&display=swap', source: 'google', category: 'handwriting', preview: '개구쟁이 손글씨' },
    { name: 'Gamja Flower', family: 'Gamja Flower', url: 'https://fonts.googleapis.com/css2?family=Gamja+Flower&display=swap', source: 'google', category: 'handwriting', preview: '감자꽃 손글씨' },
    { name: 'Hi Melody', family: 'Hi Melody', url: 'https://fonts.googleapis.com/css2?family=Hi+Melody&display=swap', source: 'google', category: 'handwriting', preview: '하이멜로디 손글씨' },
    { name: 'Poor Story', family: 'Poor Story', url: 'https://fonts.googleapis.com/css2?family=Poor+Story&display=swap', source: 'google', category: 'handwriting', preview: '푸어스토리 손글씨' },
    { name: 'Yeon Sung', family: 'Yeon Sung', url: 'https://fonts.googleapis.com/css2?family=Yeon+Sung&display=swap', source: 'google', category: 'handwriting', preview: '연성체 손글씨' },
    { name: 'East Sea Dokdo', family: 'East Sea Dokdo', url: 'https://fonts.googleapis.com/css2?family=East+Sea+Dokdo&display=swap', source: 'google', category: 'handwriting', preview: '동해독도 필기체' },
    { name: 'Dokdo', family: 'Dokdo', url: 'https://fonts.googleapis.com/css2?family=Dokdo&display=swap', source: 'google', category: 'handwriting', preview: '독도체 붓글씨' },
    { name: '나눔손글씨 펜', family: 'NanumSonPen', url: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-pen.css', source: 'naver', category: 'handwriting', preview: '나눔손글씨 펜' },
    { name: '나눔손글씨 붓', family: 'NanumSonBrush', url: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-brush.css', source: 'naver', category: 'handwriting', preview: '나눔손글씨 붓' },
    { name: '카페24 써라운드', family: 'Cafe24Ssurround', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24Ssurround.woff', source: 'noonnu', category: 'handwriting', preview: '카페24 써라운드' },
    { name: '카페24 써라운드에어', family: 'Cafe24SsurroundAir', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2105_2@1.0/Cafe24SsurroundAir.woff', source: 'noonnu', category: 'handwriting', preview: '카페24 써라운드에어' },
    { name: '교보손글씨', family: 'KyoboHandwriting', url: 'https://cdn.jsdelivr.net/gh/nicejune/kyobofont/KyoboHandwriting.css', source: 'noonnu', category: 'handwriting', preview: '교보 손글씨체' },
    { name: '제주한라산', family: 'JejuHallasan', url: 'https://fonts.googleapis.com/css2?family=Jeju+Hallasan&display=swap', source: 'google', category: 'handwriting', preview: '제주 한라산체' },
    { name: '제주명조', family: 'JejuMyeongjo', url: 'https://fonts.googleapis.com/css2?family=Jeju+Myeongjo&display=swap', source: 'google', category: 'handwriting', preview: '제주 명조체' },
    { name: '제주고딕', family: 'JejuGothic', url: 'https://fonts.googleapis.com/css2?family=Jeju+Gothic&display=swap', source: 'google', category: 'handwriting', preview: '제주 고딕체' },

    // ═══════════════════════════════════════════
    // 🎨 디자인체 (Design / Display)
    // ═══════════════════════════════════════════
    { name: 'Jua', family: 'Jua', url: 'https://fonts.googleapis.com/css2?family=Jua&display=swap', source: 'google', category: 'design', preview: '귀여운 주아체' },
    { name: 'Cute Font', family: 'Cute Font', url: 'https://fonts.googleapis.com/css2?family=Cute+Font&display=swap', source: 'google', category: 'design', preview: '큐트 폰트' },
    { name: 'Stylish', family: 'Stylish', url: 'https://fonts.googleapis.com/css2?family=Stylish&display=swap', source: 'google', category: 'design', preview: '스타일리시체' },
    { name: 'Gugi', family: 'Gugi', url: 'https://fonts.googleapis.com/css2?family=Gugi&display=swap', source: 'google', category: 'design', preview: '구기체 디자인' },
    { name: 'Single Day', family: 'Single Day', url: 'https://fonts.googleapis.com/css2?family=Single+Day&display=swap', source: 'google', category: 'design', preview: '싱글데이 하트체' },
    { name: 'Black And White Picture', family: 'Black And White Picture', url: 'https://fonts.googleapis.com/css2?family=Black+And+White+Picture&display=swap', source: 'google', category: 'design', preview: '흑백사진체' },
    { name: 'Kirang Haerang', family: 'Kirang Haerang', url: 'https://fonts.googleapis.com/css2?family=Kirang+Haerang&display=swap', source: 'google', category: 'design', preview: '끼랑해랑체' },
    { name: 'Orbit', family: 'Orbit', url: 'https://fonts.googleapis.com/css2?family=Orbit&display=swap', source: 'google', category: 'design', preview: '오르빗 기하학체' },
    { name: '카페24 당당해', family: 'Cafe24Dangdanghae', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/Cafe24Dangdanghae.woff', source: 'noonnu', category: 'design', preview: '카페24 당당해' },
    { name: '카페24 심플해', family: 'Cafe24Simplehae', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2104@1.1/Cafe24Simplehae.woff2', source: 'noonnu', category: 'design', preview: '카페24 심플해' },
    { name: '카페24 클래식타입', family: 'Cafe24ClassicType', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2210-2@1.0/Cafe24ClassicType-Regular.woff2', source: 'noonnu', category: 'design', preview: '카페24 클래식타입' },
    { name: '쿠키런 Regular', family: 'CookieRun-Regular', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/CookieRun-Regular.woff', source: 'noonnu', category: 'design', preview: '쿠키런 레귤러' },
    { name: '쿠키런 Bold', family: 'CookieRun-Bold', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2001@1.1/CookieRun-Bold.woff', source: 'noonnu', category: 'design', preview: '쿠키런 볼드' },
    { name: '배달의민족 주아', family: 'BMJUA', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMJUA.woff', source: 'noonnu', category: 'design', preview: '배민 주아체' },
    { name: '배달의민족 한나Pro', family: 'BMHANNAPro', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_seven@1.0/BMHANNAPro.woff', source: 'noonnu', category: 'design', preview: '배민 한나프로' },
    { name: '배달의민족 한나Air', family: 'BMHANNAAir', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_four@1.0/BMHANNAAir.woff', source: 'noonnu', category: 'design', preview: '배민 한나에어' },
    { name: '배달의민족 도현', family: 'BMDOHYEON', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMDOHYEON.woff', source: 'noonnu', category: 'design', preview: '배민 도현체' },
    { name: '배달의민족 기랑해랑', family: 'BMKIRANGHAERANG', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_one@1.0/BMKIRANGHAERANG.woff', source: 'noonnu', category: 'design', preview: '배민 기랑해랑' },
    { name: '프리젠테이션', family: 'Freesentation', url: 'https://cdn.jsdelivr.net/gh/nicejune/freesentation/Freesentation.css', source: 'noonnu', category: 'design', preview: '프리젠테이션체' },
    { name: '넥슨 LV1 고딕', family: 'NexonLv1Gothic', url: 'https://cdn.jsdelivr.net/gh/nicejune/nexonfont/NexonLv1Gothic.css', source: 'noonnu', category: 'design', preview: '넥슨 Lv1 고딕' },

    // ═══════════════════════════════════════════
    // ⭕ 둥근체 (Round)
    // ═══════════════════════════════════════════
    { name: 'Gowun Dodum', family: 'Gowun Dodum', url: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap', source: 'google', category: 'round', preview: '고운 고딕 둥근체' },
    { name: 'Sunflower', family: 'Sunflower', url: 'https://fonts.googleapis.com/css2?family=Sunflower:wght@300;500;700&display=swap', source: 'google', category: 'round', preview: '해바라기 둥근체' },
    { name: 'Dongle', family: 'Dongle', url: 'https://fonts.googleapis.com/css2?family=Dongle:wght@300;400;700&display=swap', source: 'google', category: 'round', preview: '동글동글 동글체' },
    { name: 'NanumSquareRound', family: 'NanumSquareRound', url: 'https://hangeul.pstatic.net/hangeul_static/css/nanum-square-round.css', source: 'naver', category: 'round', preview: '나눔스퀘어라운드' },
    { name: '카페24 아네모네', family: 'Cafe24Ohsquare', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2202-2@1.0/Cafe24Ohsquare.woff2', source: 'noonnu', category: 'round', preview: '카페24 아네모네' },
    { name: '카페24 아네모네에어', family: 'Cafe24OhsquareAir', url: 'https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_2202-2@1.0/Cafe24OhsquareAir.woff2', source: 'noonnu', category: 'round', preview: '카페24 아네모네에어' },

    // ═══════════════════════════════════════════
    // 💻 코딩체 (Coding / Monospace)
    // ═══════════════════════════════════════════
    { name: 'Nanum Gothic Coding', family: 'Nanum Gothic Coding', url: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic+Coding:wght@400;700&display=swap', source: 'google', category: 'coding', preview: '나눔고딕 코딩체' },
    { name: 'D2Coding', family: 'D2Coding', url: 'https://cdn.jsdelivr.net/gh/nicejune/d2coding/D2Coding.css', source: 'naver', category: 'coding', preview: 'D2코딩 모노체' },
];

// 로컬스토리지 키
const ACTIVE_FONTS_KEY = 'lilymag_active_fonts';

// 기본 활성 폰트 목록 (family 배열) - 가장 실용적인 폰트 위주
const DEFAULT_ACTIVE_FONTS = [
    'Noto Sans KR', 'Nanum Gothic', 'Gothic A1', 'Pretendard',
    'Noto Serif KR', 'Nanum Myeongjo', 'Gowun Batang', 'MaruBuri',
    'Nanum Pen Script', 'Nanum Brush Script', 'Gaegu', 'Gamja Flower',
    'Gowun Dodum', 'Sunflower', 'Dongle', 'NanumSquareRound',
    'Jua', 'Do Hyeon', 'Black Han Sans', 'Song Myung',
    'Yeon Sung', 'Hahmlet', 'Diphylleia', 'Hi Melody',
];

// 활성 폰트 목록 가져오기
export function getActiveFonts(): string[] {
    if (typeof window === 'undefined') return DEFAULT_ACTIVE_FONTS;
    const stored = localStorage.getItem(ACTIVE_FONTS_KEY);
    if (stored) {
        try { return JSON.parse(stored); } catch { return DEFAULT_ACTIVE_FONTS; }
    }
    return DEFAULT_ACTIVE_FONTS;
}

// 활성 폰트 목록 저장
export function setActiveFonts(fonts: string[]) {
    if (typeof window !== 'undefined') {
        localStorage.setItem(ACTIVE_FONTS_KEY, JSON.stringify(fonts));
    }
}

// 활성 폰트의 카탈로그 항목 반환
export function getActiveFontItems(): FontCatalogItem[] {
    const active = getActiveFonts();
    return active
        .map(family => FONT_CATALOG.find(f => f.family === family))
        .filter((f): f is FontCatalogItem => !!f);
}
