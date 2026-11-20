// src/bot.ts
import { Bot } from "grammy";
import type { MyContext } from "@/types";
import { upsertUser } from "@/db/users";
import { setState } from "@/services/state";

import { registerGroupHandlers } from "@/handlers/groups"; // groups + members
import { registerTripHandlers } from "@/handlers/trip";
import { registerExpenseHandlers } from "@/handlers/expense";
import { registerReportHandlers } from "@/handlers/report";
import { registerStepRouter } from "@/handlers/steps";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not set");

export const bot = new Bot<MyContext>(token);

// 1) Load or create the user once per update and attach it to ctx
bot.use(async (ctx, next) => {
  if (!ctx.from) return; // skip updates without a sender
  ctx.user = await upsertUser(ctx.from.id, ctx.from.first_name);
  await next();
});

// 2) /start and /cancel always clear half-finished conversation state
bot.command("start", async (ctx, next) => {
  if (ctx.user.step) await setState(ctx.user.id, null);
  await next(); // continue to the existing /start handler below
});

bot.command("cancel", async (ctx) => {
  await setState(ctx.user.id, null);
  await ctx.reply("لغو شد. برای برگشت به منوی اصلی /start رو بزن.");
});

// 3) EXISTING handlers: put your current /start and "menu:home" handlers here
//    (they were in your old bot.ts or another file; type them with Bot<MyContext>)

// 4) Feature handlers
registerGroupHandlers(bot);
registerTripHandlers(bot);
registerExpenseHandlers(bot);
registerReportHandlers(bot);

// 5) Fallback for stale buttons that no handler matched
//    (must come after all callbackQuery handlers)
bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "این دکمه منقضی شده، /start رو بزن." });
});

// 6) Text step router; must be registered last
registerStepRouter(bot);

// 7) A handler error must not crash the process
bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
});