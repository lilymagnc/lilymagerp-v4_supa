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
  type: 'quotation' | 'receipt' | 'statement'; // Added type
  quotationNumber: string; // e.g., Q-20231027-001
  createdAt: Date | string;
  updatedAt: Date | string;
  validUntil: Date | string;

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
    account?: string;
  };

  createdBy: string; // User ID
}
