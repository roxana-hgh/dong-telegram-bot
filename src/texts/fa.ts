// src/texts/fa.ts  (all bot texts live here; user-provided values are HTML-escaped)
import { esc } from "@/utils/html";
import { fmt } from "@/utils/money";
import { L } from "@/ui/labels";

const list = (names: string[]) => names.map((n) => `• ${esc(n)}`).join("\n");
const n = (x: number) => x.toLocaleString("fa-IR");

export const fa = {
  welcome:
    "👋 <b>سلام! به دونگ خوش اومدی</b>\n\n" +
    "<blockquote>خرج‌های گروهی رو ثبت کن و ببین آخرش کی به کی چقدر بدهکاره 💸\n" +
    "سفر، خونه‌ی مشترک، دورهمی…</blockquote>\n\n" +
    "👇 از اینجا شروع کن:",
  how:
    "📖 <b>دونگ چطور کار می‌کنه؟</b>\n\n" +
    "<b>۱ ·</b> 👥 یه گروه بساز و اعضا رو اضافه کن\n" +
    `<b>۲ ·</b> 📅 برای هر سفر یا دورهمی یه ${L.trip} جدید باز کن\n` +
    "<b>۳ ·</b> 🧾 خرج‌ها رو ثبت کن؛ سریع‌ترین راه: یه پیام مثل «۱۲۰۰۰۰ شام»\n" +
    "<b>۴ ·</b> 📊 گزارش رو ببین و با کمترین تعداد پرداخت تسویه کن\n\n" +
    `<i>اعضای گروه ثابت می‌مونن؛ هر ${L.trip} خرج‌های خودش رو داره.</i>`,
  about:
    "ℹ️ <b>درباره‌ی دونگ</b>\n\n" +
    "یه ربات ساده برای تقسیم هزینه‌ی گروهی. فعلاً در حال ساخته شدنه 🚧",
  soon: "به‌زودی 🚧",
  fallback: "برای دیدن منو /start رو بزن.",
  expired: "این دکمه منقضی شده، /start رو بزن.",
  cancelled: "لغو شد 👌",
  notFound: "پیدا نشد",
  problem: "مشکلی پیش اومد، از اول شروع کن.",

  // ---- groups ----
  askGroupName:
    "✏️ <b>اسم گروه چیه؟</b>\n\nمثلاً: <i>سفر شمال</i> یا <i>خونه‌ی مشترک</i>",
  nameTooLong: "اسم زیادی بلنده؛ حداکثر ۵۰ کاراکتر.",
  askMembers: (name: string) =>
    `✅ گروه <b>${esc(name)}</b> ساخته شد!\n\n` +
    "حالا اسم بقیه‌ی اعضا رو بفرست. هر خط یه اسم، و می‌تونی چندتا رو توی یه پیام بفرستی. " +
    "خودت از قبل اضافه شدی.\n\nوقتی تموم شد «تمام» رو بزن.",
  askMoreMembers:
    "➕ اسم عضو جدید رو بفرست. هر خط یه اسم، و می‌تونی چندتا رو توی یه پیام بفرستی.\n\nوقتی تموم شد «تمام» رو بزن.",
  membersAdded: (names: string[]) =>
    `👥 <b>اعضا (${n(names.length)})</b>\n${list(names)}\n\nاسم بعدی رو بفرست یا «تمام» رو بزن.`,
  groupsTitle: "👥 <b>گروه‌های من</b>",
  noGroups: "هنوز گروهی نداری. اولین گروهت رو بساز 👇",
  groupPage: (name: string, names: string[]) =>
    `👥 <b>${esc(name)}</b>\n\n<b>اعضا (${n(names.length)})</b>\n${list(names)}`,
  groupNotFound: "گروه پیدا نشد",

  groupEditPage: (name: string) => `✏️ <b>ویرایش گروه «${esc(name)}»</b>`,
  askGroupRename: (name: string) => `✏️ اسم جدید گروه «${esc(name)}» رو بفرست:`,
  deleteGroup1: (name: string, trips: number, expenses: number) =>
    `🗑 <b>حذف گروه «${esc(name)}»</b>\n\n` +
    `با حذف گروه، ${n(trips)} ${L.trip}، ${n(expenses)} خرج و همه‌ی اعضا هم پاک می‌شن.\n\nمطمئنی؟`,
  deleteGroup2: (name: string) =>
    `⚠️ <b>آخرین هشدار</b>\n\nگروه «${esc(name)}» و همه‌ی اطلاعاتش برای همیشه حذف می‌شه و راه برگشتی نداره.`,
  groupDeleted: (name: string) => `🗑 گروه «${esc(name)}» حذف شد.`,

  // ---- members ----
  membersTitle: (group: string, count: number) =>
    `👥 <b>اعضای «${esc(group)}» (${n(count)})</b>\n\nروی اسم هر نفر بزن تا ویرایش یا حذفش کنی.`,
  memberPage: (name: string) => `👤 <b>${esc(name)}</b>`,
  askMemberName: (name: string) => `✏️ اسم جدید برای «${esc(name)}» رو بفرست:`,
  dupName: "این اسم قبلاً تو گروه هست؛ یه اسم دیگه بفرست.",
  memberHasExpenses: "این عضو تو خرج‌ها هست و حذف نمی‌شه. اول خرج‌هاش رو حذف یا ویرایش کن.",
  memberIsOwner: "این عضو خودتی و حذف نمی‌شه.",
  confirmDeleteMember: (name: string) => `🗑 عضو «${esc(name)}» حذف بشه؟`,
  memberDeleted: "عضو حذف شد",

  // ---- trips ----
  tripsTitle: (group: string) => `📅 <b>${L.trips}</b> «${esc(group)}»`,
  askTripName: `✏️ اسم ${L.trip} رو بنویس (مثلاً «شمال تابستون»):`,
  tripNameTooLong: "اسم خیلی طولانیه (حداکثر ۵۰ کاراکتر).",
  tripCreated: (name: string) => `✅ ${L.trip} «${esc(name)}» ساخته شد.`,
  tripSummary: (p: { name: string; settled: boolean; count: number; total: number; quick: boolean }) =>
    [
      `📅 ${L.trip}: <b>${esc(p.name)}</b>`,
      p.settled ? "✅ تسویه‌شده" : "🟢 باز",
      `🧾 ${n(p.count)} خرج · جمع: ${fmt(p.total)}`,
      ...(p.quick ? ["", "💡 برای ثبت سریع خرج، یه پیام مثل «۱۲۰۰۰۰ شام» بفرست."] : []),
    ].join("\n"),
  confirmSettle: (name: string) =>
    `✅ <b>تسویه‌ی «${esc(name)}»</b>\n\nبعد از تسویه دیگه نمی‌شه خرج اضافه، ویرایش یا حذف کرد (هر وقت خواستی می‌تونی بازگشایی کنی). تسویه شد؟`,
  settledToast: "تسویه شد ✅",
  reopenedToast: "بازگشایی شد",

  // ---- expense card & flow ----
  askAmount: "💰 مبلغ خرج چنده؟ (تومان)",
  askNewAmount: "💰 مبلغ جدید رو بفرست (تومان):",
  badAmount: "مبلغ معتبر نیست. فقط عدد به تومان بفرست (مثلاً ۱۲۰۰۰۰).",
  askDesc: "📝 توضیح خرج چیه؟ (مثلاً «شام»)",
  askNewDesc: "📝 توضیح جدید رو بفرست:",
  askPayer: "💳 چه کسی پرداخت کرد؟",
  askSplit: "👥 خرج بین چه کسانی تقسیم بشه؟",
  quickHint: "مبلغ رو بفرست؛ مثلاً «۱۲۰۰۰۰ شام» یا فقط «۱۲۰۰۰۰».",
  card: (p: {
    editing: boolean;
    amount?: number;
    description?: string;
    payer: string;
    participants: string[];
    everyone: boolean;
  }) =>
    [
      p.editing ? "✏️ <b>ویرایش خرج</b>" : "🧾 <b>خرج جدید</b>",
      "",
      `💰 مبلغ: ${p.amount ? fmt(p.amount) : "—"}`,
      `📝 توضیح: ${p.description ? esc(p.description) : "—"}`,
      `💳 پرداخت‌کننده: ${esc(p.payer)}`,
      `👥 بین: ${p.everyone ? `همه (${n(p.participants.length)} نفر)` : p.participants.map(esc).join("، ")}`,
    ].join("\n"),
  cardIncomplete: "مبلغ و توضیح لازمه",
  expenseSaved: (desc: string, amount: number) =>
    `✅ ثبت شد\n${esc(desc)}: ${fmt(amount)}\n\n💡 خرج بعدی رو همین‌جا بفرست (مثلاً «۵۰۰۰۰ تاکسی»).`,
  expenseUpdated: (desc: string, amount: number) =>
    `✅ ذخیره شد\n${esc(desc)}: ${fmt(amount)}`,
  tripSettled: "این مورد تسویه شده",
  needTwoMembers: "حداقل ۲ عضو لازمه",
  pickAtLeastOne: "حداقل یک نفر رو انتخاب کن",
  saveFailed: "ثبت نشد، دوباره تلاش کن",
  noExpenses: "هنوز خرجی ثبت نشده",

  // ---- expense list & page ----
  expensesTitle: (trip: string, count: number, shown: number) =>
    `📋 <b>خرج‌های «${esc(trip)}»</b> (${n(count)})` +
    (count > shown ? `\n<i>${n(shown)} مورد آخر نمایش داده می‌شه.</i>` : ""),
  noExpensesList: "هنوز خرجی ثبت نشده.",
  expensePage: (p: {
    description: string;
    amount: number;
    payer: string;
    shares: { name: string; amount: number }[];
  }) =>
    [
      `🧾 <b>${esc(p.description)}</b>`,
      `💰 ${fmt(p.amount)}`,
      `💳 پرداخت‌کننده: ${esc(p.payer)}`,
      "",
      "<b>سهم‌ها:</b>",
      ...p.shares.map((s) => `• ${esc(s.name)}: ${fmt(s.amount)}`),
    ].join("\n"),
  confirmDeleteExpense: (desc: string, amount: number) =>
    `🗑 خرج «${esc(desc)}» (${fmt(amount)}) حذف بشه؟`,

  // ---- report ----
  report: (p: {
    tripName: string;
    total: number;
    balances: { name: string; value: number }[];
    modeLabel: string;
    transfers: { from: string; to: string; amount: number }[];
  }) =>
    [
      `📊 <b>گزارش «${esc(p.tripName)}»</b>`,
      `جمع کل: ${fmt(p.total)}`,
      "",
      "<b>وضعیت هر نفر:</b>",
      ...p.balances.map((b) => {
        const icon = b.value > 0 ? "🟢" : b.value < 0 ? "🔴" : "⚪";
        return `${icon} ${esc(b.name)}: ${b.value > 0 ? "+" : ""}${fmt(b.value)}`;
      }),
      "",
      `<b>پیشنهاد تسویه</b> (${p.modeLabel}):`,
      ...(p.transfers.length
        ? p.transfers.map((x) => `${esc(x.from)} ← ${esc(x.to)}: ${fmt(x.amount)}`)
        : ["همه حساب‌ها صافه 🎉"]),
    ].join("\n"),
  modeMin: "کمترین تعداد تراکنش",
  modeDirect: "پرداخت مستقیم",

  btn: {
    newGroup: "➕ گروه جدید",
    myGroups: "👥 گروه‌های من",
    how: "📖 روش کار",
    about: "ℹ️ درباره‌ی دونگ",
    back: "🔙 بازگشت",
    home: "🏠 خانه",
    cancel: "❌ انصراف",
    done: "✅ تمام",
    open: "باز کردن",
    newTrip: `➕ ${L.newTrip}`,
    newExpense: "🧾 خرج جدید",
    report: "📊 گزارش",
    expenses: "📋 خرج‌ها",
    settle: "✅ تسویه شد",
    reopen: "🔓 بازگشایی",
    modeMin: "🔀 کمترین تراکنش",
    modeDirect: "🔀 پرداخت مستقیم",
    members: "👥 اعضا",
    addMember: "➕ عضو جدید",
    editGroup: "✏️ ویرایش گروه",
    rename: "✏️ تغییر نام",
    edit: "✏️ ویرایش",
    del: "🗑 حذف",
    yesDelete: "🗑 بله، حذف شود",
    yesSettle: "✅ بله، تسویه شد",
    continue: "⚠️ ادامه",
    deleteFinal: "🗑 بله، برای همیشه حذف شود",
    save: "✅ ثبت",
    saveEdit: "✅ ذخیره‌ی تغییرات",
    fAmount: "💰 مبلغ",
    fDesc: "📝 توضیح",
    fPayer: "💳 پرداخت‌کننده",
    fSplit: "👥 شرکت‌کننده‌ها",
    confirm: "✔️ تأیید",
  },
};
