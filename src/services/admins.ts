// Admin emaillari — klient tomoni uchun re-export.
// Asosiy manba: shared/admins.ts (server ham o'qiydi).
// Bu fayl src/ ichida bo'lgani uchun Vite uni klient bundle'ga xavfsiz kiritadi.
export { ADMIN_EMAILS, isAdminEmail } from "../../shared/admins";
