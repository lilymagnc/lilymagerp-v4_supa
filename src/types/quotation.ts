import { Timestamp } from "firebase/firestore";

export interface QuotationItem {
  id: string; // Product ID or custom ID
  name: string;
  quantity: number;
  price: number;
  unit?: string;
  description?: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g., Q-20231027-001
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  validUntil: Timestamp | Date;

  customer: {
    id?: string;
    name: string;
    companyName?: string;
    contact?: string;
    email?: string;
    address?: string;
  };

  items: QuotationItem[];

  summary: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number; // VAT
    totalAmount: number;
    includeVat: boolean; // VAT inclusion flag
  };

  status: 'draft' | 'sent' | 'accepted' | 'rejected';

  notes?: string; // Internal notes
  terms?: string; // Terms and conditions to display on the quotation

  branchId: string;
  branchName: string;

  provider: {
    name: string;
    representative: string;
    address: string;
    contact: string;
    email: string;
    businessNumber: string;
  };

  createdBy: string; // User ID
}
