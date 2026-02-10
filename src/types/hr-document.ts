

export interface HRDocument {
  id: string;
  documentType: '휴직원' | '퇴직원' | '휴가원' | '휴직계' | '퇴직계' | '휴가계';
  userId: string;
  userName: string;
  submissionDate: string | Date;
  status: '처리중' | '승인' | '반려';
  contents?: {
    department?: string;
    position?: string;
    name?: string;
    joinDate?: string | Date;
    startDate?: string | Date;
    endDate?: string | Date;
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
  approvedDate?: string | Date;
}
