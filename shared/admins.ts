// Admin emaillari uchun YAGONA manba — klient (src/) ham, server (api/) ham shu yerdan o'qiydi.
//
// DIQQAT: firestore.rules TypeScript import qila olmaydi, shuning uchun u yerdagi ro'yxat
// (isAdminEmail() funksiyasi) shu fayl bilan qo'lda bir xil saqlanishi SHART. Ro'yxatni
// o'zgartirsangiz, firestore.rules ni ham yangilab, qayta deploy qiling:
//   firebase deploy --only firestore:rules
export const ADMIN_EMAILS: readonly string[] = [
  "onlinemobi101@gmail.com",
  "optombazar9@gmail.com",
];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
