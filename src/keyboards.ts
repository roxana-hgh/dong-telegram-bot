import { InlineKeyboard } from "grammy";
import { fa as t } from "@/texts/fa";
import { L } from "@/ui/labels";

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

export const groupMenu = (groupId: number) =>
  new InlineKeyboard()
    .text(`📅 ${L.trips}`, `g:${groupId}:trips`)
    .row()
    .text(t.btn.back, "menu:my_groups");