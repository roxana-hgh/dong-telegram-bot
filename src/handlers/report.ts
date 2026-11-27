// src/handlers/report.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { fa as t } from "@/texts/fa";
import { withNav } from "@/keyboards";
import { getOwnedTrip } from "@/services/access";
import { computeBalances } from "@/services/balances";
import { settleMinimal, settleDirect } from "@/services/settle";
import { show } from "@/ui/show";

export function registerReportHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery(/^t:(\d+):report(?::(min|direct))?$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery({ text: t.notFound });

    const expenses = await prisma.expense.findMany({
      where: { tripId: trip.id },
      include: { shares: true },
    });
    if (expenses.length === 0) return ctx.answerCallbackQuery({ text: t.noExpenses });
    await ctx.answerCallbackQuery();

    const mode = ctx.match[2] ?? "min";
    const names = new Map(trip.group.members.map((m) => [m.id, m.displayName]));
    const net = computeBalances(expenses);
    const transfers = mode === "direct" ? settleDirect(expenses) : settleMinimal(net);

    const text = t.report({
      tripName: trip.name,
      total: expenses.reduce((s, e) => s + e.amount, 0),
      balances: trip.group.members.map((m) => ({ name: m.displayName, value: net.get(m.id) ?? 0 })),
      modeLabel: mode === "direct" ? t.modeDirect : t.modeMin,
      transfers: transfers.map((x) => ({
        from: names.get(x.from) ?? "?",
        to: names.get(x.to) ?? "?",
        amount: x.amount,
      })),
    });

    // Only offer the *other* mode, otherwise Telegram answers "message is not modified"
    const other = mode === "direct" ? "min" : "direct";
    const kb = new InlineKeyboard().text(
      other === "direct" ? t.btn.modeDirect : t.btn.modeMin,
      `t:${trip.id}:report:${other}`
    );
    await show(ctx, text, withNav(kb, `t:${trip.id}`));
  });
}
