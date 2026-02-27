/**
 * 릴리맥 광화문점 스케줄 -> 구글 캘린더 동기화 스크립트 (맞춤형)
 * 
 * [사용 방법]
 * 1. 광화문점 스케줄 시트에서 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 지우고 이 코드를 붙여넣기
 * 3. 💾 저장 후, 상단 메뉴의 [📅 스케줄 관리] -> [현재 시트를 캘린더로 전송] 클릭
 */

// 만약 내년(예: 2027년) 스케줄을 미리 연동할 때는 이 숫자를 2027로 바꾸세요.
const CONFIG = {
    YEAR: new Date().getFullYear()
};

function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📅 스케줄 관리')
        .addItem('현재 시트 스케줄을 캘린더로 전송', 'syncGwanghwamunSchedule')
        .addToUi();
}

function syncGwanghwamunSchedule() {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();

    const response = ui.alert(
        '캘린더 동기화',
        `현재 열려있는 [${sheetName}] 의 스케줄을 구글 캘린더로 전송하시겠습니까?`,
        ui.ButtonSet.YES_NO
    );

    if (response !== ui.Button.YES) return;

    const calendar = CalendarApp.getDefaultCalendar();
    if (!calendar) {
        ui.alert('오류: 구글 기본 캘린더를 찾을 수 없습니다.');
        return;
    }

    // 시트 이름에서 자동으로 월(Month) 추출 (예: "3월 스케줄표")
    let targetMonth = new Date().getMonth() + 1;
    const monthMatch = sheetName.match(/(\d+)월/);
    if (monthMatch) {
        targetMonth = parseInt(monthMatch[1], 10);
    } else {
        // A4 셀 등에서 월을 찾기
        const titleVal = String(sheet.getRange(4, 1).getValue() || '');
        const titleMatch = titleVal.match(/(\d+)월/);
        if (titleMatch) targetMonth = parseInt(titleMatch[1], 10);
    }

    const data = sheet.getDataRange().getValues();

    // 5번째 행(인덱스 4)에 이름이 적혀있음
    const namesRow = data[4];
    if (!namesRow) {
        ui.alert('오류: 시트 구조가 다릅니다. (5번째 행에 이름이 있어야 합니다)');
        return;
    }

    // 직원 블록 파악 (4칸마다 한 명씩)
    const blocks = [];
    for (let c = 0; c < namesRow.length; c += 4) {
        let name = String(namesRow[c] || '').trim();
        if (name && name.length >= 2) { // 이름이 있는 칸
            blocks.push({ colStart: c, name: name });
        }
    }

    if (blocks.length === 0) {
        ui.alert('오류: 직원 이름을 찾을 수 없습니다.');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    // 7번째 행(인덱스 6)부터 날짜 데이터 시작
    for (let r = 6; r < data.length; r++) {
        const row = data[r];

        for (const block of blocks) {
            // 해당 직원의 데이터 구역
            // block.colStart: 날짜, block.colStart+1: 근무시간, block.colStart+2: 시간합계
            const dateStr = String(row[block.colStart] || '').trim();
            const timeStr = String(row[block.colStart + 1] || '').trim();

            // 날짜칸이 아니면 건너뜀 (예: "총합", 빈칸)
            if (!dateStr || !dateStr.includes('일')) continue;

            const dayMatch = dateStr.match(/(\d+)일/);
            if (!dayMatch) continue;
            const day = parseInt(dayMatch[1], 10);

            // 중요: 엑셀 양식이 왼쪽 구역(115일), 오른쪽 구역(1631일)로 나뉘어 있을 수 있음.
            // 시간 데이터 자체가 없으면(빈칸이면) 해당 날짜/사람 조합은 무시
            if (!timeStr || timeStr === '') continue;

            // 휴무 또는 연차라고 명시된 경우도 스케줄에서 제외
            if (timeStr.includes('휴무') || timeStr.includes('연차')) continue;

            // 시간 파싱 (예: "11:00-6:00" 또는 "8:30-8:00")
            const timeMatch = timeStr.match(/(\d+):(\d+)\s*[-~]\s*(\d+):(\d+)/);
            if (!timeMatch) {
                // 시간이 적혀있는데 양식이 안 맞으면(예: "오픈", "마감" 등 글씨로만 적혀있을 때)
                // 여기서는 일단 에러 카운트로 넘김 (별도 협의 필요)
                continue;
            }

            let sh = parseInt(timeMatch[1], 10);
            let sm = parseInt(timeMatch[2], 10);
            let eh = parseInt(timeMatch[3], 10);
            let em = parseInt(timeMatch[4], 10);

            // AM/PM 자동 보정 로직 (꽃집 영업시간 기준)
            if (sh <= 7) sh += 12; // 출근이 1~7시라면 오후임(13~19)
            if (eh <= 12 && eh <= sh) {
                eh += 12; // 8:30-8:00 의 경우 끝시간 8이 더 작으므로 20:00로 변경
            }

            const startTime = new Date(CONFIG.YEAR, targetMonth - 1, day, sh, sm);
            const endTime = new Date(CONFIG.YEAR, targetMonth - 1, day, eh, em);

            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

            // 근무 형태 (오픈, 마감, 풀근무) 판별
            const dayOfWeek = startTime.getDay(); // 0: 일요일, 1: 월요일 ... 6: 토요일
            let shiftLabel = "";

            // 1. 풀근무 판별
            if (dayOfWeek >= 1 && dayOfWeek <= 5 && sh === 8 && eh === 20) {
                // 평일 8:30 ~ 20:00 (sh가 8)
                shiftLabel = "풀근무";
            } else if (dayOfWeek === 6 && sh === 11 && eh === 19) {
                // 토요일 11:00 ~ 19:00
                shiftLabel = "풀근무";
            } else if (dayOfWeek === 0 && sh === 11 && eh === 18) {
                // 일요일(공휴일) 11:00 ~ 18:00
                shiftLabel = "풀근무";
            } else {
                // 2. 풀근무가 아닐 때 오픈/마감 판별
                const isOpen = (sh === 8);   // 8시(또는 8시 30분) 시작이면 오픈
                const isClose = (eh === 20); // 20시(8시) 마감이면 마감

                if (isOpen && isClose) {
                    shiftLabel = "풀근무"; // 주말인데 8~20시를 일하는 등 예외적인 풀근무
                } else if (isOpen) {
                    shiftLabel = "오픈";
                } else if (isClose) {
                    shiftLabel = "마감";
                }
            }

            // 캘린더에 표시될 제목 형식 조립 (예: [풀근무] 나수빈 (8:30-8:00))
            const eventTitle = shiftLabel
                ? `[${shiftLabel}] ${block.name} (${timeStr})`
                : `${block.name} (${timeStr})`;

            try {
                // 이미 캘린더에 있는 일정인지 중복 체크
                const existingEvents = calendar.getEvents(startTime, endTime);
                let isDuplicate = false;
                for (let j = 0; j < existingEvents.length; j++) {
                    if (existingEvents[j].getTitle() === eventTitle) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (!isDuplicate) {
                    calendar.createEvent(eventTitle, startTime, endTime);
                    successCount++;
                    Utilities.sleep(150); // 구글 API 제한 방지
                }
            } catch (err) {
                console.error(`Row ${r + 1}, Col ${block.colStart + 1} Error: ${err.message}`);
                errorCount++;
            }
        }
    }

    ui.alert(`전송 완료!\n- 추가된 스케줄: ${successCount}건\n- 오류: ${errorCount}건\n(기존에 등록된 일정은 자동 제외됨)`);
}
