// src/services/state.ts
import { prisma } from "@/db/client";
import { Prisma } from "@/generated/prisma/client";

export type Draft = {
  tripId: number;
  amount?: number;
  description?: string;
  paidBy?: number;
  participants?: number[];
};

export const setState = (userId: number, step: string | null, draft?: Draft) =>
  prisma.user.update({
    where: { id: userId },
    data: { step, draft: draft ? (draft as Prisma.InputJsonValue) : Prisma.DbNull },
  });