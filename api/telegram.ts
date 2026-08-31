import type { IncomingMessage, ServerResponse } from "node:http";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBAPP_URL = process.env.TELEGRAM_WEBAPP_URL || "https://quiz-video-generator-yangi-phi.vercel.app";

function sendJSON(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  }).catch(() => {});
}

async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: any) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");
  const action = url.searchParams.get("action");

  if (req.method === "GET") {
    sendJSON(res, 200, {
      status: "ok",
      botConfigured: Boolean(TELEGRAM_BOT_TOKEN),
      webAppUrl: WEBAPP_URL,
    });
    return;
  }

  if (req.method !== "POST") {
    sendJSON(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }

  try {
    const rawBody = await readBody(req);
    const contentType = req.headers["content-type"] || "";

    // 1. Frontend'dan video yuborish so'rovi (sendVideo action)
    if (action === "sendVideo") {
      if (!TELEGRAM_BOT_TOKEN) {
        sendJSON(res, 503, { error: "TELEGRAM_BOT_NOT_CONFIGURED" });
        return;
      }

      let chatId = "";
      let caption = "🎬 Sizning Quiz videongiz tayyor bo'ldi!";
      let videoBuffer: Buffer | null = null;
      let filename = "quiz_video.mp4";

      if (contentType.includes("application/json")) {
        const json = JSON.parse(rawBody.toString("utf-8") || "{}");
        chatId = String(json.chatId || "");
        if (json.caption) caption = json.caption;
        if (json.videoBase64) {
          videoBuffer = Buffer.from(json.videoBase64, "base64");
        }
      } else if (contentType.includes("multipart/form-data")) {
        // Multipart parse: sodda ajratish yoki raw body uzatish
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : "";
        if (boundary) {
          // Telegram SendVideo API ga to'g'ridan-to'g'ri forward qilamiz
          const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`;
          const tgResponse = await fetch(tgUrl, {
            method: "POST",
            headers: { "Content-Type": contentType },
            body: rawBody,
          });
          const tgData = await tgResponse.json().catch(() => ({}));
          if (tgResponse.ok && tgData?.ok) {
            sendJSON(res, 200, { success: true, result: tgData.result });
            return;
          }
        }
      }

      if (chatId && videoBuffer) {
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("caption", caption);
        const blob = new Blob([videoBuffer], { type: "video/mp4" });
        formData.append("video", blob, filename);

        const tgResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
          method: "POST",
          body: formData,
        });
        const tgData = await tgResponse.json().catch(() => ({}));
        if (!tgResponse.ok || !tgData?.ok) {
          sendJSON(res, 502, { error: tgData?.description || "TELEGRAM_API_ERROR" });
          return;
        }
        sendJSON(res, 200, { success: true, messageId: tgData.result?.message_id });
        return;
      }

      sendJSON(res, 400, { error: "INVALID_REQUEST_DATA" });
      return;
    }

    // 2. Telegram Webhook Updates (/start, /help, callback_query)
    if (contentType.includes("application/json")) {
      const update = JSON.parse(rawBody.toString("utf-8") || "{}");
      
      // Inline tugma bosilganda (Callback Query)
      const callbackQuery = update?.callback_query;
      if (callbackQuery) {
        const cbChatId = callbackQuery.message?.chat?.id;
        const cbData = callbackQuery.data;
        const cbId = callbackQuery.id;

        await answerCallbackQuery(cbId);

        if (cbChatId && cbData === "help") {
          const helpText =
            `📖 <b>Qanday qilib video tayyorlanadi?</b>\n\n` +
            `1️⃣ <b>«🎬 Generatorni ochish»</b> tugmasini bosing.\n` +
            `2️⃣ Istalgan mavzuni yozing (masalan: <i>Kosmos</i>, <i>Tarix</i>, <i>Geografiya</i>).\n` +
            `3️⃣ AI savollarni tuzadi, ovozlar qo'shadi va fon rasmlarini yuklaydi.\n` +
            `4️⃣ <b>«Video Yuklab Olish»</b> tugmasini bosing — video tayyor bo'ladi va ushbu chatga ham yuboriladi!\n\n` +
            `🚀 Hoziroq quyidagi tugmani bosib sinab ko'ring:`;

          const replyMarkup = {
            inline_keyboard: [
              [
                {
                  text: "🎬 Generatorni ochish (Mini App)",
                  web_app: { url: WEBAPP_URL },
                },
              ],
            ],
          };

          await sendTelegramMessage(cbChatId, helpText, replyMarkup);
          sendJSON(res, 200, { ok: true });
          return;
        }
      }

async function processReferralBonus(referrerParam: string, newChatId: string, newUserName: string) {
  try {
    if (!referrerParam || referrerParam === newChatId) return;

    const referralId = `ref_${newChatId}`;
    const referralRef = adminDb.collection("referrals").doc(referralId);
    const referralSnap = await referralRef.get();
    if (referralSnap.exists) return;

    await referralRef.set({
      referrer: referrerParam,
      referredUserChatId: newChatId,
      referredUserName: newUserName,
      createdAt: new Date().toISOString(),
    });

    let referrerDocRef = adminDb.collection("users").doc(referrerParam);
    let referrerSnap = await referrerDocRef.get();

    if (!referrerSnap.exists) {
      const querySnap = await adminDb
        .collection("users")
        .where("telegramId", "==", Number(referrerParam) || referrerParam)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        referrerDocRef = querySnap.docs[0].ref;
        referrerSnap = querySnap.docs[0];
      }
    }

    await referrerDocRef.set(
      {
        referralsCount: FieldValue.increment(1),
        bonusVideos: FieldValue.increment(1),
      },
      { merge: true }
    );

    const referrerData = referrerSnap.exists ? referrerSnap.data() : null;
    const targetChatId = referrerData?.telegramId || (Number(referrerParam) > 1000 ? referrerParam : null);

    if (targetChatId) {
      const bonusMsg =
        `🎉 <b>Yangi do'stingiz qo'shildi!</b>\n\n` +
        `<b>${newUserName}</b> sizning referal havolangiz orqali botga kirdi.\n\n` +
        `🎁 <b>Sizga +1 ta bepul video qo'shildi!</b>\n` +
        `<i>Ko'proq do'stlarni taklif qiling va bepul videolar yutib oling!</i>`;

      const markup = {
        inline_keyboard: [
          [
            {
              text: "🎬 Generatorni ochish (Mini App)",
              web_app: { url: WEBAPP_URL },
            },
          ],
        ],
      };

      await sendTelegramMessage(targetChatId, bonusMsg, markup).catch(() => {});
    }
  } catch (err) {
    console.error("Error processing referral bonus:", err);
  }
}

      const message = update?.message;
      const chatId = message?.chat?.id;
      const text = message?.text || "";
      const firstName = message?.from?.first_name || "Do'stim";

      if (chatId && text.startsWith("/start")) {
        const parts = text.split(" ");
        const startParam = parts[1] || "";

        if (startParam.startsWith("ref_")) {
          const referrerParam = startParam.replace("ref_", "").trim();
          if (referrerParam) {
            processReferralBonus(referrerParam, String(chatId), firstName).catch(() => {});
          }
        }

        const welcomeText = 
          `Assalomu alaykum, <b>${firstName}</b>! 🎬\n\n` +
          `<b>Quiz Video Generator</b> botiga xush kelibsiz!\n\n` +
          `Bu bot orqali siz <b>YouTube Shorts</b>, <b>TikTok</b> va <b>Instagram Reels</b> uchun sun'iy intellekt (AI) yordamida qiziqarli test videolarini 1 daqiqada tayyorlashingiz mumkin.\n\n` +
          `✨ <i>AI Savollar, Ovozlar, Rasm tanlash va 30 FPS silliq render!</i>\n\n` +
          `🎁 <i>Do'stlaringizni taklif qilib, har bir do'stingiz uchun <b>+1 ta bepul video</b> yutib olishingiz mumkin!</i>\n\n` +
          `👇 Ishni boshlash uchun quyidagi tugmani bosing:`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: "🎬 Generatorni ochish (Mini App)",
                web_app: { url: WEBAPP_URL },
              },
            ],
            [
              {
                text: "ℹ️ Qo'llanma",
                callback_data: "help",
              },
            ],
          ],
        };

        await sendTelegramMessage(chatId, welcomeText, replyMarkup);
        sendJSON(res, 200, { ok: true });
        return;
      }

      if (chatId && (text.startsWith("/help") || text.startsWith("ℹ️"))) {
        const helpText =
          `📖 <b>Qanday qilib video tayyorlanadi?</b>\n\n` +
          `1️⃣ <b>«🎬 Generatorni ochish»</b> tugmasini bosing.\n` +
          `2️⃣ Istalgan mavzuni yozing (masalan: <i>Kosmos</i>, <i>Tarix</i>, <i>Geografiya</i>).\n` +
          `3️⃣ AI savollarni tuzadi, ovozlar qo'shadi va fon rasmlarini yuklaydi.\n` +
          `4️⃣ <b>«Video Yuklab Olish»</b> tugmasini bosing — video tayyor bo'ladi va ushbu chatga ham yuboriladi!\n\n` +
          `🚀 Hoziroq quyidagi tugmani bosib sinab ko'ring:`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: "🎬 Generatorni ochish (Mini App)",
                web_app: { url: WEBAPP_URL },
              },
            ],
          ],
        };

        await sendTelegramMessage(chatId, helpText, replyMarkup);
        sendJSON(res, 200, { ok: true });
        return;
      }
    }

    sendJSON(res, 200, { ok: true });
  } catch (error: any) {
    console.error("Telegram handler error:", error);
    sendJSON(res, 500, { error: error?.message || "INTERNAL_ERROR" });
  }
}
