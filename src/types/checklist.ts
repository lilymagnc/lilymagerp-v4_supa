import { Timestamp } from "firebase/firestore";

// 체크리스트 템플릿
export interface ChecklistTemplate {
  id: string;
  name: string;
  category: 'daily' | 'weekly' | 'monthly';
  items: ChecklistItem[];
  branchId: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// 체크리스트 항목
export interface ChecklistItem {
  id: string;
  order: number;
  title: string;
  description?: string;
  category: 'daily' | 'weekly' | 'monthly';
  required: boolean;
}

// 개별 항목 체크 기록
export interface ChecklistItemRecord {
  itemId: string;
  checked: boolean;
  checkedAt?: Timestamp;
  checkedBy?: string;
  notes?: string;
}

// 실제 체크리스트 기록
export interface ChecklistRecord {
  id: string;
  templateId: string;
  branchId: string;
  branchName: string; // 지점 이름
  date: string; // "2025-01-20"
  week: string; // "2025-W03"
  month: string; // "2025-01"
  category: 'daily' | 'weekly' | 'monthly';
  
  // 담당자 정보 (직접 입력)
  openWorker: string;
  closeWorker: string;
  responsiblePerson: string;
  
  items: ChecklistItemRecord[];
  completedBy: string;
  completedAt: Timestamp;
  status: 'pending' | 'completed' | 'partial';
  
  // 메타 정보
  notes?: string;
  weather?: string;
  specialEvents?: string;
}

// 근무자 정보 (자동완성용)
export interface Worker {
  id: string;
  name: string;
  branchId: string;
  createdAt: Timestamp;
  lastUsed: Timestamp;
}

// 체크리스트 통계
export interface ChecklistStats {
  totalItems: number;
  completedItems: number;
  completionRate: number;
  lastUpdated: Timestamp;
}

// 체크리스트 필터
export interface ChecklistFilter {
  date?: string;
  week?: string;
  month?: string;
  status?: 'pending' | 'completed' | 'partial';
  worker?: string;
  branchId?: string; // 본사 관리자가 특정 지점 필터링용
}
