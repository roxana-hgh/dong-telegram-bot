// src/handlers/members.ts  (list / add / rename / delete members)
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { fa as t } from "@/texts/fa";
import { doneKb, memberMenu, withNav } from "@/keyboards";
import { getOwnedGroup, getOwnedMember } from "@/services/access";
import { deleteMember } from "@/services/member.service";
import { setState } from "@/services/state";
import { show } from "@/ui/show";

async function showMembers(ctx: MyContext, groupId: number) {
  const group = await getOwnedGroup(ctx.user.id, groupId);
  if (!group) return;
  const kb = new InlineKeyboard();
  for (const m of group.members) kb.text(`👤 ${m.displayName}`, `m:${m.id}`).row();
  kb.text(t.btn.addMember, `g:${group.id}:addm`);
  await show(ctx, t.membersTitle(group.name, group.members.length), withNav(kb, `g:${group.id}`));
}

export function registerMemberHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery(/^g:(\d+):members$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();
    await showMembers(ctx, group.id);
  });

  // Add members later: reuses the "add_members" text step from group creation
  bot.callbackQuery(/^g:(\d+):addm$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();
    await setState(ctx.user.id, `add_members:${group.id}`);
    await show(ctx, t.askMoreMembers, withNav(doneKb(group.id), `g:${group.id}:members`));
  });

  bot.callbackQuery(/^m:(\d+)$/, async (ctx) => {
    const m = await getOwnedMember(ctx.user.id, Number(ctx.match[1]));
    if (!m) return ctx.answerCallbackQuery({ text: t.notFound });
    await ctx.answerCallbackQuery();
    await show(ctx, t.memberPage(m.displayName), memberMenu(m.id, m.groupId));
  });

  bot.callbackQuery(/^m:(\d+):ren$/, async (ctx) => {
    const m = await getOwnedMember(ctx.user.id, Number(ctx.match[1]));
    if (!m) return ctx.answerCallbackQuery({ text: t.notFound });
    await ctx.answerCallbackQuery();
    await setState(ctx.user.id, `member_rename:${m.id}`);
    await show(ctx, t.askMemberName(m.displayName), withNav(new InlineKeyboard(), `m:${m.id}`));
  });

  // Delete: first a confirmation screen, then m:<id>:del:yes
  bot.callbackQuery(/^m:(\d+):del(?::(yes))?$/, async (ctx) => {
    const m = await getOwnedMember(ctx.user.id, Number(ctx.match[1]));
    if (!m) return ctx.answerCallbackQuery({ text: t.notFound });

    if (!ctx.match[2]) {
      if (m.userId !== null && m.userId === m.group.ownerId) {
        return ctx.answerCallbackQuery({ text: t.memberIsOwner, show_alert: true });
      }
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard().text(t.btn.yesDelete, `m:${m.id}:del:yes`);
      return show(ctx, t.confirmDeleteMember(m.displayName), withNav(kb, `m:${m.id}`));
    }

    const result = await deleteMember(m.id);
    if (result === "HAS_EXPENSES") {
      return ctx.answerCallbackQuery({ text: t.memberHasExpenses, show_alert: true });
    }
    if (result === "IS_OWNER") {
      return ctx.answerCallbackQuery({ text: t.memberIsOwner, show_alert: true });
    }
    await ctx.answerCallbackQuery({ text: t.memberDeleted });
    await showMembers(ctx, m.groupId);
  });
}
