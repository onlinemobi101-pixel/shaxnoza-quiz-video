# Quiz Video Generator

AI yordamida YouTube Shorts, Reels va YouTube Long uchun test videolar yaratuvchi ilova.
Video foydalanuvchi brauzerida (Canvas + MediaRecorder) render qilinadi — serverda render
xarajati yo'q, faqat AI chaqiruvlari tannarxga kiradi.

## Lokal ishga tushirish

**Talab:** Node.js 22+

1. Bog'liqliklarni o'rnating: `npm install`
2. `.env.example` ni `.env.local` ga nusxalang va quyidagilarni to'ldiring:
   - `GCP_SERVICE_ACCOUNT_JSON` — Vertex AI service account (matn va TTS modellari uchun).
     `GEMINI_API_KEY` **kerak emas** — ilova Vertex AI'ga service account bilan ulanadi.
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — server tomonda token tekshirish, rate limit va
     atomik video kreditlari uchun.

   Ikkala qiymat ham faqat server muhitida qoladi va klient bundle'iga tushmaydi.
3. Ishga tushiring: `npm run dev`

## Skriptlar

| Buyruq | Vazifasi |
|---|---|
| `npm run dev` | Vite dev server (`/api/ai` shu yerda ham ishlaydi) |
| `npm run build` | Prodakshn build (`dist/`) |
| `npm start` | Portable Node server (Render/Docker uchun, `dist/` ni beradi) |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | Vitest (bir marta) |
| `npm run test:watch` | Vitest kuzatuv rejimida |

## Testlar

Testlar `tests/` papkasida (`api/` ichida EMAS — u yerdagi har bir fayl Vercel'da
serverless funksiyaga aylanadi). Firestore, Firebase Auth va Vertex AI
`tests/helpers/` dagi stublar bilan almashtiriladi, ya'ni testlar tarmoqsiz ishlaydi.

Qamrab olingan joylar — pul va tannarx bilan bog'liq mantiq:

- `tests/ai-budget.test.ts` — AI byudjeti: tarif chegaralari, refund, sikl almashuvi
- `tests/tts-limits.test.ts` — `ttsBatch` ning Vercel vaqt (60s) va javob hajmi (4.5MB)
  chegaralariga urilmasligi, qisman natija qaytarishi
- `tests/admins.test.ts` — `shared/admins.ts` va `firestore.rules` dagi admin ro'yxati
  bir xilligi
- `tests/deploy-config.test.ts` — `render.yaml` kod talab qiladigan env qiymatlarni
  so'rashi (va ortiqchasini so'ramasligi)
- `tests/draft.test.ts` — brauzer xotirasi to'lganda avtosaqlashning bosqichma-bosqich
  pasayishi va foydalanuvchi mehnatini yo'qotmasligi

## Deploy

Ilova Vercel'ga (`api/ai.ts` serverless funksiya) yoki Render/Docker'ga
(`server.ts` orqali, `render.yaml` blueprint bilan) chiqariladi.

**Firestore qoidalari alohida deploy qilinadi** va kod bilan birga chiqmaydi:

```bash
npm run deploy:rules
```

Bu skript global `firebase-tools` ni talab qiladi (`npm install -g firebase-tools`).
U ataylab devDependencies'ga qo'shilmagan: Vercel va Render build paytida devDependencies'ni
o'rnatadi, ya'ni ~300MB hech qachon ishlatilmaydigan paket har bir deploy'ni sekinlashtirardi.
Global o'rnatmasdan: `npx firebase-tools deploy --only firestore:rules`.

`shared/admins.ts` dagi admin ro'yxatini o'zgartirsangiz, `firestore.rules` ni ham
yangilab, shu buyruqni bajaring — aks holda `npm test` sizni ogohlantiradi.

AI endpointlari Firebase ID token talab qiladi; Google hisobi bilan kirgandan keyin
birinchi video bepul.
