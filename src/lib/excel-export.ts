import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { ChecklistRecord, ChecklistTemplate } from '@/types/checklist';
import { SimpleExpense } from '@/types/simple-expense';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// Product 인터페이스 정의
interface Product {
  id: string;
  docId: string;
  name: string;
  mainCategory: string;
  midCategory: string;
  price: number;
  supplier: string;
  stock: number;
  size: string;
  color: string;
  branch: string;
  code?: string;
  category?: string;
  status: string;
}

// 단일 체크리스트를 엑셀로 내보내기
export const exportSingleChecklist = (
  checklist: ChecklistRecord,
  template?: ChecklistTemplate
) => {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 체크리스트 기본 정보
  const basicInfo = [
    ['체크리스트 정보'],
    [''],
    ['날짜', checklist.date],
    ['카테고리', checklist.category === 'daily' ? '일일' : checklist.category === 'weekly' ? '주간' : '월간'],
    ['담당자', checklist.responsiblePerson || '미입력'],
    ['오픈 담당자', checklist.openWorker || '미입력'],
    ['마감 담당자', checklist.closeWorker || '미입력'],
    ['상태', checklist.status === 'completed' ? '완료' : checklist.status === 'partial' ? '진행중' : '대기'],
    ['메모', checklist.notes || ''],
    ['날씨', checklist.weather || ''],
    ['특별 이벤트', checklist.specialEvents || ''],
    [''],
  ];

  // 체크리스트 항목 데이터
  const itemsData = [
    ['체크리스트 항목'],
    [''],
    ['순서', '항목명', '상태', '체크 시간', '비고']
  ];

  checklist.items.forEach((item, index) => {
    const templateItem = template?.items.find(t => t.id === item.itemId);
    itemsData.push([
      String(index + 1),
      templateItem?.title || `항목 ${item.itemId}`,
      item.checked ? '완료' : '미완료',
      item.checkedAt ? format(item.checkedAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
      templateItem?.required ? '필수' : '선택'
    ]);
  });

  // 완료율 계산
  let completionRate = 0;
  if (template) {
    const requiredItems = template.items.filter(item => item.required && item.category === checklist.category);
    const requiredItemIds = requiredItems.map(item => item.id);
    const completedRequiredItems = checklist.items.filter(item =>
      item.checked && requiredItemIds.includes(item.itemId)
    ).length;
    completionRate = requiredItemIds.length > 0 ? (completedRequiredItems / requiredItemIds.length) * 100 : 0;
  } else {
    const totalItems = checklist.items.length;
    const completedItems = checklist.items.filter(item => item.checked).length;
    completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  }

  const summaryData = [
    [''],
    ['요약 정보'],
    [''],
    ['총 항목 수', checklist.items.length],
    ['완료 항목 수', checklist.items.filter(item => item.checked).length],
    ['완료율', `${completionRate.toFixed(1)}%`],
    ['생성일', checklist.completedAt ? format(checklist.completedAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '']
  ];

  // 모든 데이터를 하나의 배열로 합치기
  const allData = [...basicInfo, ...itemsData, ...summaryData];

  // 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet(allData);

  // 열 너비 설정
  ws['!cols'] = [
    { width: 15 }, // 순서
    { width: 40 }, // 항목명
    { width: 12 }, // 상태
    { width: 20 }, // 체크 시간
    { width: 15 }  // 비고
  ];

  // 워크북에 워크시트 추가
  const sheetName = `${checklist.category === 'daily' ? '일일' : checklist.category === 'weekly' ? '주간' : '월간'}체크리스트`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // 파일명 생성
  const fileName = `체크리스트_${checklist.date}_${checklist.category === 'daily' ? '일일' : checklist.category === 'weekly' ? '주간' : '월간'}.xlsx`;

  // 파일 다운로드
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
};

// 여러 체크리스트를 하나의 엑셀 파일로 내보내기
export const exportMultipleChecklists = (
  checklists: ChecklistRecord[],
  templates: Record<string, ChecklistTemplate>
) => {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 각 체크리스트를 별도 시트로 추가
  checklists.forEach((checklist, index) => {
    const template = templates[checklist.branchId];

    // 체크리스트 기본 정보
    const basicInfo = [
      ['체크리스트 정보'],
      [''],
      ['날짜', checklist.date],
      ['카테고리', checklist.category === 'daily' ? '일일' : checklist.category === 'weekly' ? '주간' : '월간'],
      ['담당자', checklist.responsiblePerson || '미입력'],
      ['오픈 담당자', checklist.openWorker || '미입력'],
      ['마감 담당자', checklist.closeWorker || '미입력'],
      ['상태', checklist.status === 'completed' ? '완료' : checklist.status === 'partial' ? '진행중' : '대기'],
      ['메모', checklist.notes || ''],
      ['날씨', checklist.weather || ''],
      ['특별 이벤트', checklist.specialEvents || ''],
      [''],
    ];

    // 체크리스트 항목 데이터
    const itemsData = [
      ['체크리스트 항목'],
      [''],
      ['순서', '항목명', '상태', '체크 시간', '비고']
    ];

    checklist.items.forEach((item, itemIndex) => {
      const templateItem = template?.items.find(t => t.id === item.itemId);
      itemsData.push([
        String(itemIndex + 1),
        templateItem?.title || `항목 ${item.itemId}`,
        item.checked ? '완료' : '미완료',
        item.checkedAt ? format(item.checkedAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '',
        templateItem?.required ? '필수' : '선택'
      ]);
    });

    // 완료율 계산
    let completionRate = 0;
    if (template) {
      const requiredItems = template.items.filter(item => item.required && item.category === checklist.category);
      const requiredItemIds = requiredItems.map(item => item.id);
      const completedRequiredItems = checklist.items.filter(item =>
        item.checked && requiredItemIds.includes(item.itemId)
      ).length;
      completionRate = requiredItemIds.length > 0 ? (completedRequiredItems / requiredItemIds.length) * 100 : 0;
    } else {
      const totalItems = checklist.items.length;
      const completedItems = checklist.items.filter(item => item.checked).length;
      completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    }

    const summaryData = [
      [''],
      ['요약 정보'],
      [''],
      ['총 항목 수', checklist.items.length],
      ['완료 항목 수', checklist.items.filter(item => item.checked).length],
      ['완료율', `${completionRate.toFixed(1)}%`],
      ['생성일', checklist.completedAt ? format(checklist.completedAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '']
    ];

    // 모든 데이터를 하나의 배열로 합치기
    const allData = [...basicInfo, ...itemsData, ...summaryData];

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(allData);

    // 열 너비 설정
    ws['!cols'] = [
      { width: 15 }, // 순서
      { width: 40 }, // 항목명
      { width: 12 }, // 상태
      { width: 20 }, // 체크 시간
      { width: 15 }  // 비고
    ];

    // 시트명 생성 (중복 방지)
    const baseSheetName = `${checklist.category === 'daily' ? '일일' : checklist.category === 'weekly' ? '주간' : '월간'}체크리스트`;
    const sheetName = checklists.filter(c => c.category === checklist.category).length > 1
      ? `${baseSheetName}_${index + 1}`
      : baseSheetName;

    // 워크북에 워크시트 추가
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  // 파일명 생성
  const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
  const fileName = `체크리스트_통합_${today}.xlsx`;

  // 파일 다운로드
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
};

// 체크리스트 요약 정보를 엑셀로 내보내기
export const exportChecklistSummary = (checklists: ChecklistRecord[]) => {
  // 워크북 생성
  const wb = XLSX.utils.book_new();

  // 요약 데이터 생성
  const summaryData = [
    ['체크리스트 요약'],
    [''],
    ['날짜', '카테고리', '담당자', '완료율', '상태', '생성일']
  ];

  checklists.forEach(checklist => {
    const totalItems = checklist.items.length;
    const completedItems = checklist.items.filter(item => item.checked).length;
    const completionRate = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    summaryData.push([
      checklist.date,
      checklist.category === 'daily' ? '일일' : checklist.category === 'weekly' ? '주간' : '월간',
      checklist.responsiblePerson || '미입력',
      `${completionRate.toFixed(1)}%`,
      checklist.status === 'completed' ? '완료' : checklist.status === 'partial' ? '진행중' : '대기',
      checklist.completedAt ? format(checklist.completedAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : ''
    ]);
  });

  // 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet(summaryData);

  // 열 너비 설정
  ws['!cols'] = [
    { width: 15 }, // 날짜
    { width: 12 }, // 카테고리
    { width: 20 }, // 담당자
    { width: 12 }, // 완료율
    { width: 12 }, // 상태
    { width: 20 }  // 생성일
  ];

  // 워크북에 워크시트 추가
  XLSX.utils.book_append_sheet(wb, ws, '요약');

  // 파일명 생성
  const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
  const fileName = `체크리스트_요약_${today}.xlsx`;

  // 파일 다운로드
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
};

// 픽업/배송 예약 현황 엑셀 출력 함수
export const exportPickupDeliveryToExcel = (
  orders: any[],
  type: 'pickup' | 'delivery',
  startDate: string,
  endDate: string
) => {
  // 날짜 필터링
  const filteredOrders = orders.filter(order => {
    const orderDate = order.orderDate?.toDate?.() || new Date(order.orderDate);
    const orderDateStr = orderDate.toISOString().split('T')[0];
    return orderDateStr >= startDate && orderDateStr <= endDate;
  });

  // 헤더 정의
  const headers = type === 'pickup'
    ? [
      '주문번호', '주문일시', '주문자명', '주문자연락처', '픽업자명', '픽업자연락처',
      '픽업예정일', '픽업예정시간', '지점명', '주문상태', '상품금액', '배송비', '총금액', '결제방법', '결제상태'
    ]
    : [
      '주문번호', '주문일시', '주문자명', '주문자연락처', '수령자명', '수령자연락처',
      '배송예정일', '배송예정시간', '배송지주소', '배송지역', '배송기사소속', '배송기사명',
      '배송기사연락처', '지점명', '주문상태', '상품금액', '배송비', '실제배송비', '배송비차익', '총금액', '결제방법', '결제상태'
    ];

  // 데이터 변환
  const data = filteredOrders.map(order => {
    const orderDate = order.orderDate?.toDate?.() || new Date(order.orderDate);
    const formattedOrderDate = orderDate.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const baseData = [
      order.id,
      formattedOrderDate,
      order.orderer?.name || '-',
      order.orderer?.contact || '-',
    ];

    if (type === 'pickup') {
      return [
        ...baseData,
        order.pickupInfo?.pickerName || '-',
        order.pickupInfo?.pickerContact || '-',
        order.pickupInfo?.date || '-',
        order.pickupInfo?.time || '-',
        order.branchName || '-',
        order.status || '-',
        (order.summary?.subtotal || 0).toLocaleString(),
        (order.summary?.deliveryFee || 0).toLocaleString(),
        (order.summary?.total || 0).toLocaleString(),
        order.payment?.method || '-',
        order.payment?.status || '-'
      ];
    } else {
      return [
        ...baseData,
        order.deliveryInfo?.recipientName || '-',
        order.deliveryInfo?.recipientContact || '-',
        order.deliveryInfo?.date || '-',
        order.deliveryInfo?.time || '-',
        order.deliveryInfo?.address || '-',
        order.deliveryInfo?.district || '-',
        order.deliveryInfo?.driverAffiliation || '-',
        order.deliveryInfo?.driverName || '-',
        order.deliveryInfo?.driverContact || '-',
        order.branchName || '-',
        order.status || '-',
        (order.summary?.subtotal || 0).toLocaleString(),
        (order.summary?.deliveryFee || 0).toLocaleString(),
        order.actualDeliveryCost ? order.actualDeliveryCost.toLocaleString() : '-',
        order.deliveryProfit !== undefined ? order.deliveryProfit.toLocaleString() : '-',
        (order.summary?.total || 0).toLocaleString(),
        order.payment?.method || '-',
        order.payment?.status || '-'
      ];
    }
  });

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // 열 너비 설정
  const colWidths = type === 'pickup'
    ? [
      { width: 15 }, // 주문번호
      { width: 20 }, // 주문일시
      { width: 12 }, // 주문자명
      { width: 15 }, // 주문자연락처
      { width: 12 }, // 픽업자명
      { width: 15 }, // 픽업자연락처
      { width: 12 }, // 픽업예정일
      { width: 10 }, // 픽업예정시간
      { width: 12 }, // 지점명
      { width: 10 }, // 주문상태
      { width: 12 }, // 상품금액
      { width: 10 }, // 배송비
      { width: 12 }, // 총금액
      { width: 10 }, // 결제방법
      { width: 10 }, // 결제상태
    ]
    : [
      { width: 15 }, // 주문번호
      { width: 20 }, // 주문일시
      { width: 12 }, // 주문자명
      { width: 15 }, // 주문자연락처
      { width: 12 }, // 수령자명
      { width: 15 }, // 수령자연락처
      { width: 12 }, // 배송예정일
      { width: 10 }, // 배송예정시간
      { width: 30 }, // 배송지주소
      { width: 12 }, // 배송지역
      { width: 15 }, // 배송기사소속
      { width: 12 }, // 배송기사명
      { width: 15 }, // 배송기사연락처
      { width: 12 }, // 지점명
      { width: 10 }, // 주문상태
      { width: 12 }, // 상품금액
      { width: 10 }, // 배송비
      { width: 12 }, // 실제배송비
      { width: 12 }, // 배송비차익
      { width: 12 }, // 총금액
      { width: 10 }, // 결제방법
      { width: 10 }, // 결제상태
    ];

  worksheet['!cols'] = colWidths;

  // 시트 이름 설정
  const sheetName = type === 'pickup' ? '픽업예약현황' : '배송예약현황';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 파일명 생성
  const typeText = type === 'pickup' ? '픽업예약' : '배송예약';
  const fileName = `${typeText}_현황_${startDate}_${endDate}.xlsx`;

  // 파일 다운로드
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array'
  });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// 주문 내보내기 함수
export const exportOrdersToExcel = (orders: any[], startDate?: string, endDate?: string) => {
  try {
    // 입력 데이터 검증
    if (!orders || !Array.isArray(orders)) {
      throw new Error('주문 데이터가 올바르지 않습니다.');
    }

    // 날짜 필터링 (선택사항)
    let filteredOrders = orders;
    if (startDate && endDate) {
      filteredOrders = orders.filter(order => {
        const orderDate = order.orderDate?.toDate?.() || new Date(order.orderDate);
        const orderDateStr = orderDate.toISOString().split('T')[0];
        return orderDateStr >= startDate && orderDateStr <= endDate;
      });
    }

    // 헤더 정의
    const headers = [
      '주문번호', '주문일시', '지점명', '주문자명', '주문자연락처', '주문상태',
      '상품명', '수량', '단가', '상품금액', '배송비', '총금액',
      '결제방법', '결제상태', '픽업예정일', '픽업예정시간', '배송예정일', '배송예정시간',
      '배송지주소', '수령자명', '수령자연락처', '메모', '생성일'
    ];

    // 데이터 변환
    const data = filteredOrders.map(order => {
      const orderDate = order.orderDate?.toDate?.() || new Date(order.orderDate);
      const formattedOrderDate = orderDate.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      // 상품 정보 (첫 번째 상품만 표시, 나머지는 별도 행으로)
      const firstItem = order.items?.[0];
      const itemName = firstItem ? firstItem.name : '-';
      const itemQuantity = firstItem ? firstItem.quantity : 0;
      const itemPrice = firstItem ? firstItem.price : 0;
      const itemTotal = firstItem ? (firstItem.price * firstItem.quantity) : 0;

      return [
        order.id,
        formattedOrderDate,
        order.branchName || '-',
        order.orderer?.name || '-',
        order.orderer?.contact || '-',
        order.status || '-',
        itemName,
        itemQuantity,
        (itemPrice || 0).toLocaleString(),
        (itemTotal || 0).toLocaleString(),
        (order.summary?.deliveryFee || 0).toLocaleString(),
        (order.summary?.total || 0).toLocaleString(),
        order.payment?.method || '-',
        order.payment?.status || '-',
        order.pickupInfo?.date || '-',
        order.pickupInfo?.time || '-',
        order.deliveryInfo?.date || '-',
        order.deliveryInfo?.time || '-',
        order.deliveryInfo?.address || '-',
        order.deliveryInfo?.recipientName || '-',
        order.deliveryInfo?.recipientContact || '-',
        order.memo || '-',
        order.createdAt ? format(order.createdAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'
      ];
    });

    // 추가 상품이 있는 경우 별도 행으로 추가
    const additionalRows: any[] = [];
    filteredOrders.forEach(order => {
      if (order.items && order.items.length > 1) {
        for (let i = 1; i < order.items.length; i++) {
          const item = order.items[i];
          additionalRows.push([
            order.id,
            '', // 주문일시는 첫 번째 행에만 표시
            '', // 지점명
            '', // 주문자명
            '', // 주문자연락처
            '', // 주문상태
            item.name,
            item.quantity,
            (item.price || 0).toLocaleString(),
            ((item.price || 0) * (item.quantity || 0)).toLocaleString(),
            '', // 배송비
            '', // 총금액
            '', // 결제방법
            '', // 결제상태
            '', // 픽업예정일
            '', // 픽업예정시간
            '', // 배송예정일
            '', // 배송예정시간
            '', // 배송지주소
            '', // 수령자명
            '', // 수령자연락처
            '', // 메모
            ''  // 생성일
          ]);
        }
      }
    });

    // 모든 데이터 합치기
    const allData = [headers, ...data, ...additionalRows];

    // 워크북 생성
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(allData);

    // 열 너비 설정
    worksheet['!cols'] = [
      { width: 15 }, // 주문번호
      { width: 20 }, // 주문일시
      { width: 12 }, // 지점명
      { width: 12 }, // 주문자명
      { width: 15 }, // 주문자연락처
      { width: 10 }, // 주문상태
      { width: 30 }, // 상품명
      { width: 8 },  // 수량
      { width: 12 }, // 단가
      { width: 12 }, // 상품금액
      { width: 10 }, // 배송비
      { width: 12 }, // 총금액
      { width: 10 }, // 결제방법
      { width: 10 }, // 결제상태
      { width: 12 }, // 픽업예정일
      { width: 10 }, // 픽업예정시간
      { width: 12 }, // 배송예정일
      { width: 10 }, // 배송예정시간
      { width: 30 }, // 배송지주소
      { width: 12 }, // 수령자명
      { width: 15 }, // 수령자연락처
      { width: 20 }, // 메모
      { width: 20 }  // 생성일
    ];

    // 시트 이름 설정
    XLSX.utils.book_append_sheet(workbook, worksheet, '주문내역');

    // 파일명 생성
    const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
    const fileName = startDate && endDate
      ? `주문내역_${startDate}_${endDate}.xlsx`
      : `주문내역_${today}.xlsx`;

    // 파일 다운로드
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array'
    });
    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('엑셀 내보내기 오류:', error);
    throw error;
  }
};

// 간편지출 내보내기 함수
export const exportToExcel = (
  dataOrExpenses: any[] | SimpleExpense[],
  fileNameOrStartDate?: string,
  endDate?: string
) => {
  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  let finalFileName = fileNameOrStartDate || `export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

  // 데이터가 시트 설정 배열인 경우 (예: [{ name: 'Sheet1', data: [...] }])
  if (dataOrExpenses.length > 0 && 'name' in dataOrExpenses[0] && 'data' in dataOrExpenses[0]) {
    const sheets = dataOrExpenses as { name: string; data: any[] }[];
    sheets.forEach(sheet => {
      if (sheet.data && sheet.data.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(sheet.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      }
    });
    if (!finalFileName.endsWith('.xlsx')) finalFileName += '.xlsx';
  }
  // 기존 SimpleExpense[] 방식인 경우
  else {
    const expenses = dataOrExpenses as SimpleExpense[];
    const startDate = fileNameOrStartDate;

    // 날짜 필터링 (선택사항)
    let filteredExpenses = expenses;
    if (startDate && endDate) {
      filteredExpenses = expenses.filter(expense => {
        let expenseDate: Date;
        if (expense.date && typeof expense.date === 'object' && 'toDate' in expense.date) {
          expenseDate = expense.date.toDate();
        } else {
          expenseDate = new Date(expense.date as unknown as string | number);
        }
        const expenseDateStr = expenseDate.toISOString().split('T')[0];
        return expenseDateStr >= startDate && expenseDateStr <= endDate;
      });
    }

    const headers = ['날짜', '카테고리', '항목', '금액', '지점명', '담당자', '메모', '생성일'];
    const excelData = filteredExpenses.map(expense => {
      let expenseDate: Date;
      if (expense.date && typeof expense.date === 'object' && 'toDate' in expense.date) {
        expenseDate = expense.date.toDate();
      } else {
        expenseDate = new Date(expense.date as unknown as string | number);
      }
      return [
        format(expenseDate, 'yyyy-MM-dd', { locale: ko }),
        expense.category || '-',
        expense.description || '-',
        expense.amount?.toLocaleString() || '0',
        expense.branchName || '-',
        expense.supplier || '-',
        expense.description || '-',
        expense.createdAt && typeof expense.createdAt === 'object' && 'toDate' in expense.createdAt ?
          format(expense.createdAt.toDate(), 'yyyy-MM-dd HH:mm', { locale: ko }) : '-'
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...excelData]);
    worksheet['!cols'] = [
      { width: 12 }, { width: 15 }, { width: 25 }, { width: 12 },
      { width: 15 }, { width: 15 }, { width: 30 }, { width: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, '간편지출');

    if (!startDate || !endDate) {
      const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
      finalFileName = `간편지출_${today}.xlsx`;
    } else {
      finalFileName = `간편지출_${startDate}_${endDate}.xlsx`;
    }
  }

  // 파일 다운로드
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, finalFileName);
};

// 상품 내보내기 함수
export const exportProductsToExcel = (products: Product[], startDate?: string, endDate?: string) => {
  // 헤더 정의
  const headers = [
    '상품코드', '상품명', '대분류', '중분류', '가격', '공급업체', '재고', '사이즈', '색상', '지점', '상태'
  ];

  // 데이터 변환
  const data = products.map(product => {
    const statusText = product.status === 'active' ? '활성' :
      product.status === 'low_stock' ? '재고부족' :
        product.status === 'out_of_stock' ? '품절' : product.status;

    return [
      product.code || product.id || '-',
      product.name || '-',
      product.mainCategory || '-',
      product.midCategory || '-',
      product.price?.toLocaleString() || '0',
      product.supplier || '-',
      product.stock?.toString() || '0',
      product.size || '-',
      product.color || '-',
      product.branch || '-',
      statusText
    ];
  });

  // 워크북 생성
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // 열 너비 설정
  worksheet['!cols'] = [
    { width: 15 }, // 상품코드
    { width: 30 }, // 상품명
    { width: 15 }, // 대분류
    { width: 15 }, // 중분류
    { width: 12 }, // 가격
    { width: 20 }, // 공급업체
    { width: 10 }, // 재고
    { width: 10 }, // 사이즈
    { width: 12 }, // 색상
    { width: 20 }, // 지점
    { width: 12 }  // 상태
  ];

  // 시트 이름 설정
  XLSX.utils.book_append_sheet(workbook, worksheet, '상품목록');

  // 파일명 생성
  const today = format(new Date(), 'yyyy-MM-dd', { locale: ko });
  const fileName = startDate && endDate
    ? `상품목록_${startDate}_${endDate}.xlsx`
    : `상품목록_${today}.xlsx`;

  // 파일 다운로드
  const excelBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array'
  });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  saveAs(blob, fileName);
};

// 일일 마감 정산 내역 내보내기 함수
export const exportDailySettlementToExcel = (
  reportDate: string,
  currentTargetBranch: string,
  stats: any
) => {
  if (!stats) return;

  const wb = XLSX.utils.book_new();

  // 1. 정산 요약 시트
  const summaryData = [
    ['일일 마감 정산 요약'],
    [''],
    ['정산 일자', reportDate],
    ['지점명', currentTargetBranch === 'all' ? '전체 지점' : currentTargetBranch],
    [''],
    ['[정산 수익 합계]'],
    ['오늘 접수 총액 (발주 기준)', stats.totalPayment.toLocaleString() + '원'],
    ['발주 수금액 (내 지분)', stats.outgoingSettle.toLocaleString() + '원'],
    ['수주 수익 (이관 지분)', stats.incomingSettle.toLocaleString() + '원'],
    ['이월 주문 결제 (수금)', stats.prevOrderPaymentTotal.toLocaleString() + '원'],
    ['최종 실질 수익 (당일수금+이월수금)', stats.netSales.toLocaleString() + '원'],
    ['금일 미결제 금액', stats.pendingAmountToday.toLocaleString() + '원'],
    [''],
    ['[결제수단별 수금 현황]'],
    ['카드 결제', `${stats.paymentStats.card.count}건 / ${stats.paymentStats.card.amount.toLocaleString()}원`],
    ['현금 결제', `${stats.paymentStats.cash.count}건 / ${stats.paymentStats.cash.amount.toLocaleString()}원`],
    ['계좌 이체', `${stats.paymentStats.transfer.count}건 / ${stats.paymentStats.transfer.amount.toLocaleString()}원`],
    ['기타 결제', `${stats.paymentStats.others.count}건 / ${stats.paymentStats.others.amount.toLocaleString()}원`],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ width: 35 }, { width: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '정산요약');

  // 2. 당일 주문 상세 (오늘 접수된 모든 건)
  const dailyHeaders = ['번호', '주문시간', '주문번호', '고객명', '결제수단', '전체금액', '실질수익', '이관정보', '상태'];
  const dailyData = stats.dailyOrders.map((order: any, index: number) => {
    const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
    let myShare = 0;
    let info = "일반 주문";
    const isOriginal = order.branchName === currentTargetBranch;
    const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;

    if (currentTargetBranch === 'all') {
      myShare = order.summary.total;
      if (order.transferInfo?.isTransferred) info = `이관 (${order.branchName} → ${order.transferInfo.processBranchName})`;
    } else {
      if (order.transferInfo?.isTransferred) {
        if (isOriginal) {
          myShare = order.transferInfo?.isTransferred ? Math.round(order.summary.total * (split.orderBranch / 100)) : order.summary.total;
          info = `📤 발주 (${split.orderBranch}%)`;
        } else if (isProcess) {
          myShare = Math.round(order.summary.total * (split.processBranch / 100));
          info = `📥 수주 (${split.processBranch}%)`;
        }
      } else {
        myShare = order.summary.total;
      }
    }
    const orderDate = order.orderDate instanceof Date ? order.orderDate : (order.orderDate?.toDate?.() || new Date(order.orderDate));
    return [
      index + 1,
      format(orderDate, 'HH:mm:ss'),
      order.orderNumber || order.id.slice(0, 8),
      order.orderer?.name || '-',
      order.payment?.method || '-',
      order.summary?.total || 0,
      myShare,
      info,
      order.status === 'completed' ? '완료' : '진행중'
    ];
  });
  const wsDaily = XLSX.utils.aoa_to_sheet([dailyHeaders, ...dailyData]);
  wsDaily['!cols'] = [
    { width: 8 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 12 },
    { width: 15 }, { width: 15 }, { width: 30 }, { width: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDaily, '당일주문상세');

  // 3. 이월 수금 내역 상세
  const prevHeaders = ['번호', '주문일자', '주문번호', '고객명', '결제수단', '전체금액', '수금액', '수금시간', '상태'];
  const prevData = stats.previousOrderPayments.map((order: any, index: number) => {
    const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
    let myShare = 0;
    const isOriginal = order.branchName === currentTargetBranch;
    const isProcess = order.transferInfo?.isTransferred && order.transferInfo?.processBranchName === currentTargetBranch;

    if (currentTargetBranch === 'all') {
      myShare = order.summary.total;
    } else {
      if (isOriginal) {
        myShare = order.transferInfo?.isTransferred ? Math.round(order.summary.total * (split.orderBranch / 100)) : order.summary.total;
      } else if (isProcess) {
        myShare = Math.round(order.summary.total * (split.processBranch / 100));
      }
    }

    const orderDate = order.orderDate instanceof Date ? order.orderDate : (order.orderDate?.toDate?.() || new Date(order.orderDate));

    // 수금 시간 추출
    const completedAt = (order.payment as any).completedAt?.toDate?.() || (order.payment as any).completedAt;
    const secondPaymentDate = (order.payment as any).secondPaymentDate?.toDate?.() || (order.payment as any).secondPaymentDate;
    let cTime = '-';
    const from = stats.from;
    const to = stats.to;
    if (from && to) {
      if (completedAt && completedAt >= from && completedAt <= to) cTime = format(completedAt, 'HH:mm:ss');
      else if (secondPaymentDate && secondPaymentDate >= from && secondPaymentDate <= to) cTime = format(secondPaymentDate, 'HH:mm:ss');
    }

    return [
      index + 1,
      format(orderDate, 'yyyy-MM-dd'),
      order.orderNumber || order.id.slice(0, 8),
      order.orderer?.name || '-',
      order.payment?.method || '-',
      order.summary?.total || 0,
      myShare,
      cTime,
      order.status === 'completed' ? '완료' : '진행중'
    ];
  });
  const wsPrev = XLSX.utils.aoa_to_sheet([prevHeaders, ...prevData]);
  wsPrev['!cols'] = [
    { width: 8 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 },
    { width: 15 }, { width: 15 }, { width: 12 }, { width: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, wsPrev, '이월수금내역');

  // 4. 금일 미결제 내역 상세
  const pendingHeaders = dailyHeaders;
  const pendingData = stats.pendingOrdersToday.map((order: any, index: number) => {
    const split = order.transferInfo?.amountSplit || { orderBranch: 100, processBranch: 0 };
    let myShare = 0;
    let info = order.transferInfo?.isTransferred ? (order.branchName === currentTargetBranch ? '📤 발주' : '📥 수주') : '일반';

    if (currentTargetBranch === 'all') {
      myShare = order.summary.total;
    } else {
      if (order.branchName === currentTargetBranch) {
        myShare = order.transferInfo?.isTransferred ? Math.round(order.summary.total * (split.orderBranch / 100)) : order.summary.total;
      }
    }
    const orderDate = order.orderDate instanceof Date ? order.orderDate : (order.orderDate?.toDate?.() || new Date(order.orderDate));
    return [
      index + 1,
      format(orderDate, 'HH:mm:ss'),
      order.orderNumber || order.id.slice(0, 8),
      order.orderer?.name || '-',
      order.payment?.method || '-',
      order.summary?.total || 0,
      myShare,
      info,
      '진행중'
    ];
  });
  const wsPending = XLSX.utils.aoa_to_sheet([pendingHeaders, ...pendingData]);
  wsPending['!cols'] = wsDaily['!cols'];
  XLSX.utils.book_append_sheet(wb, wsPending, '금일미결제내역');

  // 파일 생성 및 다운로드
  const fileName = `일일정산_${currentTargetBranch}_${reportDate}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, fileName);
};
