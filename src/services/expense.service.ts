// src/services/expense.service.ts
import { prisma } from "@/db/client";
import { splitEqually } from "@/services/split";

export type ExpenseData = {
  paidByMemberId: number;
  amount: number;
  description: string;
  participantIds: number[];
};

async function assertValid(tripId: number, d: ExpenseData) {
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
  if (trip.status !== "OPEN") throw new Error("TRIP_SETTLED");
  if (!Number.isInteger(d.amount) || d.amount <= 0) throw new Error("BAD_AMOUNT");
  if (d.participantIds.length === 0) throw new Error("NO_PARTICIPANTS");

  // All members must belong to this group: callback_data is not trustworthy
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

/** Edit = delete old shares and re-create them, inside one transaction */
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

/** Shares are removed by the cascade; settled trips are read-only */
export async function deleteExpense(expenseId: number) {
  const e = await prisma.expense.findUniqueOrThrow({
    where: { id: expenseId },
    include: { trip: true },
  });
  if (e.trip.status !== "OPEN") throw new Error("TRIP_SETTLED");
  await prisma.expense.delete({ where: { id: expenseId } });
}

export const setTripStatus = (tripId: number, status: "OPEN" | "SETTLED") =>
  prisma.trip.update({ where: { id: tripId }, data: { status } });

/** Smart default payer: whoever paid last in this trip, else the user's own member, else the first member */
export async function defaultPayer(tripId: number, userId: number, memberIds: number[]) {
  const last = await prisma.expense.findFirst({
    where: { tripId },
    orderBy: { id: "desc" },
    select: { paidByMemberId: true },
  });
  if (last && memberIds.includes(last.paidByMemberId)) return last.paidByMemberId;
  const own = await prisma.member.findFirst({ where: { userId, id: { in: memberIds } } });
  return own?.id ?? memberIds[0];
}
