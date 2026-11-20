// src/services/settle.ts
import type { ExpenseInput } from "@/services/balances";

export type Transfer = { from: number; to: number; amount: number };

/** حالت پیش‌فرض: کمترین تعداد تراکنش (حریصانه، حداکثر n−1 تراکنش) */
export function settleMinimal(net: Map<number, number>): Transfer[] {
  const debtors: { id: number; amt: number }[] = [];
  const creditors: { id: number; amt: number }[] = [];
  for (const [id, v] of net) {
    if (v < 0) debtors.push({ id, amt: -v });
    else if (v > 0) creditors.push({ id, amt: v });
  }
  const desc = (a: { amt: number }, b: { amt: number }) => b.amt - a.amt;
  debtors.sort(desc);
  creditors.sort(desc);

  const out: Transfer[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amt -= pay;
    creditors[j].amt -= pay;
    if (debtors[i].amt === 0) i++;
    if (creditors[j].amt === 0) j++;
  }
  return out;
}

/** حالت دوم: پرداخت مستقیم، یعنی هر نفر به همون کسی که برایش خرج کرده پول می‌ده (بین هر دو نفر فقط خالصِ دوطرفه) */
export function settleDirect(expenses: ExpenseInput[]): Transfer[] {
  const pair = new Map<string, number>(); // "a:b" با a<b ؛ مثبت یعنی a به b بدهکاره
  for (const e of expenses) {
    for (const s of e.shares) {
      if (s.memberId === e.paidByMemberId) continue;
      const debtor = s.memberId, creditor = e.paidByMemberId;
      const a = Math.min(debtor, creditor), b = Math.max(debtor, creditor);
      const key = `${a}:${b}`;
      pair.set(key, (pair.get(key) ?? 0) + (debtor === a ? s.amount : -s.amount));
    }
  }
  const out: Transfer[] = [];
  for (const [key, v] of pair) {
    if (v === 0) continue;
    const [a, b] = key.split(":").map(Number);
    out.push(v > 0 ? { from: a, to: b, amount: v } : { from: b, to: a, amount: -v });
  }
  return out;
}