// 날씨 정보를 가져오는 서비스
export interface WeatherInfo {
  minTemperature: number;
  maxTemperature: number;
  description: string;
  icon: string;
}

// 서울의 기본 좌표 (한국 기준)
const SEOUL_COORDS = {
  lat: 37.5665,
  lon: 126.9780
};

export async function getWeatherInfo(latitude?: number, longitude?: number): Promise<WeatherInfo | null> {
  const lat = latitude || SEOUL_COORDS.lat;
  const lon = longitude || SEOUL_COORDS.lon;

  try {
    // OpenMeteo API를 사용하여 최저/최고 기온 요청
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia/Tokyo&forecast_days=1`
    );

    if (!response.ok) {
      throw new Error('날씨 정보를 가져올 수 없습니다.');
    }

    const data = await response.json();
    
    const daily = data.daily;
    const weatherDescription = getWeatherDescription(daily.weather_code[0]);
    const weatherIcon = getWeatherIconFromCode(daily.weather_code[0]);
    
    return {
      maxTemperature: Math.round(daily.temperature_2m_max[0]),
      minTemperature: Math.round(daily.temperature_2m_min[0]),
      description: weatherDescription,
      icon: weatherIcon
    };
  } catch (error) {
    console.error('날씨 정보 가져오기 실패:', error);
    return {
      minTemperature: 18,
      maxTemperature: 26,
      description: '맑음',
      icon: '01d'
    };
  }
}

// WMO 날씨 코드를 설명으로 변환
function getWeatherDescription(code: number): string {
  const weatherMap: { [key: number]: string } = {
    0: '맑음',
    1: '대체로 맑음',
    2: '구름 조금',
    3: '흐림',
    45: '안개',
    48: '짙은 안개',
    51: '가벼운 이슬비',
    53: '이슬비',
    55: '짙은 이슬비',
    56: '가벼운 얼음비',
    57: '얼음비',
    61: '가벼운 비',
    63: '비',
    65: '폭우',
    66: '가벼운 얼음비',
    67: '얼음비',
    71: '가벼운 눈',
    73: '눈',
    75: '폭설',
    77: '눈알',
    80: '가벼운 소나기',
    81: '소나기',
    82: '폭우',
    85: '가벼운 눈비',
    86: '눈비',
    95: '천둥번개',
    96: '우박과 천둥번개',
    99: '강한 우박과 천둥번개'
  };
  
  return weatherMap[code] || '맑음';
}

// WMO 날씨 코드를 아이콘으로 변환
function getWeatherIconFromCode(code: number): string {
  const iconMap: { [key: number]: string } = {
    0: '01d', // 맑음
    1: '02d', // 대체로 맑음
    2: '03d', // 구름 조금
    3: '04d', // 흐림
    45: '50d', // 안개
    48: '50d', // 짙은 안개
    51: '09d', // 가벼운 이슬비
    53: '09d', // 이슬비
    55: '09d', // 짙은 이슬비
    56: '13d', // 가벼운 얼음비
    57: '13d', // 얼음비
    61: '10d', // 가벼운 비
    63: '10d', // 비
    65: '10d', // 폭우
    66: '13d', // 가벼운 얼음비
    67: '13d', // 얼음비
    71: '13d', // 가벼운 눈
    73: '13d', // 눈
    75: '13d', // 폭설
    77: '13d', // 눈알
    80: '09d', // 가벼운 소나기
    81: '09d', // 소나기
    82: '09d', // 폭우
    85: '13d', // 가벼운 눈비
    86: '13d', // 눈비
    95: '11d', // 천둥번개
    96: '11d', // 우박과 천둥번개
    99: '11d'  // 강한 우박과 천둥번개
  };
  
  return iconMap[code] || '01d';
}

// 날씨 아이콘을 이모지로 변환하는 함수
export function getWeatherEmoji(icon: string): string {
  const weatherMap: { [key: string]: string } = {
    '01d': '☀️',
    '01n': '🌙',
    '02d': '⛅️',
    '02n': '☁️',
    '03d': '☁️',
    '03n': '☁️',
    '04d': '☁️',
    '04n': '☁️',
    '09d': '🌧️',
    '09n': '🌧️',
    '10d': '🌦️',
    '10n': '🌧️',
    '11d': '⛈️',
    '11n': '⛈️',
    '13d': '🌨️',
    '13n': '🌨️',
    '50d': '🌫️',
    '50n': '🌫️',
  };
  
  return weatherMap[icon] || '🌤️';
}

