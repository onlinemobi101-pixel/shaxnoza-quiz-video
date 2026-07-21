// localStorage har doim ishlayvermaydi:
//   - Safari private rejimida va ba'zi korporativ sozlamalarda u butunlay o'chirilgan
//     bo'lishi mumkin — hatto getItem ham xato tashlaydi;
//   - xotira to'lganda setItem QuotaExceededError beradi.
//
// Himoyalanmagan chaqiruv o'zidan keyingi kodni to'xtatib qo'yadi. Masalan, mode'ni
// almashtirishdan oldingi setItem yiqilsa, foydalanuvchi tugmani bosadi-yu, hech narsa
// sodir bo'lmaydi. Shuning uchun ilovadagi barcha chaqiruvlar shu yordamchilar orqali.

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage mavjud emas — qiladigan ishimiz yo'q.
  }
}
