import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats Indian Rupees into readable compact strings:
 * e.g., 20000000 -> "₹2.00 Cr"
 *        7500000 -> "₹75.0 L"
 */
export function formatRupees(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "₹0";
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    const lk = amount / 100000;
    return `₹${lk % 1 === 0 ? lk.toFixed(0) : lk.toFixed(1)} L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatIndianNumber(val: number): string {
  return val.toLocaleString("en-IN");
}

export const FRANCHISE_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  CSK: { bg: "bg-[#f9cd05]", text: "text-neutral-900", border: "border-[#f9cd05]", hex: "#f9cd05" },
  MI: { bg: "bg-[#004ba0]", text: "text-white", border: "border-[#004ba0]", hex: "#004ba0" },
  RCB: { bg: "bg-[#d71920]", text: "text-white", border: "border-[#d71920]", hex: "#d71920" },
  KKR: { bg: "bg-[#3a225d]", text: "text-amber-300", border: "border-[#3a225d]", hex: "#3a225d" },
  SRH: { bg: "bg-[#f26522]", text: "text-white", border: "border-[#f26522]", hex: "#f26522" },
  DC: { bg: "bg-[#0078bc]", text: "text-white", border: "border-[#0078bc]", hex: "#0078bc" },
  RR: { bg: "bg-[#ea1a85]", text: "text-white", border: "border-[#ea1a85]", hex: "#ea1a85" },
  GT: { bg: "bg-[#1c2c5b]", text: "text-amber-200", border: "border-[#1c2c5b]", hex: "#1c2c5b" },
  LSG: { bg: "bg-[#a72056]", text: "text-white", border: "border-[#a72056]", hex: "#a72056" },
  PBKS: { bg: "bg-[#dd1f2d]", text: "text-white", border: "border-[#dd1f2d]", hex: "#dd1f2d" },
};

export function getBidIncrement(bidAmount: number): number {
  if (bidAmount < 10000000) {
    return 500000; // ₹5 Lakh (< ₹1 Cr)
  } else if (bidAmount < 20000000) {
    return 1000000; // ₹10 Lakh (₹1 Cr - ₹2 Cr)
  } else if (bidAmount < 50000000) {
    return 2000000; // ₹20 Lakh (₹2 Cr - ₹5 Cr)
  } else {
    return 5000000; // ₹50 Lakh (>= ₹5 Cr)
  }
}

export function calculateNextLegalBid(currentBid: number, basePrice: number): { nextBid: number; increment: number } {
  if (currentBid <= 0) {
    return { nextBid: basePrice, increment: getBidIncrement(basePrice) };
  }
  const increment = getBidIncrement(currentBid);
  return { nextBid: currentBid + increment, increment };
}
