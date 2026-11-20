import { Bot } from "grammy";
import { fa as t } from "@/texts/fa";
import { mainMenu, backMenu } from "@/keyboards";
import { upsertUser, setStep } from "@/db/users";
import { registerGroupHandlers } from "@/handlers/groups";

export const bot = new Bot(process.env.BOT_TOKEN!);

const html = { parse_mode: "HTML" as const };

bot.command("start", async (ctx) => {
  const user = await upsertUser(ctx.from!.id, ctx.from!.first_name);
  await setStep(user.id, null);
  await ctx.reply(t.welcome, { ...html, reply_markup: mainMenu });
});

// برگشت به خانه همیشه state گفتگو رو پاک می‌کنه
bot.callbackQuery("menu:home", async (ctx) => {
  await ctx.answerCallbackQuery();
  const user = await upsertUser(ctx.from.id, ctx.from.first_name);
  await setStep(user.id, null);
  await ctx.editMessageText(t.welcome, { ...html, reply_markup: mainMenu });
});

bot.callbackQuery("menu:how", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t.how, { ...html, reply_markup: backMenu });
});

bot.callbackQuery("menu:about", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t.about, { ...html, reply_markup: backMenu });
});

registerGroupHandlers(bot);

// پیام‌های غیرمتنی (عکس، استیکر، ...)
bot.on("message", (ctx) => ctx.reply(t.fallback));