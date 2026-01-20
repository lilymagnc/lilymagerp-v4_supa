import { Timestamp } from 'firebase/firestore';

export interface DailySettlementRecord {
    id: string; // branchId_date
    branchId: string;
    branchName: string;
    date: string; // YYYY-MM-DD
    previousVaultBalance: number; // 전일 시재
    vaultDeposit: number;        // 시재 입금 (금고 -> 은행)
    cashSalesToday?: number;     // 당일 현금 매출 (스냅샷)
    deliveryCostCashToday?: number; // 당일 배송비 현금 지급 합계 (스냅샷)
    manualTransportCount?: number;   // 수동 입력 운송비 건수
    manualTransportAmount?: number;  // 수동 입력 운송비 금액
    cashExpenseToday?: number;   // 기타 현금 지출 합계 (간편지출)
    memo?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
