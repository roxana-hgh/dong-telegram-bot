// src/handlers/expenseList.ts  (list, view, edit-start and delete of expenses)
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { fa as t } from "@/texts/fa";
import { withNav } from "@/keyboards";
import { getOwnedTrip, getOwnedExpense, type OwnedTrip } from "@/services/access";
import { setState, type Draft } from "@/services/state";
import { deleteExpense } from "@/services/expense.service";
import { cardText, cardKb } from "@/ui/expenseCard";
import { show, msgId } from "@/ui/show";

const PAGE = 30; // keeps the keyboard well under Telegram's limits

async function showExpenseList(ctx: MyContext, trip: OwnedTrip) {
  const [count, expenses] = await Promise.all([
    prisma.expense.count({ where: { tripId: trip.id } }),
    prisma.expense.findMany({ where: { tripId: trip.id }, orderBy: { id: "desc" }, take: PAGE }),
  ]);
  const kb = new InlineKeyboard();
  for (const e of expenses) {
    kb.text(`${e.description.slice(0, 30)} · ${e.amount.toLocaleString("fa-IR")}`, `e:${e.id}`).row();
  }
  const text = count ? t.expensesTitle(trip.name, count, expenses.length) : t.noExpensesList;
  await show(ctx, text, withNav(kb, `t:${trip.id}`));
}

export function registerExpenseListHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery(/^t:(\d+):list$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery({ text: t.notFound });
    await ctx.answerCallbackQuery();
    await showExpenseList(ctx, trip);
  });

  // Expense page
  bot.callbackQuery(/^e:(\d+)$/, async (ctx) => {
    const e = await getOwnedExpense(ctx.user.id, Number(ctx.match[1]));
    if (!e) return ctx.answerCallbackQuery({ text: t.notFound });
    await ctx.answerCallbackQuery();

    const names = new Map(e.trip.group.members.map((m) => [m.id, m.displayName]));
    const kb = new InlineKeyboard();
    if (e.trip.status === "OPEN") {
      kb.text(t.btn.edit, `e:${e.id}:edit`).text(t.btn.del, `e:${e.id}:del`);
    }
    await show(
      ctx,
      t.expensePage({
        description: e.description,
        amount: e.amount,
        payer: names.get(e.paidByMemberId) ?? "?",
        shares: e.shares.map((s) => ({ name: names.get(s.memberId) ?? "?", amount: s.amount })),
      }),
      withNav(kb, `t:${e.tripId}:list`)
    );
  });

  // Edit = open the same card as for a new expense, pre-filled
  bot.callbackQuery(/^e:(\d+):edit$/, async (ctx) => {
    const e = await getOwnedExpense(ctx.user.id, Number(ctx.match[1]));
    if (!e) return ctx.answerCallbackQuery({ text: t.notFound });
    if (e.trip.status !== "OPEN") return ctx.answerCallbackQuery({ text: t.tripSettled });
    await ctx.answerCallbackQuery();

    const d: Draft = {
      tripId: e.tripId,
      expenseId: e.id,
      amount: e.amount,
      description: e.description,
      paidBy: e.paidByMemberId,
      participants: e.shares.map((s) => s.memberId),
      mid: msgId(ctx),
    };
    await setState(ctx.user.id, `exp_card:${e.tripId}`, d);
    await show(ctx, cardText(d, e.trip), cardKb(d, e.trip));
  });

  // Delete: confirmation first, then e:<id>:del:yes
  bot.callbackQuery(/^e:(\d+):del(?::(yes))?$/, async (ctx) => {
    const e = await getOwnedExpense(ctx.user.id, Number(ctx.match[1]));
    if (!e) return ctx.answerCallbackQuery({ text: t.notFound });
    if (e.trip.status !== "OPEN") return ctx.answerCallbackQuery({ text: t.tripSettled });

    if (!ctx.match[2]) {
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard().text(t.btn.yesDelete, `e:${e.id}:del:yes`);
      return show(ctx, t.confirmDeleteExpense(e.description, e.amount), withNav(kb, `e:${e.id}`));
    }
    try {
      await deleteExpense(e.id);
    } catch {
      return ctx.answerCallbackQuery({ text: t.problem });
    }
    await ctx.answerCallbackQuery();
    const trip = await getOwnedTrip(ctx.user.id, e.tripId);
    if (trip) await showExpenseList(ctx, trip);
  });
}
