/**
 * ❗ [임시 정리용] 캘린더 중복 일정 일괄 삭제 스크립트 ❗
 * 
 * 잘못 들어간 3월 릴리맥 스케줄만 싹 찾아서 지워주는 임시 청소기입니다.
 * 
 * [사용 방법]
 * 1. 이 코드를 Apps Script 편집기에 복사해서 붙여넣습니다.
 * 2. 상단의 💾 저장 버튼을 누릅니다.
 * 3. 방금 저장 버튼 옆에 보면 [syncGwanghwamunSchedule] 이라고 적힌 
 *    드롭다운 버튼(실행버튼 옆)이 있습니다.
 * 4. 그걸 클릭해서 [cleanupDuplicateEvents] 로 바꿔줍니다.
 * 5. ▷ [실행] 버튼을 누릅니다. -> 잠시 뒤 하단 실행 로그에 몇 개를 지웠는지 뜹니다.
 * 6. 청소가 끝나면 이 코드는 다 지우고, 다시 새 스케줄 연동 코드를 붙여넣으시면 됩니다.
 */

function cleanupDuplicateEvents() {
    const ui = SpreadsheetApp.getUi();
    const calendar = CalendarApp.getDefaultCalendar();

    if (!calendar) {
        ui.alert('기본 캘린더를 찾을 수 없습니다.');
        return;
    }

    // 1. 달력을 청소할 기간 설정 (2026년 3월 1일 ~ 3월 31일)
    // 이번 달(3월)에 들어간 것만 안전하게 검색합니다.
    const startTime = new Date(2026, 2, 1);  // 자바스크립트 달은 0부터 시작해서 3월은 2
    const endTime = new Date(2026, 3, 1);    // 4월 1일 자정까지

    // 2. 해당 기간의 모든 일정 가져오기
    const events = calendar.getEvents(startTime, endTime);

    let deleteCount = 0;

    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const title = event.getTitle();

        // 3. 지울 대상: 우리가 아까 스크립트로 밀어넣은 
        // "[단기/근무] 나수빈" 처럼 "[단기/근무]" 라는 글자가 포함된 일정만 쏙쏙 지웁니다.
        // (기존에 손으로 만든 "수빈 오픈" 같은건 안 건드립니다)
        if (title.includes('[단기/근무]')) {
            event.deleteEvent();
            deleteCount++;
            Utilities.sleep(150); // 구글 API 제한 방지
        }
    }

    // 4. 완료 알림
    ui.alert(`깔끔하게 청소 완료!\n총 ${deleteCount}개의 잘못된 일정을 캘린더에서 삭제했습니다.`);
}
