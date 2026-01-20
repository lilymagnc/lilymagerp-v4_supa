export interface DiscountRate {
  rate: number;
  label: string;
  isActive: boolean;
}
export interface BranchDiscountSettings {
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  discountRates: DiscountRate[];
  customRate: number;
  minOrderAmount: number;
  allowDuplicateDiscount: boolean;
  allowPointAccumulation: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface GlobalDiscountSettings {
  startDate: Date;
  endDate: Date;
  allowDuplicateDiscount: boolean;
  allowPointAccumulation: boolean;
  minOrderAmount: number;
}
export interface DiscountSettings {
  globalSettings: GlobalDiscountSettings;
  branchSettings: Record<string, BranchDiscountSettings>;
}
