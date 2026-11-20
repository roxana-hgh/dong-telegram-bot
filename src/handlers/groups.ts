// src/handlers/group.ts
import { Bot, InlineKeyboard } from "grammy";
import type { MyContext } from "@/types";
import { prisma } from "@/db/client";
import { setStep } from "@/db/users";
import { fa as t } from "@/texts/fa";
import { groupMenu, cancelKb, doneKb } from "@/keyboards";

const html = { parse_mode: "HTML" as const };

// Only the group owner can see it. Every callback is checked server-side.
const loadGroup = (groupId: number, userId: number) =>
  prisma.group.findFirst({
    where: { id: groupId, ownerId: userId },
    include: { members: { orderBy: { id: "asc" } } },
  });

async function showGroup(ctx: MyContext, groupId: number) {
  const group = await loadGroup(groupId, ctx.user.id);
  if (!group) return;
  await ctx.editMessageText(
    t.groupPage(group.name, group.members.map((m) => m.displayName)),
    { ...html, reply_markup: groupMenu(group.id) }
  );
}

export function registerGroupHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery("menu:new_group", async (ctx) => {
    await ctx.answerCallbackQuery();
    await setStep(ctx.user.id, "new_group_name");
    await ctx.editMessageText(t.askGroupName, { ...html, reply_markup: cancelKb });
  });

  bot.callbackQuery("menu:my_groups", async (ctx) => {
    await ctx.answerCallbackQuery();
    const groups = await prisma.group.findMany({
      where: { ownerId: ctx.user.id },
      orderBy: { id: "desc" },
    });
    const kb = new InlineKeyboard();
    groups.forEach((g) => kb.text(`👥 ${g.name}`, `g:${g.id}`).row());
    kb.text(t.btn.newGroup, "menu:new_group").row().text(t.btn.back, "menu:home");
    await ctx.editMessageText(groups.length ? t.groupsTitle : t.noGroups, {
      ...html,
      reply_markup: kb,
    });
  });

  bot.callbackQuery(/^g:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showGroup(ctx, Number(ctx.match[1]));
  });

  bot.callbackQuery(/^g:done:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await setStep(ctx.user.id, null);
    await showGroup(ctx, Number(ctx.match[1]));
  });

  bot.callbackQuery(/^soon:/, (ctx) =>
    ctx.answerCallbackQuery({ text: t.soon, show_alert: true })
  );

  // Text messages: handles only the group-related steps,
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
      await setStep(user.id, `add_members:${group.id}`);
      return ctx.reply(t.askMembers(group.name), {
        ...html,
        reply_markup: doneKb(group.id),
      });
    }

    if (user.step?.startsWith("add_members:")) {
      const groupId = Number(user.step.split(":")[1]);
      const group = await loadGroup(groupId, user.id);
      if (!group) {
        await setStep(user.id, null);
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
      const members = await prisma.member.findMany({
        where: { groupId },
        orderBy: { id: "asc" },
      });
      return ctx.reply(t.membersAdded(members.map((m) => m.displayName)), {
        ...html,
        reply_markup: doneKb(groupId),
      });
    }

    return next(); // not a group step: let the step router handle it
  });
}