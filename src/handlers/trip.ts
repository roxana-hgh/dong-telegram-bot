// src/handlers/trip.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { L } from "@/ui/labels";
import { getOwnedGroup, getOwnedTrip } from "@/services/access";
import { setState } from "@/services/state";

export function registerTripHandlers(bot: Bot<MyContext>) {
  // لیست رویدادهای یک گروه
  bot.callbackQuery(/^g:(\d+):trips$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery("گروه پیدا نشد");

    const trips = await prisma.trip.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: "desc" },
    });
    const kb = new InlineKeyboard();
    for (const t of trips) {
      kb.text(`${t.status === "SETTLED" ? "✅" : "🟢"} ${t.name}`, `t:${t.id}`).row();
    }
    kb.text(`➕ ${L.newTrip}`, `g:${group.id}:newtrip`).row();
    kb.text("🔙 بازگشت", `g:${group.id}`);

    await ctx.editMessageText(`${L.trips} «${group.name}»`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });

  // شروع ساخت رویداد جدید
  bot.callbackQuery(/^g:(\d+):newtrip$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery("گروه پیدا نشد");
    await setState(ctx.user.id, `trip_name:${group.id}`);
    await ctx.editMessageText(`اسم ${L.trip} رو بنویس (مثلاً «شمال تابستون»):`);
    await ctx.answerCallbackQuery();
  });

  // منوی یک رویداد
  bot.callbackQuery(/^t:(\d+)$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery("پیدا نشد");
    const kb = new InlineKeyboard()
      .text("➕ خرج جدید", `t:${trip.id}:exp`).row()
      .text("📊 گزارش", `t:${trip.id}:report`).row()
      .text("🔙 بازگشت", `g:${trip.group.id}:trips`);
    await ctx.editMessageText(`${L.trip}: «${trip.name}»`, { reply_markup: kb });
    await ctx.answerCallbackQuery();
  });
}