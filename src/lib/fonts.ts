
// Korean Google Fonts configuration
// 기본 폰트 목록 - font-catalog.ts의 동적 목록과 함께 사용됩니다.

export const GOOGLE_FONTS = [
    { name: 'Noto Sans KR', family: 'Noto Sans KR', url: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap' },
    { name: 'Nanum Gothic', family: 'Nanum Gothic', url: 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap' },
    { name: 'Nanum Myeongjo', family: 'Nanum Myeongjo', url: 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap' },
    { name: 'Nanum Pen Script', family: 'Nanum Pen Script', url: 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap' },
    { name: 'Gowun Dodum', family: 'Gowun Dodum', url: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap' },
    { name: 'Gowun Batang', family: 'Gowun Batang', url: 'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap' },
    { name: 'Sunflower', family: 'Sunflower', url: 'https://fonts.googleapis.com/css2?family=Sunflower:wght@300;500;700&display=swap' },
    { name: 'Song Myung', family: 'Song Myung', url: 'https://fonts.googleapis.com/css2?family=Song+Myung&display=swap' },
    { name: 'Yeon Sung', family: 'Yeon Sung', url: 'https://fonts.googleapis.com/css2?family=Yeon+Sung&display=swap' },
    { name: 'Do Hyeon', family: 'Do Hyeon', url: 'https://fonts.googleapis.com/css2?family=Do+Hyeon&display=swap' },
    { name: 'Black Han Sans', family: 'Black Han Sans', url: 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&display=swap' },
    { name: 'Jua', family: 'Jua', url: 'https://fonts.googleapis.com/css2?family=Jua&display=swap' },
];

export function getGoogleFontUrl(fontFamily: string): string | undefined {
    // font-catalog에서도 검색
    const font = GOOGLE_FONTS.find(f => f.family === fontFamily);
    if (font) return font.url;

    // 동적 폰트에서 검색
    if (typeof window !== 'undefined') {
        try {
            const { FONT_CATALOG } = require('./font-catalog');
            const catalogFont = FONT_CATALOG.find((f: any) => f.family === fontFamily);
            if (catalogFont) return catalogFont.url;
        } catch { }
    }
    return undefined;
}

export function getAllGoogleFontsUrl(): string {
    const families = GOOGLE_FONTS.map(f => {
        const urlObj = new URL(f.url);
        return urlObj.searchParams.get('family');
    }).filter(Boolean);

    if (families.length === 0) return '';

    return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
}
