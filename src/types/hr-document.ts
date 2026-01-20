import type { Timestamp } from 'firebase/firestore';

export interface HRDocument {
  id: string;
  documentType: '휴직원' | '퇴직원' | '휴가원' | '휴직계' | '퇴직계' | '휴가계';
  userId: string;
  userName: string;
  submissionDate: Timestamp;
  status: '처리중' | '승인' | '반려';
  contents?: {
    department?: string;
    position?: string;
    name?: string;
    joinDate?: Timestamp;
    startDate?: Timestamp;
    endDate?: Timestamp;
    reason?: string;
    contact?: string;
    handover?: string;
    leaveType?: string;
  };
  fileUrl?: string;
  submissionMethod?: 'online' | 'file-upload';
  extractedFromFile?: boolean;
  originalFileName?: string;
  approverId?: string;
  approvedDate?: Timestamp;
}
