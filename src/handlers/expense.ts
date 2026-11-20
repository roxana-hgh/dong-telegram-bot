// src/handlers/expense.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { getOwnedTrip } from "@/services/access";
import { setState, type Draft } from "@/services/state";
import { createExpense } from "@/services/expense.service";
import { fmt } from "@/utils/money";

type M = { id: number; displayName: string };

const participantsKb = (members: M[], selected: number[]) => {
  const kb = new InlineKeyboard();
  for (const m of members) {
    kb.text(`${selected.includes(m.id) ? "✅" : "⬜"} ${m.displayName}`, `ex:t:${m.id}`).row();
  }
  return kb.text("✔️ تأیید", "ex:done").text("❌ لغو", "ex:cancel");
};

export function registerExpenseHandlers(bot: Bot<MyContext>) {
  // شروع
  bot.callbackQuery(/^t:(\d+):exp$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery("پیدا نشد");
    if (trip.status !== "OPEN") return ctx.answerCallbackQuery("این مورد تسویه شده");
    if (trip.group.members.length < 2) {
      return ctx.answerCallbackQuery("حداقل ۲ عضو لازمه");
    }
    await setState(ctx.user.id, `exp_amount:${trip.id}`, { tripId: trip.id });
    await ctx.editMessageText("مبلغ خرج چنده؟ (تومان)");
    await ctx.answerCallbackQuery();
  });

  // انتخاب پرداخت‌کننده
  bot.callbackQuery(/^ex:p:(\d+)$/, async (ctx) => {
    const draft = ctx.user.draft as Draft | null;
    if (!draft || !ctx.user.step?.startsWith("exp_payer")) {
      return ctx.answerCallbackQuery("این دکمه منقضی شده");
    }
    const trip = await getOwnedTrip(ctx.user.id, draft.tripId);
    const payer = trip?.group.members.find((m) => m.id === Number(ctx.match[1]));
    if (!trip || !payer) return ctx.answerCallbackQuery("پیدا نشد");

    const participants = trip.group.members.map((m) => m.id); // پیش‌فرض: همه
    await setState(ctx.user.id, `exp_split:${trip.id}`, { ...draft, paidBy: payer.id, participants });
    await ctx.editMessageText("خرج بین چه کسانی تقسیم بشه؟", {
      reply_markup: participantsKb(trip.group.members, participants),
    });
    await ctx.answerCallbackQuery();
  });

  // toggle شرکت‌کننده
  bot.callbackQuery(/^ex:t:(\d+)$/, async (ctx) => {
    const draft = ctx.user.draft as Draft | null;
    if (!draft?.participants || !ctx.user.step?.startsWith("exp_split")) {
      return ctx.answerCallbackQuery("این دکمه منقضی شده");
    }
    const trip = await getOwnedTrip(ctx.user.id, draft.tripId);
    if (!trip) return ctx.answerCallbackQuery("پیدا نشد");

    const id = Number(ctx.match[1]);
    if (!trip.group.members.some((m) => m.id === id)) return ctx.answerCallbackQuery();
    const participants = draft.participants.includes(id)
      ? draft.participants.filter((p) => p !== id)
      : [...draft.participants, id];

    await setState(ctx.user.id, ctx.user.step, { ...draft, participants });
    await ctx.editMessageReplyMarkup({ reply_markup: participantsKb(trip.group.members, participants) });
    await ctx.answerCallbackQuery();
  });

  // تأیید نهایی
  bot.callbackQuery("ex:done", async (ctx) => {
    const d = ctx.user.draft as Draft | null;
    if (!d?.amount || !d.description || !d.paidBy || !d.participants?.length) {
      return ctx.answerCallbackQuery("حداقل یک نفر رو انتخاب کن");
    }
    try {
      await createExpense(d.tripId, {
        amount: d.amount,
        description: d.description,
        paidByMemberId: d.paidBy,
        participantIds: d.participants,
      });
    } catch {
      return ctx.answerCallbackQuery("ثبت نشد، دوباره تلاش کن");
    }
    await setState(ctx.user.id, null);
    await ctx.editMessageText(
      `✅ ثبت شد\n${d.description}: ${fmt(d.amount)}`,
      { reply_markup: new InlineKeyboard().text("🔙 بازگشت", `t:${d.tripId}`) },
    );
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery("ex:cancel", async (ctx) => {
    const d = ctx.user.draft as Draft | null;
    await setState(ctx.user.id, null);
    await ctx.editMessageText("لغو شد.", {
      reply_markup: d ? new InlineKeyboard().text("🔙 بازگشت", `t:${d.tripId}`) : undefined,
    });
    await ctx.answerCallbackQuery();
  });
}