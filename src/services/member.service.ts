// src/services/member.service.ts
import { prisma } from "@/db/client";

export type MemberResult = "OK" | "DUPLICATE" | "HAS_EXPENSES" | "IS_OWNER" | "NOT_FOUND";

const errCode = (e: unknown) => (e as { code?: string } | null)?.code;

export async function renameMember(memberId: number, displayName: string): Promise<MemberResult> {
  try {
    await prisma.member.update({ where: { id: memberId }, data: { displayName } });
    return "OK";
  } catch (e) {
    if (errCode(e) === "P2002") return "DUPLICATE"; // @@unique([groupId, displayName])
    throw e;
  }
}

/** Members that paid or share any expense cannot be deleted (FK is NoAction on purpose). */
export async function deleteMember(memberId: number): Promise<MemberResult> {
  const m = await prisma.member.findUnique({ where: { id: memberId }, include: { group: true } });
  if (!m) return "NOT_FOUND";
  if (m.userId !== null && m.userId === m.group.ownerId) return "IS_OWNER";

  const [paid, shared] = await Promise.all([
    prisma.expense.count({ where: { paidByMemberId: memberId } }),
    prisma.expenseShare.count({ where: { memberId } }),
  ]);
  if (paid + shared > 0) return "HAS_EXPENSES";

  try {
    await prisma.member.delete({ where: { id: memberId } });
    return "OK";
  } catch (e) {
    if (errCode(e) === "P2003") return "HAS_EXPENSES"; // safety net: FK violation
    throw e;
  }
}
