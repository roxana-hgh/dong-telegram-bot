// src/handlers/expense.ts  (new-expense wizard + the expense card used for create AND edit)
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { fa as t } from "@/texts/fa";
import { withNav } from "@/keyboards";
import { getOwnedTrip, getOwnedExpense, type OwnedTrip } from "@/services/access";
import { setState, claimState, type Draft } from "@/services/state";
import { createExpense, updateExpense, defaultPayer } from "@/services/expense.service";
import { cardText, cardKb, promptKb, afterSaveKb } from "@/ui/expenseCard";
import { show, msgId } from "@/ui/show";

/** Common guard for every `ex:*` button: a live draft, an owned and still-open trip */
async function flow(ctx: MyContext): Promise<{ d: Draft; trip: OwnedTrip } | null> {
  const d = ctx.user.draft as Draft | null;
  if (!d || !ctx.user.step?.startsWith("exp_")) {
    await ctx.answerCallbackQuery({ text: t.expired });
    return null;
  }
  const trip = await getOwnedTrip(ctx.user.id, d.tripId);
  if (!trip) {
    await ctx.answerCallbackQuery({ text: t.notFound });
    return null;
  }
  if (trip.status !== "OPEN") {
    await ctx.answerCallbackQuery({ text: t.tripSettled });
    return null;
  }
  return { d, trip };
}

export function registerExpenseHandlers(bot: Bot<MyContext>) {
  // Wizard start (amount → description → card with smart defaults)
  bot.callbackQuery(/^t:(\d+):exp$/, async (ctx) => {
    const trip = await getOwnedTrip(ctx.user.id, Number(ctx.match[1]));
    if (!trip) return ctx.answerCallbackQuery({ text: t.notFound });
    if (trip.status !== "OPEN") return ctx.answerCallbackQuery({ text: t.tripSettled });
    if (trip.group.members.length < 2) return ctx.answerCallbackQuery({ text: t.needTwoMembers });
    await ctx.answerCallbackQuery();

    const ids = trip.group.members.map((m) => m.id);
    const d: Draft = {
      tripId: trip.id,
      paidBy: await defaultPayer(trip.id, ctx.user.id, ids),
      participants: ids, // default: everyone
      chain: true,
      mid: msgId(ctx),
    };
    await setState(ctx.user.id, `exp_in_amount:${trip.id}`, d);
    await show(ctx, t.askAmount, promptKb(d, trip));
  });

  // Back to the card (from a prompt or a picker)
  bot.callbackQuery("ex:card", async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    if (!f.d.participants?.length) return ctx.answerCallbackQuery({ text: t.pickAtLeastOne });
    await ctx.answerCallbackQuery();
    const d: Draft = { ...f.d, chain: false, mid: msgId(ctx) };
    await setState(ctx.user.id, `exp_card:${f.trip.id}`, d);
    await show(ctx, cardText(d, f.trip), cardKb(d, f.trip));
  });

  // Edit a text field: the next message updates the card in place
  bot.callbackQuery(/^ex:f:(amount|desc)$/, async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    await ctx.answerCallbackQuery();
    const field = ctx.match[1];
    const d: Draft = { ...f.d, chain: false, mid: msgId(ctx) };
    await setState(ctx.user.id, `exp_in_${field}:${f.trip.id}`, d);
    await show(ctx, field === "amount" ? t.askNewAmount : t.askNewDesc, promptKb(d, f.trip));
  });

  // Payer picker
  bot.callbackQuery("ex:f:payer", async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    for (const m of f.trip.group.members) {
      kb.text(`${m.id === f.d.paidBy ? "✅ " : ""}${m.displayName}`, `ex:p:${m.id}`).row();
    }
    await show(ctx, t.askPayer, withNav(kb, "ex:card"));
  });

  bot.callbackQuery(/^ex:p:(\d+)$/, async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    const id = Number(ctx.match[1]);
    if (!f.trip.group.members.some((m) => m.id === id)) {
      return ctx.answerCallbackQuery({ text: t.notFound });
    }
    await ctx.answerCallbackQuery();
    const d: Draft = { ...f.d, paidBy: id, mid: msgId(ctx) };
    await setState(ctx.user.id, `exp_card:${f.trip.id}`, d);
    await show(ctx, cardText(d, f.trip), cardKb(d, f.trip));
  });

  // Participants picker (toggle buttons; "confirm" returns to the card)
  const splitKb = (trip: OwnedTrip, selected: number[]) => {
    const kb = new InlineKeyboard();
    for (const m of trip.group.members) {
      kb.text(`${selected.includes(m.id) ? "✅" : "⬜"} ${m.displayName}`, `ex:t:${m.id}`).row();
    }
    kb.text(t.btn.confirm, "ex:card");
    return withNav(kb, "ex:card");
  };

  bot.callbackQuery("ex:f:split", async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    await ctx.answerCallbackQuery();
    await show(ctx, t.askSplit, splitKb(f.trip, f.d.participants ?? []));
  });

  bot.callbackQuery(/^ex:t:(\d+)$/, async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    const id = Number(ctx.match[1]);
    if (!f.trip.group.members.some((m) => m.id === id)) return ctx.answerCallbackQuery();
    const cur = f.d.participants ?? [];
    const participants = cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id];
    await ctx.answerCallbackQuery();
    await setState(ctx.user.id, ctx.user.step, { ...f.d, participants });
    await ctx.editMessageReplyMarkup({ reply_markup: splitKb(f.trip, participants) });
  });

  // Save (create or update)
  bot.callbackQuery("ex:save", async (ctx) => {
    const f = await flow(ctx);
    if (!f) return;
    const { d, trip } = f;
    if (!ctx.user.step?.startsWith("exp_card")) return ctx.answerCallbackQuery({ text: t.expired });
    if (!d.amount || !d.description) return ctx.answerCallbackQuery({ text: t.cardIncomplete });
    if (!d.paidBy || !d.participants?.length) {
      return ctx.answerCallbackQuery({ text: t.pickAtLeastOne });
    }

    // Idempotent: only one of several concurrent taps gets past this point
    if (!(await claimState(ctx.user.id, "exp_card"))) {
      return ctx.answerCallbackQuery({ text: t.expired });
    }
    const data = {
      amount: d.amount,
      description: d.description,
      paidByMemberId: d.paidBy,
      participantIds: d.participants,
    };
    try {
      if (d.expenseId) {
        const ex = await getOwnedExpense(ctx.user.id, d.expenseId);
        if (!ex || ex.tripId !== trip.id) throw new Error("NOT_FOUND");
        await updateExpense(d.expenseId, data);
      } else {
        await createExpense(trip.id, data);
      }
    } catch {
      await setState(ctx.user.id, `exp_card:${trip.id}`, d); // let the user retry
      return ctx.answerCallbackQuery({ text: t.saveFailed });
    }
    await ctx.answerCallbackQuery();
    // Keep quick-add armed so the next plain message becomes another expense
    await setState(ctx.user.id, `quick:${trip.id}`, { tripId: trip.id, mid: msgId(ctx) });
    await show(
      ctx,
      d.expenseId ? t.expenseUpdated(d.description, d.amount) : t.expenseSaved(d.description, d.amount),
      afterSaveKb(trip.id)
    );
  });
}
