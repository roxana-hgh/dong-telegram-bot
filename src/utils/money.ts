// src/utils/money.ts
const FA = "۰۱۲۳۴۵۶۷۸۹";
const AR = "٠١٢٣٤٥٦٧٨٩";

/** عدد فارسی/عربی/لاتین و جداکننده‌ی هزارگان رو می‌پذیره */
export function parseAmount(input: string): number | null {
  const s = input
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR.indexOf(d)))
    .replace(/[,،٬\s]/g, "");
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 && n <= 2_000_000_000 ? n : null; // Int پریزما ۳۲ بیتیه
}

export const fmt = (n: number) => `${n.toLocaleString("fa-IR")} تومان`;