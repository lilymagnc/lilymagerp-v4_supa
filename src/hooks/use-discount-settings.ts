"use client";

import { useDiscountContext } from '@/context/discount-context';

export function useDiscountSettings() {
  return useDiscountContext();
}
