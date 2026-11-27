// src/bot.ts
import { Bot } from "grammy";
import type { MyContext } from "@/types";
import { upsertUser } from "@/db/users";
import { setState } from "@/services/state";
import { fa as t } from "@/texts/fa";

import { registerStartHandlers } from "@/handlers/start";
import { registerGroupHandlers } from "@/handlers/groups";
import { registerMemberHandlers } from "@/handlers/members";
import { registerTripHandlers } from "@/handlers/trip";
import { registerExpenseHandlers } from "@/handlers/expense";
import { registerExpenseListHandlers } from "@/handlers/expenseList";
import { registerReportHandlers } from "@/handlers/report";
import { registerStepRouter } from "@/handlers/steps";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not set");

export const bot = new Bot<MyContext>(token);

// Buttons that belong to a running flow and need the saved step/draft
const FLOW_PREFIXES = ["ex:"];

// 1) Load or create the user once per update and attach it to ctx
bot.use(async (ctx, next) => {
  if (!ctx.from) return; // skip updates without a sender
  ctx.user = await upsertUser(ctx.from.id, ctx.from.first_name);
  await next();
});

// 2) Any navigation button cancels a half-finished text flow.
//    Without this, text sent after pressing "Back" would still be
//    treated as the answer to the old question.
bot.use(async (ctx, next) => {
  const data = ctx.callbackQuery?.data;
  if (data && ctx.user.step && !FLOW_PREFIXES.some((p) => data.startsWith(p))) {
    await setState(ctx.user.id, null);
    ctx.user.step = null;
    ctx.user.draft = null;
  }
  await next();
});

// 3) Feature handlers
registerStartHandlers(bot);
registerGroupHandlers(bot);
registerMemberHandlers(bot);
registerTripHandlers(bot);
registerExpenseHandlers(bot);
registerExpenseListHandlers(bot);
registerReportHandlers(bot);

// 4) Fallback for stale buttons that no handler matched
//    (must come after all callbackQuery handlers)
bot.on("callback_query:data", async (ctx) => {
  await ctx.answerCallbackQuery({ text: t.expired });
});

// 5) Text step router; must be registered last
registerStepRouter(bot);

// 6) A handler error must not crash the process
bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
});
