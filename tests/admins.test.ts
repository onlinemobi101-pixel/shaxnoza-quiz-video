import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ADMIN_EMAILS, isAdminEmail } from "../shared/admins";

const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf-8");

describe("isAdminEmail", () => {
  it("ro'yxatdagi emaillarni taniydi", () => {
    for (const email of ADMIN_EMAILS) {
      expect(isAdminEmail(email)).toBe(true);
    }
  });

  it("begona va bo'sh qiymatlarni rad etadi", () => {
    expect(isAdminEmail("someone@gmail.com")).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

// firestore.rules TypeScript import qila olmaydi, shuning uchun admin ro'yxati u yerda
// qo'lda takrorlanadi. Aynan shu takror bir marta ikki manba orasida farq hosil qilgan:
// optombazar9@gmail.com kodda admin edi, rules'da esa yo'q — natijada u foydalanuvchi
// o'z profilini yarata olmasdi. Bu test o'sha driftni qaytib kelishiga yo'l qo'ymaydi.
describe("firestore.rules bilan sinxronlik", () => {
  it("har bir admin emaili rules faylida ham bor", () => {
    for (const email of ADMIN_EMAILS) {
      expect(
        firestoreRules.includes(email),
        `${email} shared/admins.ts da bor, lekin firestore.rules da yo'q. ` +
          "Rules'ni yangilab, 'firebase deploy --only firestore:rules' ni bajaring.",
      ).toBe(true);
    }
  });

  it("rules faylida ortiqcha admin emaili yo'q", () => {
    const emailsInRules = firestoreRules.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    for (const email of new Set(emailsInRules)) {
      expect(
        ADMIN_EMAILS.includes(email),
        `${email} firestore.rules da admin sifatida turibdi, lekin shared/admins.ts da yo'q.`,
      ).toBe(true);
    }
  });
});
