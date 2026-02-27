/**
 * 릴리맥 지점 근무 스케줄 -> 구글 캘린더 동기화 스크립트
 * 
 * [사용 방법]
 * 1. 근무 스케줄이 있는 구글 시트에서 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 모두 지우고 이 코드를 붙여넣습니다.
 * 3. 아래 CONFIG 부분의 설정값(캘린더 ID, 시트 이름 등)을 본인 지점에 맞게 수정합니다.
 * 4. 저장(Ctrl+S) 후, [실행] 버튼을 한 번 눌러 구글 권한을 허용해줍니다.
 * 5. 시트 상단 메뉴에 생긴 "스케줄 관리" > "캘린더로 스케줄 전송"을 클릭하면 동기화됩니다.
 */

const CONFIG = {

    // [수정 필수] 스케줄이 적힌 시트 탭 이름
    SHEET_NAME: '스케줄표',

    // 데이터가 시작하는 행 번호 (첫 줄이 헤더면 2)
    START_ROW: 2,

    // 열 번호 설정 (A열=1, B열=2, C열=3 ...)
    // 시트 양식에 맞게 열 번호를 조정하세요.
    COL_DATE: 1,         // 예: 날짜 (2026-03-01)
    COL_NAME: 2,         // 예: 근무자 이름 (홍길동)
    COL_START_TIME: 3,   // 예: 출근 시간 (09:00)
    COL_END_TIME: 4,     // 예: 퇴근 시간 (18:00)
    COL_MEMO: 5          // 예: 특이사항 또는 지점명
};

/**
 * 시트를 열었을 때 자동으로 스크립트 메뉴를 추가
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📅 스케줄 관리')
        .addItem('캘린더로 스케줄 전송', 'syncScheduleToCalendar')
        .addToUi();
}

/**
 * 시트 데이터를 읽어서 캘린더에 일정을 등록하는 메인 함수
 */
function syncScheduleToCalendar() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
        '캘린더 동기화',
        '현재 시트의 스케줄을 구글 캘린더로 전송하시겠습니까?\n(기존에 등록된 동일 일정은 건너뜁니다)',
        ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) {
        return;
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
        ui.alert(`오류: '${CONFIG.SHEET_NAME}' 이름의 시트를 찾을 수 없습니다.`);
        return;
    }

    const calendar = CalendarApp.getDefaultCalendar();
    if (!calendar) {
        ui.alert('오류: 구글 기본 캘린더를 찾을 수 없습니다.');
        return;
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < CONFIG.START_ROW) {
        ui.alert('전송할 스케줄 데이터가 없습니다.');
        return;
    }

    // 데이터 한 번에 가져오기
    const dataRange = sheet.getRange(CONFIG.START_ROW, 1, lastRow - CONFIG.START_ROW + 1, lastColumn);
    const data = dataRange.getValues();

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        // 비어있는 행 무시
        if (!row[CONFIG.COL_DATE - 1] || !row[CONFIG.COL_NAME - 1]) continue;

        try {
            // 날짜 및 시간 파싱
            const dateObj = new Date(row[CONFIG.COL_DATE - 1]);
            const startTimeStr = String(row[CONFIG.COL_START_TIME - 1]);
            const endTimeStr = String(row[CONFIG.COL_END_TIME - 1]);

            const name = row[CONFIG.COL_NAME - 1];
            const memo = row[CONFIG.COL_MEMO - 1] ? String(row[CONFIG.COL_MEMO - 1]) : '';

            const title = `[근무] ${name}`;

            // 구글 시트에서 시간을 Date 객체로 주는 경우가 있음
            let startTime, endTime;

            if (startTimeStr.includes(':')) {
                // 문자열인 경우 "09:00"
                const [sh, sm] = startTimeStr.split(':');
                startTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(sh), parseInt(sm));
            } else if (row[CONFIG.COL_START_TIME - 1] instanceof Date) {
                const t = row[CONFIG.COL_START_TIME - 1];
                startTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), t.getHours(), t.getMinutes());
            }

            if (endTimeStr.includes(':')) {
                const [eh, em] = endTimeStr.split(':');
                endTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), parseInt(eh), parseInt(em));
            } else if (row[CONFIG.COL_END_TIME - 1] instanceof Date) {
                const t = row[CONFIG.COL_END_TIME - 1];
                endTime = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), t.getHours(), t.getMinutes());
            }

            // 필수 데이터 유효성 검사
            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                continue;
            }

            // 중복 체크 로직 (해당 날짜에 같은 제목의 일정이 있는지 검사)
            const existingEvents = calendar.getEvents(startTime, endTime);
            let isDuplicate = false;
            for (let j = 0; j < existingEvents.length; j++) {
                if (existingEvents[j].getTitle() === title) {
                    isDuplicate = true;
                    break;
                }
            }

            // 중복이 아니면 이벤트 생성
            if (!isDuplicate) {
                calendar.createEvent(title, startTime, endTime, {
                    description: memo
                });
                successCount++;

                // 구글 캘린더 API 할당량 초과 방지를 위한 약간의 지연 시간 (필수아님)
                Utilities.sleep(200);
            }

        } catch (e) {
            console.error('Row ' + (i + CONFIG.START_ROW) + ' Error: ' + e.message);
            errorCount++;
        }
    }

    ui.alert(`전송 완료!\n- 새롭게 추가된 스케줄: ${successCount}건\n- 오류 발생: ${errorCount}건\n(기존에 등록된 일정은 제외됨)`);
}
