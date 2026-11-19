import { Bot } from "grammy";

export const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", (ctx) =>
  ctx.reply("سلام! من ربات تقسیم هزینه‌ام 👋")
);

bot.on("message", (ctx) => ctx.reply("پیامت رسید ✅"));