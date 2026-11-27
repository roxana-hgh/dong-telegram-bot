// src/handlers/trip.ts  (trip list, trip page, settle / reopen)
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { fa as t } from "@/texts/fa";
import { withNav } from "@/keyboards";
import { getOwnedGroup, getOwnedTrip, type OwnedTrip } from "@/services/access";
import { setState } from "@/services/state";
import { setTripStatus } from "@/services/expense.service";
import { show, msgId } from "@/ui/show";

/** Trip page with a summary. On an open trip it also arms the quick-add text step. */
export async function showTrip(ctx: MyContext, trip: OwnedTrip) {
  const agg = await prisma.expense.aggregate({
    where: { tripId: trip.id },
    _sum: { amount: true },
    _count: true,
  });
  const open = trip.status === "OPEN";
  const quick = open && trip.group.members.length >= 2;

  const kb = new InlineKeyboard();
  if (open) kb.text(t.btn.newExpense, `t:${trip.id}:exp`).row();
  kb.text(t.btn.report, `t:${trip.id}:report`).text(t.btn.expenses, `t:${trip.id}:list`).row();
  kb.text(open ? t.btn.settle : t.btn.reopen, open ? `t:${trip.id}:settle` : `t:${trip.id}:reopen`);

  await show(
    ctx,
    t.tripSummary({
      name: trip.name,
      settled: !open,
      count: agg._count,
      total: agg._sum.amount ?? 0,
      quick,
    }),
    withNav(kb, `g:${trip.group.id}:trips`)
  );
  // Next plain text message from the user is treated as a quick expense
  if (quick) await setState(ctx.user.id, `quick:${trip.id}`, { tripId: trip.id, mid: msgId(ctx) });
}

export function registerTripHandlers(bot: Bot<MyContext>) {
  // Trips of a group
  bot.callbackQuery(/^g:(\d+):trips$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();

    const trips = await prisma.trip.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: "desc" },
    });
    const kb = new InlineKeyboard();
    for (const trip of trips) {
      kb.text(`${trip.status === "SETTLED" ? "✅" : "🟢"} ${trip.name}`, `t:${trip.id}`).row();
    }
    kb.text(t.btn.newTrip, `g:${group.id}:newtrip`);
    await show(ctx, t.tripsTitle(group.name), withNav(kb, `g:${group.id}`));
  });

  // Start creating a trip
  bot.callbackQuery(/^g:(\d+):newtrip$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();
    await setState(ctx.user.id, `trip_name:${group.id}`);
    await show(ctx, t.askTripName, withNav(new InlineKeyboard(), `g:${group.id}:trips`));
  });

  // Trip page
  bot.callbackQuery(/^t:(\d+)$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery({ text: t.notFound });
    await ctx.answerCallbackQuery();
    await showTrip(ctx, trip);
  });

  // Settle: confirmation first, then t:<id>:settle:yes
  bot.callbackQuery(/^t:(\d+):settle(?::(yes))?$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery({ text: t.notFound });

    if (!ctx.match[2]) {
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard().text(t.btn.yesSettle, `t:${trip.id}:settle:yes`);
      return show(ctx, t.confirmSettle(trip.name), withNav(kb, `t:${trip.id}`));
    }
    await setTripStatus(trip.id, "SETTLED");
    await ctx.answerCallbackQuery({ text: t.settledToast });
    const fresh = await getOwnedTrip(ctx.user.id, trip.id);
    if (fresh) await showTrip(ctx, fresh);
  });

  bot.callbackQuery(/^t:(\d+):reopen$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery({ text: t.notFound });
    await setTripStatus(trip.id, "OPEN");
    await ctx.answerCallbackQuery({ text: t.reopenedToast });
    const fresh = await getOwnedTrip(ctx.user.id, trip.id);
    if (fresh) await showTrip(ctx, fresh);
  });
}
