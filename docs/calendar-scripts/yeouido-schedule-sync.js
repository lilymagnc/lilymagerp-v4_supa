/**
 * 릴리맥 여의도점 스케줄 -> 구글 캘린더 동기화 스크립트 (양식 자동맞춤형)
 * 
 * [사용 방법]
 * 1. 여의도점 스케줄 시트에서 [확장 프로그램] > [Apps Script] 클릭
 * 2. 기존 코드를 지우고 이 코드를 붙여넣기
 * 3. 💾 저장 후, 상단 메뉴의 [📅 스케줄 관리] -> [현재 시트 스케줄을 캘린더로 전송] 클릭
 */

const CONFIG = {
    YEAR: new Date().getFullYear()
};

function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('📅 스케줄 관리')
        .addItem('현재 시트 스케줄을 캘린더로 전송', 'syncYeouidoSchedule')
        .addToUi();
}

function syncYeouidoSchedule() {
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

    // N월 찾기
    let targetMonth = new Date().getMonth() + 1;
    const monthMatch = sheetName.match(/(\d+)월/);
    if (monthMatch) {
        targetMonth = parseInt(monthMatch[1], 10);
    } else {
        const titleVal = String(sheet.getRange(1, 1).getValue() || '');
        const titleMatch = titleVal.match(/(\d+)월/);
        if (titleMatch) targetMonth = parseInt(titleMatch[1], 10);
    }

    const data = sheet.getDataRange().getValues();

    // 1. 자동으로 헤더 줄("날짜", "근무시간" 이 적힌 줄) 찾기
    let headerRowIndex = -1;
    for (let r = 0; r < Math.min(15, data.length); r++) {
        const rowStr = data[r].join('');
        if (rowStr.includes('날짜') && rowStr.includes('근무시간')) {
            headerRowIndex = r;
            break;
        }
    }

    if (headerRowIndex === -1 || headerRowIndex === 0) {
        ui.alert('오류: 시트 구조를 인식할 수 없습니다. ("날짜", "근무시간" 항목이 있는 줄을 찾을 수 없습니다.)');
        return;
    }

    // 이름칸은 무조건 "날짜" 헤더줄의 바로 윗줄에 있음
    const namesRow = data[headerRowIndex - 1];

    // 직원 블록 파악
    const blocks = [];
    const headerRow = data[headerRowIndex];

    for (let c = 0; c < headerRow.length; c++) {
        const headerVal = String(headerRow[c] || '').trim();
        if (headerVal === '날짜') {
            // "날짜" 윗칸에 적힌 이름 찾기, 병합셀이거나 작성 위치가 약간 달라도 찾을 수 있게 범위를 넓게 봄
            let name = String(namesRow[c] || '').trim();
            if (!name && c > 0) name = String(namesRow[c - 1] || '').trim();
            if (!name && c > 1) name = String(namesRow[c - 2] || '').trim();

            if (name) {
                blocks.push({ colStart: c, name: name });
            }
        }
    }

    if (blocks.length === 0) {
        ui.alert('오류: 직원 이름을 찾을 수 없습니다.');
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    // 데이터 시작줄 (헤더 바로 아랫줄부터 시작)
    for (let r = headerRowIndex + 1; r < data.length; r++) {
        const row = data[r];

        for (const block of blocks) {
            const dateStr = String(row[block.colStart] || '').trim();
            const timeStr = String(row[block.colStart + 1] || '').trim();

            if (!dateStr || !dateStr.includes('일')) continue;

            const dayMatch = dateStr.match(/(\d+)일/);
            if (!dayMatch) continue;
            const day = parseInt(dayMatch[1], 10);

            if (!timeStr || timeStr === '') continue;
            // 여의도점은 '휴가-휴가원제출' 등 문구가 있으므로 휴가도 제외 추가
            if (timeStr.includes('휴무') || timeStr.includes('연차') || timeStr.includes('휴가') || timeStr.includes('반차')) continue;

            const timeMatch = timeStr.match(/(\d+):(\d+)\s*[-~]\s*(\d+):(\d+)/);
            if (!timeMatch) continue;

            let sh = parseInt(timeMatch[1], 10);
            let sm = parseInt(timeMatch[2], 10);
            let eh = parseInt(timeMatch[3], 10);
            let em = parseInt(timeMatch[4], 10);

            if (sh <= 7) sh += 12;
            if (eh <= 12 && eh <= sh) {
                eh += 12;
            }

            const startTime = new Date(CONFIG.YEAR, targetMonth - 1, day, sh, sm);
            const endTime = new Date(CONFIG.YEAR, targetMonth - 1, day, eh, em);

            if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) continue;

            const dayOfWeek = startTime.getDay();
            let shiftLabel = "";

            if (dayOfWeek >= 1 && dayOfWeek <= 5 && sh === 8 && eh === 20) {
                shiftLabel = "풀근무";
            } else if (dayOfWeek === 6 && sh === 11 && eh === 19) {
                shiftLabel = "풀근무";
            } else if (dayOfWeek === 0 && sh === 11 && eh === 18) {
                shiftLabel = "풀근무";
            } else {
                const isOpen = (sh === 8);
                const isClose = (eh === 20);

                if (isOpen && isClose) {
                    shiftLabel = "풀근무";
                } else if (isOpen) {
                    shiftLabel = "오픈";
                } else if (isClose) {
                    shiftLabel = "마감";
                }
            }

            const eventTitle = shiftLabel
                ? `[${shiftLabel}] ${block.name} (${timeStr})`
                : `${block.name} (${timeStr})`;

            try {
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
                    Utilities.sleep(150);
                }
            } catch (err) {
                console.error(`Row ${r + 1}, Col ${block.colStart + 1} Error: ${err.message}`);
                errorCount++;
            }
        }
    }

    ui.alert(`전송 완료!\n- 추가된 스케줄: ${successCount}건\n- 오류: ${errorCount}건\n(기존에 등록된 일정은 자동 제외됨)`);
}
