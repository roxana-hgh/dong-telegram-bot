// src/keyboards.ts
import { InlineKeyboard } from "grammy";
import { fa as t } from "@/texts/fa";
import { L } from "@/ui/labels";

export const HOME = "menu:home";

/**
 * Appends the standard navigation row: [Back] [Home].
 * Pass the callback_data of the parent screen as `back`.
 * If the parent is the home screen, only one Home button is shown.
 */
export function withNav(kb: InlineKeyboard, back?: string): InlineKeyboard {
  const last = kb.inline_keyboard[kb.inline_keyboard.length - 1];
  if (last && last.length > 0) kb.row(); // start a fresh row
  if (back && back !== HOME) kb.text(t.btn.back, back);
  return kb.text(t.btn.home, HOME);
}

export const mainMenu = new InlineKeyboard()
  .text(t.btn.newGroup, "menu:new_group")
  .text(t.btn.myGroups, "menu:my_groups")
  .row()
  .text(t.btn.how, "menu:how")
  .text(t.btn.about, "menu:about");

export const cancelKb = new InlineKeyboard().text(t.btn.cancel, HOME);

export const doneKb = (groupId: number) =>
  new InlineKeyboard().text(t.btn.done, `g:done:${groupId}`);

export const groupMenu = (groupId: number) =>
  withNav(
    new InlineKeyboard()
      .text(`📅 ${L.trips}`, `g:${groupId}:trips`)
      .row()
      .text(t.btn.members, `g:${groupId}:members`)
      .text(t.btn.editGroup, `g:${groupId}:edit`),
    "menu:my_groups"
  );

export const memberMenu = (memberId: number, groupId: number) =>
  withNav(
    new InlineKeyboard()
      .text(t.btn.rename, `m:${memberId}:ren`)
      .text(t.btn.del, `m:${memberId}:del`),
    `g:${groupId}:members`
  );
