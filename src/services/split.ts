
export type Share = { memberId: number; amount: number };

/** Split equally; distribute the remainder one by one to the first members so the shares sum exactly to amount. */
export function splitEqually(amount: number, memberIds: number[]): Share[] {
  if (memberIds.length === 0) throw new Error("no participants");
  const ids = [...memberIds].sort((a, b) => a - b); // stable order
  const base = Math.floor(amount / ids.length);
  const rem = amount % ids.length;
  return ids.map((memberId, i) => ({ memberId, amount: base + (i < rem ? 1 : 0) }));
}
// splitEqually(100, [1, 2, 3]) → 34, 33, 33