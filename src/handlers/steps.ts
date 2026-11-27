// src/handlers/steps.ts  (text router: what a plain message means depends on User.step)
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { fa as t } from "@/texts/fa";
import { groupMenu, memberMenu, withNav } from "@/keyboards";
import { getOwnedGroup, getOwnedMember, getOwnedTrip, type OwnedTrip } from "@/services/access";
import { setState, type Draft } from "@/services/state";
import { renameMember } from "@/services/member.service";
import { defaultPayer } from "@/services/expense.service";
import { parseAmount } from "@/utils/money";
import { parseQuick } from "@/utils/quick";
import { cardText, cardKb, promptKb } from "@/ui/expenseCard";
import { html, putScreen, tidy } from "@/ui/show";

/** Loads the draft + trip for an expense text step, or resets the state */
async function loadFlow(ctx: MyContext, tripId: number): Promise<{ d: Draft; trip: OwnedTrip } | null> {
  const d = ctx.user.draft as Draft | null;
  const trip = await getOwnedTrip(ctx.user.id, tripId);
  if (!d || !trip || d.tripId !== tripId || trip.status !== "OPEN") {
    await setState(ctx.user.id, null);
    await ctx.reply(t.problem);
    return null;
  }
  return { d, trip };
}

/** Render the card into the bot's existing message, and clean up the user's input */
async function goToCard(ctx: MyContext, d: Draft, trip: OwnedTrip) {
  const next: Draft = { ...d, chain: false };
  await setState(ctx.user.id, `exp_card:${trip.id}`, next);
  await putScreen(ctx, d.mid, cardText(next, trip), cardKb(next, trip));
  await tidy(ctx);
}

/** Wizard: the card still needs a description */
async function goToDescription(ctx: MyContext, d: Draft, trip: OwnedTrip) {
  const next: Draft = { ...d, chain: true };
  await setState(ctx.user.id, `exp_in_desc:${trip.id}`, next);
  await putScreen(ctx, d.mid, t.askDesc, promptKb(next, trip));
  await tidy(ctx);
}

export function registerStepRouter(bot: Bot<MyContext>) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return next(); // commands always win
    const [step, rawId] = (ctx.user.step ?? "").split(":");
    const id = Number(rawId);

    switch (step) {
      case "trip_name": {
        const group = await getOwnedGroup(ctx.user.id, id);
        if (!group) {
          await setState(ctx.user.id, null);
          return ctx.reply(t.groupNotFound);
        }
        if (text.length > 50) return ctx.reply(t.tripNameTooLong);
        const trip = await prisma.trip.create({ data: { groupId: group.id, name: text } });
        await setState(ctx.user.id, null);
        return ctx.reply(t.tripCreated(trip.name), {
          ...html,
          reply_markup: withNav(new InlineKeyboard().text(t.btn.open, `t:${trip.id}`), `g:${group.id}:trips`),
        });
      }

      case "group_rename": {
        const group = await getOwnedGroup(ctx.user.id, id);
        if (!group) {
          await setState(ctx.user.id, null);
          return ctx.reply(t.groupNotFound);
        }
        if (text.length > 50) return ctx.reply(t.nameTooLong);
        const updated = await prisma.group.update({
          where: { id: group.id },
          data: { name: text },
          include: { members: { orderBy: { id: "asc" } } },
        });
        await setState(ctx.user.id, null);
        return ctx.reply(t.groupPage(updated.name, updated.members.map((m) => m.displayName)), {
          ...html,
          reply_markup: groupMenu(updated.id),
        });
      }

      case "member_rename": {
        const m = await getOwnedMember(ctx.user.id, id);
        if (!m) {
          await setState(ctx.user.id, null);
          return ctx.reply(t.notFound);
        }
        const name = text.slice(0, 30);
        const result = await renameMember(m.id, name);
        if (result === "DUPLICATE") return ctx.reply(t.dupName); // keep the step: try again
        await setState(ctx.user.id, null);
        return ctx.reply(t.memberPage(name), { ...html, reply_markup: memberMenu(m.id, m.groupId) });
      }

      // ---- expense: wizard and field edits ----
      case "exp_in_amount": {
        const amount = parseAmount(text);
        if (!amount) return ctx.reply(t.badAmount);
        const f = await loadFlow(ctx, id);
        if (!f) return;
        const d = { ...f.d, amount };
        return d.chain && !d.description ? goToDescription(ctx, d, f.trip) : goToCard(ctx, d, f.trip);
      }

      case "exp_in_desc": {
        const f = await loadFlow(ctx, id);
        if (!f) return;
        return goToCard(ctx, { ...f.d, description: text.slice(0, 100) }, f.trip);
      }

      // ---- quick add: "۱۲۰۰۰۰ شام" ----
      case "quick": {
        const trip = await getOwnedTrip(ctx.user.id, id);
        if (!trip || trip.status !== "OPEN") {
          await setState(ctx.user.id, null);
          return ctx.reply(t.problem);
        }
        const parsed = parseQuick(text);
        if (!parsed) return ctx.reply(t.quickHint);

        const ids = trip.group.members.map((m) => m.id);
        const d: Draft = {
          tripId: trip.id,
          amount: parsed.amount,
          description: parsed.description || undefined,
          paidBy: await defaultPayer(trip.id, ctx.user.id, ids),
          participants: ids,
          mid: (ctx.user.draft as Draft | null)?.mid,
        };
        return d.description ? goToCard(ctx, d, trip) : goToDescription(ctx, d, trip);
      }

      default:
        return ctx.reply(t.fallback);
    }
  });
}
