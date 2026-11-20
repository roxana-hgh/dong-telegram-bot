import { prisma } from "./client";

export function upsertUser(telegramId: number, name: string) {
  return prisma.user.upsert({
    where: { telegramId: BigInt(telegramId) },
    update: { name },
    create: { telegramId: BigInt(telegramId), name },
  });
}

export function setStep(userId: number, step: string | null) {
  return prisma.user.update({ where: { id: userId }, data: { step } });
}