// src/services/expense.service.ts
import { prisma } from "@/db/client";
import { splitEqually } from "@/services/split";

type ExpenseData = {
  paidByMemberId: number;
  amount: number;
  description: string;
  participantIds: number[];
};

async function assertValid(tripId: number, d: ExpenseData) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  if (trip.status !== "OPEN") throw new Error("TRIP_SETTLED");
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new Error("BAD_AMOUNT");

  // همه‌ی اعضا باید عضو همین گروه باشن، چون callback_data قابل اعتماد نیست
  const ids = [...new Set([d.paidByMemberId, ...d.participantIds])];
  const count = await prisma.member.count({ where: { id: { in: ids }, groupId: trip.groupId } });
  if (count !== ids.length) throw new Error("BAD_MEMBERS");
}

export async function createExpense(tripId: number, d: ExpenseData) {
  await assertValid(tripId, d);
  return prisma.expense.create({
    data: {
      tripId,
      paidByMemberId: d.paidByMemberId,
      amount: d.amount,
      description: d.description,
      shares: { create: splitEqually(d.amount, d.participantIds) },
    },
  });
}

/** ویرایش = حذف سهم‌های قبلی و ساخت مجدد، داخل یک transaction */
export async function updateExpense(expenseId: number, d: ExpenseData) {
  const old = await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
  await assertValid(old.tripId, d);
  return prisma.$transaction([
    prisma.expenseShare.deleteMany({ where: { expenseId } }),
    prisma.expense.update({
      where: { id: expenseId },
      data: {
        paidByMemberId: d.paidByMemberId,
        amount: d.amount,
        description: d.description,
        shares: { create: splitEqually(d.amount, d.participantIds) },
      },
    }),
  ]);
}