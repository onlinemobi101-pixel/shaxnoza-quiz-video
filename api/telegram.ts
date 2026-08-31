import type { IncomingMessage, ServerResponse } from "node:http";

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

    // 2. Telegram Webhook Updates (/start, /help)
    if (contentType.includes("application/json")) {
      const update = JSON.parse(rawBody.toString("utf-8") || "{}");
      const message = update?.message;
      const chatId = message?.chat?.id;
      const text = message?.text || "";
      const firstName = message?.from?.first_name || "Do'stim";

      if (chatId && text.startsWith("/start")) {
        const welcomeText = 
          `Assalomu alaykum, <b>${firstName}</b>! 🎬\n\n` +
          `<b>Quiz Video Generator</b> botiga xush kelibsiz!\n\n` +
          `Bu bot orqali siz <b>YouTube Shorts</b>, <b>TikTok</b> va <b>Instagram Reels</b> uchun sun'iy intellekt (AI) yordamida qiziqarli test videolarini 1 daqiqada tayyorlashingiz mumkin.\n\n` +
          `✨ <i>AI Savollar, Ovozlar, Rasm tanlash va 30 FPS silliq render!</i>\n\n` +
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
          `1️⃣ <b>Generatorni ochish</b> tugmasini bosing.\n` +
          `2️⃣ Mavzuni kiriting (masalan: <i>Koinot sirlari</i> yoki <i>Tarix</i>).\n` +
          `3️⃣ AI savollar va ovozlarni avtomatik tayyorlaydi.\n` +
          `4️⃣ <b>«Video Yuklab Olish»</b> tugmasini bosing — video tayyor bo'lib, to'g'ridan-to'g'ri galereyangizga saqlanadi.\n\n` +
          `🚀 Hoziroq sinab ko'ring!`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: "🎬 Generatorni ochish",
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
