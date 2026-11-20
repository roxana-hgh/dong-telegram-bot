// src/handlers/report.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { getOwnedTrip } from "@/services/access";
import { computeBalances } from "@/services/balances";
import { settleMinimal, settleDirect } from "@/services/settle";
import { fmt } from "@/utils/money";

export function registerReportHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery(/^t:(\d+):report(?::(min|direct))?$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery("پیدا نشد");

    const expenses = await prisma.expense.findMany({
      where: { tripId: trip.id },
      include: { shares: true },
    });
    if (expenses.length === 0) return ctx.answerCallbackQuery("هنوز خرجی ثبت نشده");

    const mode = ctx.match[2] ?? "min";
    const names = new Map(trip.group.members.map((m) => [m.id, m.displayName]));
    const net = computeBalances(expenses);
    const transfers = mode === "direct" ? settleDirect(expenses) : settleMinimal(net);
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    const lines = trip.group.members.map((m) => {
      const v = net.get(m.id) ?? 0;
      const icon = v > 0 ? "🟢" : v < 0 ? "🔴" : "⚪";
      return `${icon} ${m.displayName}: ${v > 0 ? "+" : ""}${fmt(v)}`;
    });
    const pays = transfers.length
      ? transfers.map((t) => `${names.get(t.from)} ← ${names.get(t.to)}: ${fmt(t.amount)}`)
      : ["همه حساب‌ها صافه 🎉"];

    const text = [
      `📊 گزارش «${trip.name}»`,
      `جمع کل: ${fmt(total)}`,
      "",
      "وضعیت هر نفر:",
      ...lines,
      "",
      `پیشنهاد تسویه (${mode === "direct" ? "پرداخت مستقیم" : "کمترین تعداد تراکنش"}):`,
      ...pays,
    ].join("\n");

    // فقط دکمه‌ی حالت «دیگه» رو نشون می‌دیم تا خطای message-is-not-modified نگیریم
    const other = mode === "direct" ? "min" : "direct";
    const kb = new InlineKeyboard()
      .text(other === "direct" ? "🔀 پرداخت مستقیم" : "🔀 کمترین تراکنش", `t:${trip.id}:report:${other}`).row()
      .text("🔙 بازگشت", `t:${trip.id}`);

    await ctx.editMessageText(text, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
}