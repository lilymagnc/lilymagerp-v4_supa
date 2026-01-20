import { CalendarEvent } from '@/hooks/use-calendar';

export interface User {
  uid?: string;
  role?: string;
  franchise?: string;
}

export function canEditCalendarEvent(user: User | null, event?: CalendarEvent | null): boolean {


  if (!user || !user.role) {

    return false;
  }

  // 본사 관리자는 모든 이벤트 수정 가능
  if (user.role === '본사 관리자') {

    return true;
  }

  // 가맹점 관리자는 자신의 지점 이벤트만 수정 가능
  if (user.role === '가맹점 관리자') {
    if (!event) {

      return true; // 새 이벤트 생성은 가능
    }

    // 본사관리자가 작성한 공지/알림은 수정 불가
    if (event.type === 'notice' && (event.branchName === '전체' || event.branchName === '본사')) {

      return false;
    }

    // 자신이 작성한 이벤트는 수정 가능
    if (event.createdBy === user.uid) {

      return true;
    }

    // 자신의 지점에서 작성된 이벤트는 수정 가능 (직원스케줄, 지점공지 등)
    if (event.createdByBranch === user.franchise) {

      return true;
    }

    // 기존 이벤트에 작성자 정보가 없는 경우, 지점 기반으로 권한 확인
    if (!event.createdBy && !event.createdByRole && !event.createdByBranch) {
      if (event.branchName === user.franchise) {

        return true;
      }
    }

    // 자신의 지점 이벤트만 수정 가능
    if (event.branchName === user.franchise) {

      return true;
    }


    return false;
  }


  return false;
}

export function canDeleteCalendarEvent(user: User | null, event: CalendarEvent | null): boolean {


  if (!user || !user.role || !event) {

    return false;
  }

  // 자동 생성된 이벤트는 삭제 불가
  if (event.relatedId) {

    return false;
  }

  // 본사 관리자는 모든 이벤트 삭제 가능
  if (user.role === '본사 관리자') {

    return true;
  }

  // 가맹점 관리자는 자신의 지점 이벤트만 삭제 가능
  if (user.role === '가맹점 관리자') {
    // 본사관리자가 작성한 공지/알림은 삭제 불가
    if (event.type === 'notice' && (event.branchName === '전체' || event.branchName === '본사')) {

      return false;
    }

    // 자신이 작성한 이벤트는 삭제 가능
    if (event.createdBy === user.uid) {

      return true;
    }

    // 자신의 지점에서 작성된 이벤트는 삭제 가능 (직원스케줄, 지점공지 등)
    if (event.createdByBranch === user.franchise) {

      return true;
    }

    // 기존 이벤트에 작성자 정보가 없는 경우, 지점 기반으로 권한 확인
    if (!event.createdBy && !event.createdByRole && !event.createdByBranch) {
      if (event.branchName === user.franchise) {

        return true;
      }
    }

    // 자신의 지점 이벤트만 삭제 가능
    if (event.branchName === user.franchise) {

      return true;
    }


    return false;
  }


  return false;
}
