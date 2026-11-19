import { Bot } from "grammy";
import { fa as t } from "@/texts/fa";
import { mainMenu, backMenu } from "@/keyboards";

export const bot = new Bot(process.env.BOT_TOKEN!);

const html = { parse_mode: "HTML" as const };

bot.command("start", (ctx) =>
  ctx.reply(t.welcome, { ...html, reply_markup: mainMenu })
);

// صفحه‌هایی که متنشون رو عوض می‌کنیم
const pages = {
  "menu:home": { text: t.welcome, kb: mainMenu },
  "menu:how": { text: t.how, kb: backMenu },
  "menu:about": { text: t.about, kb: backMenu },
} as const;

for (const [data, page] of Object.entries(pages)) {
  bot.callbackQuery(data, async (ctx) => {
    await ctx.answerCallbackQuery(); // برای برداشتن لودینگ روی دکمه
    await ctx.editMessageText(page.text, { ...html, reply_markup: page.kb });
  });
}

// دکمه‌هایی که هنوز ساخته نشدن
bot.callbackQuery(["menu:new_group", "menu:my_groups"], (ctx) =>
  ctx.answerCallbackQuery({ text: t.soon, show_alert: true })
);

bot.on("message", (ctx) => ctx.reply(t.fallback));