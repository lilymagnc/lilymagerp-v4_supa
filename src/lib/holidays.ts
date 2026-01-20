// 한국 공휴일 데이터
export interface Holiday {
  date: string; // MM-DD 형식
  name: string;
  type: 'fixed' | 'lunar' | 'substitute'; // 고정, 음력, 대체공휴일
  description?: string;
}

// 고정 공휴일 (매년 같은 날짜)
const fixedHolidays: Holiday[] = [
  { date: '01-01', name: '신정', type: 'fixed' },
  { date: '03-01', name: '삼일절', type: 'fixed' },
  { date: '05-05', name: '어린이날', type: 'fixed' },
  { date: '06-06', name: '현충일', type: 'fixed' },
  { date: '08-15', name: '광복절', type: 'fixed' },
  { date: '10-03', name: '개천절', type: 'fixed' },
  { date: '10-09', name: '한글날', type: 'fixed' },
  { date: '12-25', name: '크리스마스', type: 'fixed' },
];

// 음력 공휴일 (매년 날짜가 다름) - 2024년 기준
const lunarHolidays2024: Holiday[] = [
  { date: '02-09', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '02-10', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '02-11', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '04-10', name: '부처님 오신 날', type: 'lunar' },
  { date: '09-16', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '09-17', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '09-18', name: '추석', type: 'lunar', description: '추석 연휴' },
];

// 2025년 음력 공휴일
const lunarHolidays2025: Holiday[] = [
  { date: '01-28', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '01-29', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '01-30', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '04-29', name: '부처님 오신 날', type: 'lunar' },
  { date: '10-05', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '10-06', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '10-07', name: '추석', type: 'lunar', description: '추석 연휴' },
];

// 2026년 음력 공휴일
const lunarHolidays2026: Holiday[] = [
  { date: '02-17', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '02-18', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '02-19', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '04-18', name: '부처님 오신 날', type: 'lunar' },
  { date: '09-24', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '09-25', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '09-26', name: '추석', type: 'lunar', description: '추석 연휴' },
];

// 2027년 음력 공휴일
const lunarHolidays2027: Holiday[] = [
  { date: '02-06', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '02-07', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '02-08', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '05-03', name: '부처님 오신 날', type: 'lunar' },
  { date: '10-13', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '10-14', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '10-15', name: '추석', type: 'lunar', description: '추석 연휴' },
];

// 2028년 음력 공휴일
const lunarHolidays2028: Holiday[] = [
  { date: '01-26', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '01-27', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '01-28', name: '설날', type: 'lunar', description: '설날 연휴' },
  { date: '04-22', name: '부처님 오신 날', type: 'lunar' },
  { date: '10-02', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '10-03', name: '추석', type: 'lunar', description: '추석 연휴' },
  { date: '10-04', name: '추석', type: 'lunar', description: '추석 연휴' },
];

// 대체공휴일 (2024년)
const substituteHolidays2024: Holiday[] = [
  { date: '02-12', name: '대체공휴일', type: 'substitute', description: '설날 대체공휴일' },
  { date: '09-19', name: '대체공휴일', type: 'substitute', description: '추석 대체공휴일' },
];

// 대체공휴일 (2025년)
const substituteHolidays2025: Holiday[] = [
  { date: '01-31', name: '대체공휴일', type: 'substitute', description: '설날 대체공휴일' },
  { date: '10-08', name: '대체공휴일', type: 'substitute', description: '추석 대체공휴일' },
];

// 대체공휴일 (2026년)
const substituteHolidays2026: Holiday[] = [
  { date: '02-20', name: '대체공휴일', type: 'substitute', description: '설날 대체공휴일' },
  { date: '09-27', name: '대체공휴일', type: 'substitute', description: '추석 대체공휴일' },
];

// 대체공휴일 (2027년)
const substituteHolidays2027: Holiday[] = [
  { date: '02-09', name: '대체공휴일', type: 'substitute', description: '설날 대체공휴일' },
  { date: '10-16', name: '대체공휴일', type: 'substitute', description: '추석 대체공휴일' },
];

// 대체공휴일 (2028년)
const substituteHolidays2028: Holiday[] = [
  { date: '01-29', name: '대체공휴일', type: 'substitute', description: '설날 대체공휴일' },
  { date: '10-05', name: '대체공휴일', type: 'substitute', description: '추석 대체공휴일' },
];

// 연도별 공휴일 매핑
const holidaysByYear: { [year: number]: Holiday[] } = {
  2024: [...fixedHolidays, ...lunarHolidays2024, ...substituteHolidays2024],
  2025: [...fixedHolidays, ...lunarHolidays2025, ...substituteHolidays2025],
  2026: [...fixedHolidays, ...lunarHolidays2026, ...substituteHolidays2026],
  2027: [...fixedHolidays, ...lunarHolidays2027, ...substituteHolidays2027],
  2028: [...fixedHolidays, ...lunarHolidays2028, ...substituteHolidays2028],
};

// 특정 날짜가 공휴일인지 확인하는 함수
export function isHoliday(date: Date): Holiday | null {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${month}-${day}`;
  
  // 해당 연도의 공휴일 데이터가 있으면 사용
  if (holidaysByYear[year]) {
    const yearHolidays = holidaysByYear[year];
    return yearHolidays.find(holiday => holiday.date === dateString) || null;
  }
  
  // 해당 연도 데이터가 없으면 고정 공휴일만 확인
  return fixedHolidays.find(holiday => holiday.date === dateString) || null;
}

// 특정 연도의 모든 공휴일을 가져오는 함수
export function getHolidaysForYear(year: number): Holiday[] {
  return holidaysByYear[year] || [];
}

// 특정 월의 공휴일을 가져오는 함수
export function getHolidaysForMonth(year: number, month: number): Holiday[] {
  const yearHolidays = holidaysByYear[year] || [];
  const monthStr = String(month).padStart(2, '0');
  
  return yearHolidays.filter(holiday => {
    const holidayMonth = holiday.date.split('-')[0];
    return holidayMonth === monthStr;
  });
}

// 공휴일 타입별 색상
export const holidayColors = {
  fixed: 'bg-red-500',
  lunar: 'bg-orange-500',
  substitute: 'bg-yellow-500',
};
