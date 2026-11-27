// src/handlers/start.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { fa as t } from "@/texts/fa";
import { mainMenu, withNav, HOME } from "@/keyboards";
import { setState } from "@/services/state";
import { show } from "@/ui/show";

export function registerStartHandlers(bot: Bot<MyContext>) {
  // /start and /cancel always reset any half-finished flow
  bot.command("start", async (ctx) => {
    await setState(ctx.user.id, null);
    await show(ctx, t.welcome, mainMenu);
  });

  bot.command("cancel", async (ctx) => {
    await setState(ctx.user.id, null);
    await show(ctx, t.cancelled, mainMenu);
  });

  bot.callbackQuery(HOME, async (ctx) => {
    await ctx.answerCallbackQuery();
    await show(ctx, t.welcome, mainMenu); // step is already cleared by the nav middleware
  });

  bot.callbackQuery("menu:how", async (ctx) => {
    await ctx.answerCallbackQuery();
    await show(ctx, t.how, withNav(new InlineKeyboard()));
  });

  bot.callbackQuery("menu:about", async (ctx) => {
    await ctx.answerCallbackQuery();
    await show(ctx, t.about, withNav(new InlineKeyboard()));
  });
}
