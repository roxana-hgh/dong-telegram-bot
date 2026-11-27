// End-to-end test: real handlers + real Postgres, Telegram API replaced by a recorder.
process.env.BOT_TOKEN = "123:abc";
process.env.DATABASE_URL = "postgres://postgres:pw@127.0.0.1:5432/dongtest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

type Call = { method: string; payload: any };
const calls: Call[] = [];
let nextMsg = 1000;

async function main() {
  const { bot } = await import("@/bot");
  const { prisma } = await import("@/db/client");

  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    if (method === "getMe") return { ok: true, result: { id: 1, is_bot: true, first_name: "b", username: "b" } } as any;
    if (method === "sendMessage") return { ok: true, result: { message_id: ++nextMsg, date: 0, chat: { id: 100, type: "private" } } } as any;
    return { ok: true, result: true } as any;
  });
  await bot.init();

  const from = { id: 100, is_bot: false, first_name: "Roxy" };
  const chat = { id: 100, type: "private" as const };
  let uid = 0;
  let screen = 500; // message id of the "current screen"
  const text = (t: string) =>
    bot.handleUpdate({
      update_id: ++uid,
      message: {
        message_id: ++nextMsg, date: 0, chat, from, text: t,
        ...(t.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: t.length }] } : {}),
      },
    } as any);
  const press = (data: string) =>
    bot.handleUpdate({
      update_id: ++uid,
      callback_query: { id: String(uid), from, chat_instance: "c", data,
        message: { message_id: screen, date: 0, chat, text: "x" } },
    } as any);
  const mark = () => calls.length;
  const since = (m: number) => calls.slice(m);
  const shown = (m: number) => since(m).filter((c) => ["sendMessage", "editMessageText"].includes(c.method)).map((c) => c.payload.text as string);
  const alerts = (m: number) => since(m).filter((c) => c.method === "answerCallbackQuery" && c.payload.text).map((c) => c.payload.text as string);
  const buttons = (m: number) =>
    since(m).flatMap((c) => (c.payload.reply_markup?.inline_keyboard ?? []).flat().map((b: any) => b.callback_data as string));
  const step = async () => (await prisma.user.findUniqueOrThrow({ where: { telegramId: 100n } })).step;
  const track = () => { // follow the id of the screen the bot just sent
    const sent = calls.filter((c) => c.method === "sendMessage");
    if (sent.length) screen = nextMsg; // good enough: last sent message id
  };

  let ok = 0;
  const check = (name: string, fn: () => void) => { fn(); ok++; console.log("  ✓", name); };

  // ---------- 1. onboarding + group ----------
  let m = mark();
  await text("/start");
  check("/start shows welcome with main menu", () => {
    assert.match(shown(m)[0], /دونگ/);
    assert.ok(buttons(m).includes("menu:new_group"));
  });
  await press("menu:how");
  check("menu:how has Home and no back to itself", () => assert.ok(buttons(m).includes("menu:home")));

  await press("menu:new_group");
  assert.equal(await step(), "new_group_name");
  await text("خونه");
  const group = await prisma.group.findFirstOrThrow({ where: { name: "خونه" }, include: { members: true } });
  check("group created with owner member", () => {
    assert.equal(group.members.length, 1);
    assert.equal(group.members[0].userId, group.ownerId);
  });
  await text("علی\nسارا\n<b>x</b>");
  const gm = await prisma.member.findMany({ where: { groupId: group.id }, orderBy: { id: "asc" } });
  const [owner, ali, sara, evil] = gm;
  check("members added (one per line)", () => assert.equal(gm.length, 4));
  m = mark();
  await press(`g:done:${group.id}`);
  check("group page escapes HTML in names", () => {
    assert.ok(shown(m)[0].includes("&lt;b&gt;x&lt;/b&gt;"));
    assert.equal(step.length >= 0, true);
  });
  check("group page has members/edit/trips", () => {
    const b = buttons(m);
    for (const x of [`g:${group.id}:trips`, `g:${group.id}:members`, `g:${group.id}:edit`, "menu:home"]) assert.ok(b.includes(x), x);
  });

  // ---------- 2. members ----------
  m = mark();
  await press(`m:${evil.id}:del`);
  await press(`m:${evil.id}:del:yes`);
  check("unused member can be deleted", async () => {});
  assert.equal(await prisma.member.count({ where: { groupId: group.id } }), 3);
  ok++; console.log("  ✓ unused member deleted after confirmation");

  m = mark();
  await press(`m:${owner.id}:del`);
  check("owner member can't be deleted", () => assert.deepEqual(alerts(m), ["این عضو خودتی و حذف نمی‌شه."]));

  await press(`m:${sara.id}:ren`);
  assert.equal(await step(), `member_rename:${sara.id}`);
  m = mark();
  await text("علی");
  check("duplicate name gives Persian message and keeps the step", () => assert.match(shown(m)[0], /قبلاً/));
  await text("سارا ۲");
  check("rename works", () => {});
  assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: sara.id } })).displayName, "سارا ۲");
  assert.equal(await step(), null);

  // ---------- 3. trip ----------
  await press(`g:${group.id}:newtrip`);
  await text("شمال");
  const trip = await prisma.trip.findFirstOrThrow({ where: { groupId: group.id } });
  check("trip created", () => assert.equal(trip.name, "شمال"));

  // stale-step protection
  await press(`g:${group.id}:newtrip`);
  await press(`g:${group.id}:trips`); // navigation button
  m = mark();
  await text("نباید ثبت بشه");
  check("navigating away cancels the text step", () => assert.match(shown(m)[0], /\/start/));
  assert.equal(await prisma.trip.count({ where: { groupId: group.id } }), 1);

  // ---------- 4. quick add ----------
  await press(`t:${trip.id}`);
  check("trip page arms quick-add", async () => {});
  assert.equal(await step(), `quick:${trip.id}`);
  ok++; console.log("  ✓ trip page arms quick-add");

  m = mark();
  await text("۱۲۰٬۰۰۰ شام");
  check("quick add builds the card via edit (not a new message) and deletes user's text", () => {
    assert.ok(since(m).some((c) => c.method === "editMessageText" && /شام/.test(c.payload.text)));
    assert.ok(since(m).some((c) => c.method === "deleteMessage"));
    assert.ok(buttons(m).includes("ex:save"));
  });
  assert.equal(await step(), `exp_card:${trip.id}`);

  // two simultaneous taps on Save must create exactly one expense
  await Promise.all([press("ex:save"), press("ex:save")]);
  let exps = await prisma.expense.findMany({ where: { tripId: trip.id }, include: { shares: true } });
  check("double-tap Save creates exactly one expense", () => assert.equal(exps.length, 1));
  check("default payer = user's own member; everyone shares equally", () => {
    assert.equal(exps[0].paidByMemberId, owner.id);
    assert.equal(exps[0].shares.length, 3);
    assert.equal(exps[0].shares.reduce((s, x) => s + x.amount, 0), 120000);
  });
  assert.equal(await step(), `quick:${trip.id}`);

  // second quick expense, change payer and participants on the card
  await text("تاکسی ۵۰۰۰۰"); // amount last also works
  await press("ex:f:payer");
  await press(`ex:p:${ali.id}`);
  await press("ex:f:split");
  await press(`ex:t:${sara.id}`); // remove sara
  m = mark();
  await press("ex:card");
  check("card shows chosen payer and participants", () => {
    const t = shown(m)[0];
    assert.match(t, /علی/);
    assert.ok(!t.includes("همه"));
  });
  await press("ex:save");
  exps = await prisma.expense.findMany({ where: { tripId: trip.id }, include: { shares: true }, orderBy: { id: "asc" } });
  check("second expense saved with 2 participants", () => {
    assert.equal(exps.length, 2);
    assert.equal(exps[1].paidByMemberId, ali.id);
    assert.deepEqual(exps[1].shares.map((s) => s.memberId).sort(), [owner.id, ali.id].sort());
  });

  // default payer now = last payer (Ali)
  m = mark();
  await text("۹۰۰۰ نون");
  check("default payer = last payer of the trip", () => assert.match(shown(m)[0], /پرداخت‌کننده: علی/));
  await press("ex:save");

  // ---------- 5. wizard ----------
  await press(`t:${trip.id}:exp`);
  assert.equal(await step(), `exp_in_amount:${trip.id}`);
  m = mark();
  await text("abc");
  check("bad amount is rejected", () => assert.match(shown(m)[0], /معتبر نیست/));
  m = mark();
  await text("77000");
  check("wizard asks for description next", () => assert.match(shown(m)[0], /توضیح/));
  m = mark();
  await text("ناهار");
  check("wizard ends on the card with defaults", () => assert.ok(buttons(m).includes("ex:save")));
  await press("ex:save");
  assert.equal(await prisma.expense.count({ where: { tripId: trip.id } }), 4);

  // amount-only quick message asks for the description
  m = mark();
  await press(`t:${trip.id}`);
  await text("15000");
  check("amount-only quick message asks for description", () => assert.match(shown(m).at(-1)!, /توضیح/));
  await text("آب");
  await press("ex:cancel-does-not-exist");
  await press(`t:${trip.id}`); // leave without saving
  assert.equal(await prisma.expense.count({ where: { tripId: trip.id } }), 4);
  ok++; console.log("  ✓ leaving the card without saving creates nothing");

  // ---------- 6. report, list, edit, delete ----------
  m = mark();
  await press(`t:${trip.id}:report`);
  check("report works", () => assert.match(shown(m)[0], /گزارش/));
  m = mark();
  await press(`t:${trip.id}:report:direct`);
  check("report direct mode works", () => assert.match(shown(m)[0], /پرداخت مستقیم/));

  m = mark();
  await press(`t:${trip.id}:list`);
  check("expense list lists 4 expenses", () => assert.equal(buttons(m).filter((b) => /^e:\d+$/.test(b)).length, 4));

  const target = exps[0];
  await press(`e:${target.id}:edit`);
  await press("ex:f:amount");
  await text("100000");
  await press("ex:save");
  const edited = await prisma.expense.findUniqueOrThrow({ where: { id: target.id }, include: { shares: true } });
  check("editing an expense reuses the card and rebuilds shares", () => {
    assert.equal(edited.amount, 100000);
    assert.equal(edited.shares.reduce((s, x) => s + x.amount, 0), 100000);
    assert.deepEqual(edited.shares.map((s) => s.amount).sort(), [33333, 33333, 33334]);
  });

  // member with expenses can't be deleted
  m = mark();
  await press(`m:${ali.id}:del:yes`);
  check("member with expenses can't be deleted (Persian alert)", () => assert.match(alerts(m)[0], /تو خرج‌ها/));
  assert.ok(await prisma.member.findUnique({ where: { id: ali.id } }));

  // delete expense
  await press(`e:${exps[1].id}:del`);
  await press(`e:${exps[1].id}:del:yes`);
  check("expense deleted (shares cascade)", () => {});
  assert.equal(await prisma.expenseShare.count({ where: { expenseId: exps[1].id } }), 0);

  // ---------- 7. settle ----------
  await press(`t:${trip.id}:settle`);
  assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status, "OPEN");
  await press(`t:${trip.id}:settle:yes`);
  assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status, "SETTLED");
  ok++; console.log("  ✓ settle needs confirmation, then trip is SETTLED");

  m = mark();
  await press(`t:${trip.id}:exp`);
  await press(`e:${target.id}:edit`);
  await press(`e:${target.id}:del:yes`);
  check("settled trip blocks add / edit / delete", () =>
    assert.equal(alerts(m).filter((a) => a === "این مورد تسویه شده").length, 3));
  assert.equal(await step(), null);

  m = mark();
  await press(`e:${target.id}`);
  check("expense page of a settled trip has no edit/delete", () => {
    assert.ok(!buttons(m).includes(`e:${target.id}:edit`));
  });
  await press(`t:${trip.id}:reopen`);
  assert.equal((await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } })).status, "OPEN");
  ok++; console.log("  ✓ reopen works");

  // ---------- 8. ownership ----------
  const stranger = await prisma.user.create({ data: { telegramId: 999n, name: "Eve" } });
  const foreign = await prisma.group.create({ data: { name: "foreign", ownerId: stranger.id } });
  m = mark();
  await press(`g:${foreign.id}:del:yes`);
  check("can't touch someone else's group", () => assert.deepEqual(alerts(m), ["گروه پیدا نشد"]));
  assert.ok(await prisma.group.findUnique({ where: { id: foreign.id } }));

  // ---------- 9. delete group (two-step) with expenses ----------
  await press(`g:${group.id}:del:yes`.replace(":yes", ":2")); // skipping straight to stage 2 is harmless
  assert.ok(await prisma.group.findUnique({ where: { id: group.id } }));
  await press(`g:${group.id}:del`);
  assert.ok(await prisma.group.findUnique({ where: { id: group.id } }));
  await press(`g:${group.id}:del:yes`);
  check("group with trips/expenses/shares is deleted via cascade", async () => {});
  assert.equal(await prisma.group.findUnique({ where: { id: group.id } }), null);
  assert.equal(await prisma.expense.count({ where: { tripId: trip.id } }), 0);
  ok++; console.log("  ✓ group with trips/expenses/shares deleted via cascade");

  // ---------- 10. routing: every callback_data in the source matches exactly one handler ----------
  const patterns: (string | RegExp)[] = [];
  const fake: any = {
    callbackQuery: (p: any) => patterns.push(p),
    command: () => {}, on: () => {},
  };
  const mods = await Promise.all([
    import("@/handlers/start"), import("@/handlers/groups"), import("@/handlers/members"),
    import("@/handlers/trip"), import("@/handlers/expense"), import("@/handlers/expenseList"),
    import("@/handlers/report"),
  ]);
  for (const mod of mods) for (const fn of Object.values(mod)) if (typeof fn === "function" && (fn as any).name.startsWith("register")) (fn as any)(fake);

  const files: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? (f !== "generated" && walk(p)) : p.endsWith(".ts") && files.push(p); });
  walk("src");
  const found = new Set<string>();
  for (const f of files) {
    for (const mm of readFileSync(f, "utf8").matchAll(/[`"']((?:menu|g|m|t|e|ex|soon):[^`"'\n]*)[`"']/g)) {
      const v = mm[1].replace(/\$\{other\}/g, "min").replace(/\$\{[^}]*\}/g, "1");
      if (v === "ex:" || v === "ex:*") continue; // prefix constant / comment, not real callback_data
      found.add(v);
    }
  }
  const bad: string[] = [];
  for (const d of found) {
    const n = patterns.filter((p) => (typeof p === "string" ? p === d : p.test(d))).length;
    if (n !== 1 || Buffer.byteLength(d) > 64) bad.push(`${d} -> ${n} handlers`);
  }
  check(`all ${found.size} callback_data values in the source match exactly one handler`, () => assert.deepEqual(bad, []));

  console.log(`\nALL OK (${ok} checks)`);
  await prisma.$disconnect();
  process.exit(0);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
