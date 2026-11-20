// src/services/balances.ts
export type ExpenseInput = {
  paidByMemberId: number;
  amount: number;
  shares: { memberId: number; amount: number }[];
};

/** خالص هر عضو = پرداختی − سهم‌ها (مثبت = بستانکار) */
export function computeBalances(expenses: ExpenseInput[]): Map<number, number> {
  const net = new Map<number, number>();
  const add = (id: number, v: number) => net.set(id, (net.get(id) ?? 0) + v);
  for (const e of expenses) {
    add(e.paidByMemberId, e.amount);
    for (const s of e.shares) add(s.memberId, -s.amount);
  }
  return net;
}