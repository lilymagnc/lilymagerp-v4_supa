// 직위 상수 정의
export const POSITIONS = {
  CEO: "대표",
  DIRECTOR: "이사", 
  MANAGER: "실장",
  SUPERVISOR: "매니저",
  STAFF: "직원"
} as const;
export const POSITION_OPTIONS = [
  { value: POSITIONS.CEO, label: "대표" },
  { value: POSITIONS.DIRECTOR, label: "이사" },
  { value: POSITIONS.MANAGER, label: "실장" },
  { value: POSITIONS.SUPERVISOR, label: "매니저" },
  { value: POSITIONS.STAFF, label: "직원" }
];
// 권한별 기본 직위 매핑
export const ROLE_TO_POSITION = {
  "본사 관리자": POSITIONS.CEO,
  "가맹점 관리자": POSITIONS.DIRECTOR,
  "직원": POSITIONS.STAFF
} as const;
// 직위별 권한 매핑
export const POSITION_TO_ROLE = {
  [POSITIONS.CEO]: "본사 관리자",
  [POSITIONS.DIRECTOR]: "가맹점 관리자", 
  [POSITIONS.MANAGER]: "직원",
  [POSITIONS.SUPERVISOR]: "직원",
  [POSITIONS.STAFF]: "직원"
} as const; 
