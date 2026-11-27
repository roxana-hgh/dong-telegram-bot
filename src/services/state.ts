// src/services/state.ts
// The only place that writes conversation state (User.step + User.draft).
import { prisma } from "@/db/client";
import { Prisma } from "@/generated/prisma/client";

export type Draft = {
  tripId: number;
  expenseId?: number; // set when editing an existing expense
  amount?: number;
  description?: string;
  paidBy?: number;
  participants?: number[];
  mid?: number; // id of the bot message that currently shows the card/prompt
  chain?: boolean; // wizard mode: after the amount, ask for the description
};

/** Set step and draft together; a missing draft clears it. */
export const setState = (userId: number, step: string | null, draft?: Draft) =>
  prisma.user.update({
    where: { id: userId },
    data: { step, draft: draft ? (draft as Prisma.InputJsonValue) : Prisma.DbNull },
  });

/**
 * Atomically clears the state only if the step still starts with `prefix`.
 * Returns true for exactly one of several concurrent callers (double taps),
 * which makes "confirm" buttons idempotent.
 */
export async function claimState(userId: number, prefix: string): Promise<boolean> {
  const r = await prisma.user.updateMany({
    where: { id: userId, step: { startsWith: prefix } },
    data: { step: null, draft: Prisma.DbNull },
  });
  return r.count === 1;
}
