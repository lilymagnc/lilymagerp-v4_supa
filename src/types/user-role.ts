import { Timestamp } from 'firebase/firestore';
// 사용자 역할 타입
export enum UserRoleType {
  BRANCH_USER = 'branch_user',
  BRANCH_MANAGER = 'branch_manager',
  HQ_MANAGER = 'hq_manager',
  ADMIN = 'admin'
}
// 권한 타입
export enum Permission {
  CREATE_REQUEST = 'create_request',
  VIEW_ALL_REQUESTS = 'view_all_requests',
  EDIT_PRICES = 'edit_prices',
  CHANGE_STATUS = 'change_status',
  MANAGE_USERS = 'manage_users',
  CONSOLIDATE_REQUESTS = 'consolidate_requests',
  EXPORT_DATA = 'export_data'
}
// 사용자 역할 데이터
export interface UserRole {
  id: string;
  userId: string;
  email: string;
  role: UserRoleType;
  branchId?: string; // 지점 사용자의 경우
  branchName?: string;
  permissions: Permission[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
}
// 역할별 기본 권한 매핑
export const ROLE_PERMISSIONS: Record<UserRoleType, Permission[]> = {
  [UserRoleType.BRANCH_USER]: [
    Permission.CREATE_REQUEST
  ],
  [UserRoleType.BRANCH_MANAGER]: [
    Permission.CREATE_REQUEST,
    Permission.VIEW_ALL_REQUESTS,
    Permission.CHANGE_STATUS
  ],
  [UserRoleType.HQ_MANAGER]: [
    Permission.CREATE_REQUEST,
    Permission.VIEW_ALL_REQUESTS,
    Permission.EDIT_PRICES,
    Permission.CHANGE_STATUS,
    Permission.MANAGE_USERS,
    Permission.CONSOLIDATE_REQUESTS,
    Permission.EXPORT_DATA
  ],
  [UserRoleType.ADMIN]: [
    Permission.CREATE_REQUEST,
    Permission.VIEW_ALL_REQUESTS,
    Permission.EDIT_PRICES,
    Permission.CHANGE_STATUS,
    Permission.MANAGE_USERS,
    Permission.CONSOLIDATE_REQUESTS,
    Permission.EXPORT_DATA
  ]
};
// 사용자 역할 생성 데이터
export interface CreateUserRoleData {
  userId: string;
  email: string;
  role: UserRoleType;
  branchId?: string;
  branchName?: string;
}
// 역할 확인 유틸리티 함수
export const hasPermission = (userRole: UserRole | null, permission: Permission): boolean => {
  if (!userRole || !userRole.isActive) return false;
  return userRole.permissions.includes(permission);
};
export const hasAnyPermission = (userRole: UserRole | null, permissions: Permission[]): boolean => {
  if (!userRole || !userRole.isActive) return false;
  return permissions.some(permission => userRole.permissions.includes(permission));
};
// 본사 관리자 권한 확인 (hq_manager 또는 admin)
// 권한은 소속과 상관없이 작동
export const isHQManager = (userRole: UserRole | null): boolean => {
  return (
    (userRole?.role === UserRoleType.HQ_MANAGER && userRole.isActive) ||
    (userRole?.role === UserRoleType.ADMIN && userRole.isActive)
  );
};
export const isBranchUser = (userRole: UserRole | null): boolean => {
  return userRole?.role === UserRoleType.BRANCH_USER && userRole.isActive;
};
export const isBranchManager = (userRole: UserRole | null): boolean => {
  return userRole?.role === UserRoleType.BRANCH_MANAGER && userRole.isActive;
};
export const isAdmin = (userRole: UserRole | null): boolean => {
  return userRole?.role === UserRoleType.ADMIN && userRole.isActive;
};
// 본사 관리자 권한 확인 (hq_manager 또는 admin)
// 권한은 소속과 상관없이 작동
export const isHeadOfficeAdmin = (userRole: UserRole | null): boolean => {
  return (
    (userRole?.role === UserRoleType.HQ_MANAGER && userRole.isActive) ||
    (userRole?.role === UserRoleType.ADMIN && userRole.isActive)
  );
};
// 역할 표시명
export const ROLE_LABELS: Record<UserRoleType, string> = {
  [UserRoleType.BRANCH_USER]: '지점 사용자',
  [UserRoleType.BRANCH_MANAGER]: '가맹점 관리자',
  [UserRoleType.HQ_MANAGER]: '본사 관리자',
  [UserRoleType.ADMIN]: '시스템 관리자'
};
// 권한 표시명
export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.CREATE_REQUEST]: '구매 요청 생성',
  [Permission.VIEW_ALL_REQUESTS]: '모든 요청 조회',
  [Permission.EDIT_PRICES]: '가격 수정',
  [Permission.CHANGE_STATUS]: '상태 변경',
  [Permission.MANAGE_USERS]: '사용자 관리',
  [Permission.CONSOLIDATE_REQUESTS]: '요청 취합',
  [Permission.EXPORT_DATA]: '데이터 내보내기'
};
