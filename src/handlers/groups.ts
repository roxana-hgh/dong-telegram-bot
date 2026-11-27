// src/handlers/groups.ts  (create / open / edit / delete a group)
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { fa as t } from "@/texts/fa";
import { groupMenu, cancelKb, doneKb, withNav } from "@/keyboards";
import { getOwnedGroup } from "@/services/access";
import { setState } from "@/services/state";
import { show, html } from "@/ui/show";

export function registerGroupHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery("menu:new_group", async (ctx) => {
    await ctx.answerCallbackQuery();
    await setState(ctx.user.id, "new_group_name");
    await show(ctx, t.askGroupName, cancelKb);
  });

  bot.callbackQuery("menu:my_groups", async (ctx) => {
    await ctx.answerCallbackQuery();
    const groups = await prisma.group.findMany({
      where: { ownerId: ctx.user.id },
      orderBy: { id: "desc" },
    });
    const kb = new InlineKeyboard();
    groups.forEach((g) => kb.text(`👥 ${g.name}`, `g:${g.id}`).row());
    kb.text(t.btn.newGroup, "menu:new_group");
    await show(ctx, groups.length ? t.groupsTitle : t.noGroups, withNav(kb));
  });

  // Open a group (also used after "done" while adding members)
  bot.callbackQuery(/^g:(done:)?(\d+)$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[2]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();
    await show(
      ctx,
      t.groupPage(group.name, group.members.map((m) => m.displayName)),
      groupMenu(group.id)
    );
  });

  // ---- edit group ----
  bot.callbackQuery(/^g:(\d+):edit$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard()
      .text(t.btn.rename, `g:${group.id}:ren`)
      .text(t.btn.del, `g:${group.id}:del`);
    await show(ctx, t.groupEditPage(group.name), withNav(kb, `g:${group.id}`));
  });

  bot.callbackQuery(/^g:(\d+):ren$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    await ctx.answerCallbackQuery();
    await setState(ctx.user.id, `group_rename:${group.id}`);
    await show(ctx, t.askGroupRename(group.name), withNav(new InlineKeyboard(), `g:${group.id}:edit`));
  });

  // Delete with a two-step confirmation: g:<id>:del → :del:2 → :del:yes
  bot.callbackQuery(/^g:(\d+):del(?::(2|yes))?$/, async (ctx) => {
    const group = await getOwnedGroup(ctx.user.id, Number(ctx.match[1]));
    if (!group) return ctx.answerCallbackQuery({ text: t.groupNotFound });
    const stage = ctx.match[2];
    await ctx.answerCallbackQuery();

    if (!stage) {
      const [trips, expenses] = await Promise.all([
        prisma.trip.count({ where: { groupId: group.id } }),
        prisma.expense.count({ where: { trip: { groupId: group.id } } }),
      ]);
      const kb = new InlineKeyboard().text(t.btn.continue, `g:${group.id}:del:2`);
      return show(ctx, t.deleteGroup1(group.name, trips, expenses), withNav(kb, `g:${group.id}:edit`));
    }

    if (stage === "2") {
      const kb = new InlineKeyboard().text(t.btn.deleteFinal, `g:${group.id}:del:yes`);
      return show(ctx, t.deleteGroup2(group.name), withNav(kb, `g:${group.id}:edit`));
    }

    // Expenses (and their shares, via cascade) must go first: with NoAction FKs on Member,
    // Postgres can check "member still referenced" before the trip→expense cascade has run.
    await prisma.$transaction([
      prisma.expense.deleteMany({ where: { trip: { groupId: group.id } } }),
      prisma.group.delete({ where: { id: group.id } }), // trips + members cascade
    ]);
    await show(ctx, t.groupDeleted(group.name), withNav(new InlineKeyboard().text(t.btn.myGroups, "menu:my_groups")));
  });

  bot.callbackQuery(/^soon:/, (ctx) =>
    ctx.answerCallbackQuery({ text: t.soon, show_alert: true })
  );

  // Text messages: handles only the group creation steps,
  // everything else is passed on via next()
  bot.on("message:text", async (ctx, next) => {
    const user = ctx.user;
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return next();

    if (user.step === "new_group_name") {
      if (text.length > 50) return ctx.reply(t.nameTooLong);
      const group = await prisma.group.create({
        data: {
          name: text,
          ownerId: user.id,
          // The creator is the first member
          members: { create: { displayName: user.name, userId: user.id } },
        },
      });
      await setState(user.id, `add_members:${group.id}`);
      return ctx.reply(t.askMembers(group.name), { ...html, reply_markup: doneKb(group.id) });
    }

    if (user.step?.startsWith("add_members:")) {
      const groupId = Number(user.step.split(":")[1]);
      const group = await getOwnedGroup(user.id, groupId);
      if (!group) {
        await setState(user.id, null);
        return ctx.reply(t.fallback);
      }
      const names = text
        .split("\n")
        .map((s) => s.trim().slice(0, 30))
        .filter(Boolean);
      await prisma.member.createMany({
        data: names.map((displayName) => ({ groupId, displayName })),
        skipDuplicates: true,
      });
      const members = await prisma.member.findMany({ where: { groupId }, orderBy: { id: "asc" } });
      return ctx.reply(t.membersAdded(members.map((m) => m.displayName)), {
        ...html,
        reply_markup: doneKb(groupId),
      });
    }

    return next(); // not a group step: let the step router handle it
  });
}
