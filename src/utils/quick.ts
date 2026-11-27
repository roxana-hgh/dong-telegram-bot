// src/utils/quick.ts
import { parseAmount } from "@/utils/money";

/**
 * Quick-add parser: "120000 شام" or "شام 120000" (Persian digits and separators work).
 * Returns the amount and an optional description, or null if no amount is found.
 */
export function parseQuick(input: string): { amount: number; description: string } | null {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const first = parseAmount(tokens[0]);
  if (first) return { amount: first, description: tokens.slice(1).join(" ").slice(0, 100) };

  const last = tokens.length > 1 ? parseAmount(tokens[tokens.length - 1]) : null;
  if (last) return { amount: last, description: tokens.slice(0, -1).join(" ").slice(0, 100) };

  return null;
}
