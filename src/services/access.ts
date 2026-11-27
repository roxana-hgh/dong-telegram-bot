// src/services/access.ts  (ownership checks; every callback must go through these)
import { prisma } from "@/db/client";

const membersInOrder = { include: { members: { orderBy: { id: "asc" as const } } } };

export const getOwnedGroup = (userId: number, groupId: number) =>
  prisma.group.findFirst({
    where: { id: groupId, ownerId: userId },
    ...membersInOrder,
  });

export const getOwnedTrip = (userId: number, tripId: number) =>
  prisma.trip.findFirst({
    where: { id: tripId, group: { ownerId: userId } },
    include: { group: membersInOrder },
  });

export const getOwnedMember = (userId: number, memberId: number) =>
  prisma.member.findFirst({
    where: { id: memberId, group: { ownerId: userId } },
    include: { group: true },
  });

export const getOwnedExpense = (userId: number, expenseId: number) =>
  prisma.expense.findFirst({
    where: { id: expenseId, trip: { group: { ownerId: userId } } },
    include: {
      shares: { orderBy: { memberId: "asc" } },
      trip: { include: { group: membersInOrder } },
    },
  });

export type OwnedTrip = NonNullable<Awaited<ReturnType<typeof getOwnedTrip>>>;
