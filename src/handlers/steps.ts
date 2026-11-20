// src/handlers/steps.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { L } from "@/ui/labels";
import { getOwnedGroup, getOwnedTrip } from "@/services/access";
import { setState, type Draft } from "@/services/state";
import { parseAmount } from "@/utils/money";

export function registerStepRouter(bot: Bot<MyContext>) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return next(); // دستورها همیشه اولویت دارن
    const [step, rawId] = (ctx.user.step ?? "").split(":");
    const id = Number(rawId);

    switch (step) {
      case "trip_name": {
        const group = await getOwnedGroup(ctx.user.id, id);
        if (!group) {
          await setState(ctx.user.id, null);
          return ctx.reply("گروه پیدا نشد.");
        }
        if (text.length > 50) return ctx.reply("اسم خیلی طولانیه (حداکثر ۵۰ کاراکتر).");
        const trip = await prisma.trip.create({ data: { groupId: group.id, name: text } });
        await setState(ctx.user.id, null);
        return ctx.reply(`✅ ${L.trip} «${trip.name}» ساخته شد.`, {
          reply_markup: new InlineKeyboard().text("باز کردن", `t:${trip.id}`),
        });
      }

      case "exp_amount": {
        const amount = parseAmount(text);
        if (!amount) return ctx.reply("مبلغ معتبر نیست. فقط عدد به تومان بفرست (مثلاً ۱۲۰۰۰۰).");
        await setState(ctx.user.id, `exp_desc:${id}`, { tripId: id, amount });
        return ctx.reply("توضیح خرج چیه؟ (مثلاً «شام»)");
      }

      case "exp_desc": {
        const draft = ctx.user.draft as Draft | null;
        const trip = await getOwnedTrip(ctx.user.id, id);
        if (!draft || !trip) {
          await setState(ctx.user.id, null);
          return ctx.reply("مشکلی پیش اومد، از اول شروع کن.");
        }
        await setState(ctx.user.id, `exp_payer:${id}`, { ...draft, description: text.slice(0, 100) });
        const kb = new InlineKeyboard();
        for (const m of trip.group.members) kb.text(m.displayName, `ex:p:${m.id}`).row();
        return ctx.reply("چه کسی پرداخت کرد؟", { reply_markup: kb });
      }

      default:
        return next();
    }
  });
}