// src/ui/show.ts
import { GrammyError, type InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";

export const html = { parse_mode: "HTML" as const };

const notModified = (e: unknown) =>
  e instanceof GrammyError && e.description.includes("message is not modified");

/** Id of the message that carried the pressed button (if any) */
export const msgId = (ctx: MyContext) => ctx.callbackQuery?.message?.message_id;

/**
 * Single entry point for "render a screen":
 * - from a button press: edit the current message in place
 * - from a command/text: send a new message
 * Double taps on the same button ("message is not modified") are ignored.
 */
export async function show(ctx: MyContext, text: string, kb?: InlineKeyboard) {
  const opts = { ...html, reply_markup: kb };
  try {
    if (ctx.callbackQuery?.message) await ctx.editMessageText(text, opts);
    else await ctx.reply(text, opts);
  } catch (e) {
    if (notModified(e)) return;
    throw e;
  }
}

/**
 * Render a screen into an existing bot message (by id) while handling a *text* update,
 * so the user's typing updates the card in place instead of adding new messages.
 * Falls back to a new message if the old one can't be edited.
 */
export async function putScreen(ctx: MyContext, mid: number | undefined, text: string, kb?: InlineKeyboard) {
  const chatId = ctx.chat?.id;
  if (mid && chatId) {
    try {
      await ctx.api.editMessageText(chatId, mid, text, { ...html, reply_markup: kb });
      return;
    } catch (e) {
      if (notModified(e)) return;
    }
  }
  await ctx.reply(text, { ...html, reply_markup: kb });
}

/** Remove the user's input message to keep the chat clean (best effort) */
export async function tidy(ctx: MyContext) {
  try {
    await ctx.deleteMessage();
  } catch {
    /* ignore: message may be too old or not deletable */
  }
}
