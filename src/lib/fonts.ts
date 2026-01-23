
// Korean Google Fonts configuration
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
    const font = GOOGLE_FONTS.find(f => f.family === fontFamily);
    return font?.url;
}

export function getAllGoogleFontsUrl(): string {
    // Combine all font families into a single URL to reduce requests
    // Format: family=Font1:wght@400;700&family=Font2&...
    const families = GOOGLE_FONTS.map(f => {
        // Extract family param from full URL for simplicity or reconstruct
        // Here we reconstruct based on knowledge of the URLs in our constant
        // But easier is just to use the pre-defined URLs if we want to load individually,
        // or constructing a big one. Let's construct a big one.
        const urlObj = new URL(f.url);
        return urlObj.searchParams.get('family');
    }).filter(Boolean);

    if (families.length === 0) return '';

    return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
}
