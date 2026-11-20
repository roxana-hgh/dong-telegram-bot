import { InlineKeyboard } from "grammy";
import { fa as t } from "@/texts/fa";

export const mainMenu = new InlineKeyboard()
  .text(t.btn.newGroup, "menu:new_group")
  .text(t.btn.myGroups, "menu:my_groups")
  .row()
  .text(t.btn.how, "menu:how")
  .text(t.btn.about, "menu:about");

export const backMenu = new InlineKeyboard().text(t.btn.back, "menu:home");
export const cancelKb = new InlineKeyboard().text(t.btn.cancel, "menu:home");
export const doneKb = (groupId: number) =>
  new InlineKeyboard().text(t.btn.done, `g:done:${groupId}`);

export const groupMenu = new InlineKeyboard()
  .text(t.btn.newExpense, "soon:expense")
  .text(t.btn.report, "soon:report")
  .row()
  .text(t.btn.back, "menu:my_groups");