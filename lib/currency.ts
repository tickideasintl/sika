import { getBoundWorkspace } from "./workspace-runtime";

export const DEFAULT_CURRENCY = "GBP";
export const ACTIVE_WORKSPACE_CURRENCY_KEY = "activeWorkspaceCurrency";

export const SUPPORTED_CURRENCIES = [
  { code: "GBP", label: "British Pound" },
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "NGN", label: "Nigerian Naira" },
  { code: "KES", label: "Kenyan Shilling" },
  { code: "ZAR", label: "South African Rand" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "GHS", label: "Ghanaian Cedi" },
  { code: "INR", label: "Indian Rupee" },
] as const;

export function getStoredWorkspaceCurrency() {
  // Kept for existing formatters: currency follows this tab, not shared storage.
  return getBoundWorkspace()?.currency ?? null;
}

export function setStoredWorkspaceCurrency(currency: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_WORKSPACE_CURRENCY_KEY, currency);
}

export function resolvePreferredCurrency(currency?: string | null) {
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY;
}
