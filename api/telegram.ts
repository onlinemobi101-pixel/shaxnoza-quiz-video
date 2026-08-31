import type { IncomingMessage, ServerResponse } from "node:http";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin.js";
import { transcribeAudio } from "./ai.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBAPP_URL = process.env.TELEGRAM_WEBAPP_URL || "https://quiz-video-generator-yangi-phi.vercel.app";
const TELEGRAM_REQUIRED_CHANNEL = process.env.TELEGRAM_REQUIRED_CHANNEL || "";

async function getRequiredChannel(): Promise<string> {
  if (TELEGRAM_REQUIRED_CHANNEL) return TELEGRAM_REQUIRED_CHANNEL.trim();
  try {
    const docSnap = await adminDb.collection("settings").doc("telegram").get();
    const val = docSnap.data()?.requiredChannel;
    return typeof val === "string" ? val.trim() : "";
  } catch {
    return "";
  }
}

async function checkUserSubscription(chatId: number | string, channelUsernameOrId: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !channelUsernameOrId) return true;
  try {
    const formattedChannel = channelUsernameOrId.startsWith("@") || channelUsernameOrId.startsWith("-100") 
      ? channelUsernameOrId 
      : `@${channelUsernameOrId}`;
      
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(formattedChannel)}&user_id=${chatId}`;
    const response = await fetch(url);
    const data = await response.json();
    if (!data.ok) {
      console.warn("getChatMember response:", data.description);
      // Agar bot kanalda admin bo'lmasa yoki kanal nomi xato bo'lsa, foydalanuvchini to'xtatib qo'ymaslik uchun true qaytaramiz
      return true;
    }
    const status = data.result?.status;
    return ["creator", "administrator", "member", "restricted"].includes(status);
  } catch (err) {
    console.error("Subscription check error:", err);
    return true;
  }
}

async function sendSubscriptionRequiredMessage(chatId: number | string, firstName: string, channel: string) {
  const channelClean = channel.replace("@", "");
  const channelLink = channel.startsWith("http") ? channel : `https://t.me/${channelClean}`;
  const text =
    `Assalomu alaykum, <b>${firstName}</b>! 🎬\n\n` +
    `🤖 <b>Quiz Video Generator</b> botidan foydalanish uchun rasmiy kanalimizga a'zo bo'ling.\n\n` +
    `📢 Kanalda foydali qo'llanmalar, yangi AI funksiyalari va maxsus aksiyalar e'lon qilinadi.\n\n` +
    `👇 <b>Kanalga a'zo bo'lib, «✅ A'zo bo'ldim» tugmasini bosing:</b>`;

  const replyMarkup = {
    inline_keyboard: [
      [
        {
          text: `📢 Kanalga a'zo bo'lish (${channel.startsWith("@") ? channel : `@${channel}`})`,
          url: channelLink,
        },
      ],
      [
        {
          text: "✅ A'zo bo'ldim (Tekshirish)",
          callback_data: "check_sub",
        },
      ],
    ],
  };

  await sendTelegramMessage(chatId, text, replyMarkup);
}

async function sendWelcomeMenu(chatId: number | string, firstName: string) {
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
}

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

async function isTelegramAdmin(chatId: number | string): Promise<boolean> {
  try {
    const numId = Number(chatId);
    const snap = await adminDb
      .collection("users")
      .where("telegramId", "in", [chatId, numId])
      .limit(1)
      .get();
    if (!snap.empty) {
      const data = snap.docs[0].data();
      if (data.role === "admin") return true;
    }
    const settingsSnap = await adminDb.collection("settings").doc("telegram").get();
    const adminIds: (string | number)[] = settingsSnap.data()?.adminChatIds || [];
    if (adminIds.includes(chatId) || adminIds.includes(numId)) return true;
    return false;
  } catch (err) {
    console.error("Error checking telegram admin:", err);
    return false;
  }
}

async function broadcastTelegramMessage(
  text: string,
  replyMarkup?: any,
  photoUrl?: string
): Promise<{ total: number; sent: number; failed: number }> {
  if (!TELEGRAM_BOT_TOKEN || !text) return { total: 0, sent: 0, failed: 0 };

  const chatIds = new Set<string | number>();
  
  try {
    const usersSnap = await adminDb.collection("users").get();
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.telegramId) {
        chatIds.add(data.telegramId);
      }
    });

    const referralsSnap = await adminDb.collection("referrals").get();
    referralsSnap.forEach((doc) => {
      const data = doc.data();
      if (data.referredUserChatId) {
        chatIds.add(data.referredUserChatId);
      }
    });
  } catch (err) {
    console.error("Error fetching chatIds for broadcast:", err);
  }

  const allTargets = Array.from(chatIds);
  let sent = 0;
  let failed = 0;

  for (const targetId of allTargets) {
    try {
      if (photoUrl) {
        const photoApi = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        const res = await fetch(photoApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetId,
            photo: photoUrl,
            caption: text,
            parse_mode: "HTML",
            reply_markup: replyMarkup,
          }),
        });
        const d = await res.json();
        if (d.ok) sent++;
        else failed++;
      } else {
        const msgApi = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const res = await fetch(msgApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: targetId,
            text,
            parse_mode: "HTML",
            reply_markup: replyMarkup,
          }),
        });
        const d = await res.json();
        if (d.ok) sent++;
        else failed++;
      }
    } catch {
      failed++;
    }

    await new Promise((r) => setTimeout(r, 35));
  }

  return { total: allTargets.length, sent, failed };
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
  }).catch(() => {});
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
    if (action === "checkSubscription") {
      const channel = await getRequiredChannel();
      const chatId = url.searchParams.get("chatId") || "";
      if (!channel || !chatId) {
        sendJSON(res, 200, { required: Boolean(channel), channel, isSubscribed: true });
        return;
      }
      const isSubscribed = await checkUserSubscription(chatId, channel);
      sendJSON(res, 200, {
        required: true,
        channel,
        channelLink: `https://t.me/${channel.replace("@", "")}`,
        isSubscribed,
      });
      return;
    }

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

    // 2. Admin Broadcast Action (from Admin Panel web interface)
    if (action === "broadcast") {
      const authHeader = req.headers["authorization"] || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        sendJSON(res, 401, { error: "AUTH_REQUIRED" });
        return;
      }

      let decoded;
      try {
        const { adminAuth } = await import("./firebase-admin.js");
        decoded = await adminAuth.verifyIdToken(token);
      } catch {
        sendJSON(res, 401, { error: "INVALID_AUTH_TOKEN" });
        return;
      }

      const json = JSON.parse(rawBody.toString("utf-8") || "{}");
      const messageText = json.message || "";
      if (!messageText) {
        sendJSON(res, 400, { error: "MESSAGE_REQUIRED" });
        return;
      }

      const defaultMarkup = {
        inline_keyboard: [
          [
            {
              text: json.buttonText || "🎬 Generatorni ochish (Mini App)",
              web_app: { url: json.buttonUrl || WEBAPP_URL },
            },
          ],
        ],
      };

      const stats = await broadcastTelegramMessage(messageText, defaultMarkup, json.photoUrl);
      sendJSON(res, 200, { success: true, ...stats });
      return;
    }

    // 3. Telegram Webhook Updates (/start, /help, /send, /stats, callback_query)
    if (contentType.includes("application/json")) {
      const update = JSON.parse(rawBody.toString("utf-8") || "{}");
      
      // Inline tugma bosilganda (Callback Query)
      const callbackQuery = update?.callback_query;
      if (callbackQuery) {
        const cbChatId = callbackQuery.message?.chat?.id;
        const cbData = callbackQuery.data;
        const cbId = callbackQuery.id;
        const cbFirstName = callbackQuery.from?.first_name || "Do'stim";

        if (cbChatId && cbData === "check_sub") {
          const channel = await getRequiredChannel();
          const isSub = await checkUserSubscription(cbChatId, channel);
          if (!isSub) {
            await answerCallbackQuery(cbId, "❌ Siz hali kanalga a'zo bo'lmadingiz. Iltimos, kanalga a'zo bo'ling!");
            return;
          }
          await answerCallbackQuery(cbId, "✅ Rahmat! A'zolik tasdiqlandi.");
          await sendWelcomeMenu(cbChatId, cbFirstName);
          sendJSON(res, 200, { ok: true });
          return;
        }

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

      const message = update?.message;
      const chatId = message?.chat?.id;
      const text = (message?.text || "").trim();
      const firstName = message?.from?.first_name || "Do'stim";

      // Admin buyruqlari: Ommaviy xabar yuborish (/send yoki /broadcast)
      if (chatId && (text.startsWith("/send") || text.startsWith("/broadcast"))) {
        const isAdminUser = await isTelegramAdmin(chatId);
        if (!isAdminUser) {
          const usersSnap = await adminDb.collection("users").where("telegramId", "in", [chatId, Number(chatId)]).limit(1).get();
          const userRole = !usersSnap.empty ? usersSnap.docs[0].data()?.role : null;
          if (userRole !== "admin") {
            await sendTelegramMessage(chatId, "❌ Bu buyruq faqat bot adminlari uchun mo'ljallangan.");
            sendJSON(res, 200, { ok: true });
            return;
          }
        }

        const msgContent = text.replace(/^\/(send|broadcast)\s*/i, "").trim();
        if (!msgContent) {
          await sendTelegramMessage(
            chatId,
            `ℹ️ <b>Ommaviy xabar yuborish formati:</b>\n\n<code>/send Sizning xabaringiz...</code>\n\n<i>Matnda HTML teglaridan (<b>qalin</b>, <i>kursiv</i>) foydalanishingiz mumkin.</i>`
          );
          sendJSON(res, 200, { ok: true });
          return;
        }

        await sendTelegramMessage(chatId, "⏳ <b>Ommaviy xabar tarqatish boshlandi...</b>\n<i>Iltimos, kuting, barcha foydalanuvchilarga yetkazilmoqda.</i>");

        const defaultMarkup = {
          inline_keyboard: [
            [
              {
                text: "🎬 Generatorni ochish (Mini App)",
                web_app: { url: WEBAPP_URL },
              },
            ],
          ],
        };

        const result = await broadcastTelegramMessage(msgContent, defaultMarkup);

        await sendTelegramMessage(
          chatId,
          `📢 <b>Xabar tarqatish yakunlandi!</b>\n\n` +
          `👥 Jami foydalanuvchilar: <b>${result.total}</b> ta\n` +
          `✅ Muvaffaqiyatli yetkazildi: <b>${result.sent}</b> ta\n` +
          `❌ Yetkazilmadi (bloklagan): <b>${result.failed}</b> ta`
        );
        sendJSON(res, 200, { ok: true });
        return;
      }

      // Admin buyrug'i: Bot statistikasi (/stats)
      if (chatId && text === "/stats") {
        const isAdminUser = await isTelegramAdmin(chatId);
        if (!isAdminUser) {
          const usersSnap = await adminDb.collection("users").where("telegramId", "in", [chatId, Number(chatId)]).limit(1).get();
          const userRole = !usersSnap.empty ? usersSnap.docs[0].data()?.role : null;
          if (userRole !== "admin") {
            await sendTelegramMessage(chatId, "❌ Bu buyruq faqat bot adminlari uchun mo'ljallangan.");
            sendJSON(res, 200, { ok: true });
            return;
          }
        }

        const usersSnap = await adminDb.collection("users").get();
        const totalUsers = usersSnap.size;
        let tgUsers = 0;
        let proUsers = 0;
        usersSnap.forEach((d) => {
          const u = d.data();
          if (u.telegramId) tgUsers++;
          if (u.role === "premium" || u.role === "pack10" || u.role === "admin") proUsers++;
        });

        const referralsSnap = await adminDb.collection("referrals").get();
        const totalReferrals = referralsSnap.size;

        await sendTelegramMessage(
          chatId,
          `📊 <b>Quiz Video Generator — Jonli Statistika:</b>\n\n` +
          `👥 Jami ro'yxatdan o'tganlar: <b>${totalUsers}</b> ta\n` +
          `✈️ Telegram bot foydalanuvchilari: <b>${tgUsers}</b> ta\n` +
          `🎁 Referal orqali qo'shilganlar: <b>${totalReferrals}</b> ta\n` +
          `👑 Pro / Pullik obunachilar: <b>${proUsers}</b> ta`
        );
        sendJSON(res, 200, { ok: true });
        return;
      }

      // Admin buyruqlari: Majburiy kanalni o'rnatish yoki o'chirish
      if (chatId && text.startsWith("/setchannel")) {
        const channelArg = text.split(" ")[1] || "";
        if (channelArg) {
          await adminDb.collection("settings").doc("telegram").set(
            { requiredChannel: channelArg.trim(), updatedAt: new Date().toISOString() },
            { merge: true }
          );
          await sendTelegramMessage(chatId, `✅ <b>Majburiy a'zolik kanali o'rnatildi:</b> ${channelArg}`);
          sendJSON(res, 200, { ok: true });
          return;
        }
      }

      if (chatId && text === "/clearchannel") {
        await adminDb.collection("settings").doc("telegram").set(
          { requiredChannel: "", updatedAt: new Date().toISOString() },
          { merge: true }
        );
        await sendTelegramMessage(chatId, `✅ <b>Majburiy a'zolik o'chirildi.</b> Foydalanuvchilar to'g'ridan-to'g'ri foydalana oladilar.`);
        sendJSON(res, 200, { ok: true });
        return;
      }

      if (chatId && text.startsWith("/start")) {
        const parts = text.split(" ");
        const startParam = parts[1] || "";

        if (startParam.startsWith("ref_")) {
          const referrerParam = startParam.replace("ref_", "").trim();
          if (referrerParam) {
            processReferralBonus(referrerParam, String(chatId), firstName).catch(() => {});
          }
        }

        const channel = await getRequiredChannel();
        if (channel) {
          const isSub = await checkUserSubscription(chatId, channel);
          if (!isSub) {
            await sendSubscriptionRequiredMessage(chatId, firstName, channel);
            sendJSON(res, 200, { ok: true });
            return;
          }
        }

        await sendWelcomeMenu(chatId, firstName);
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

      // Ovozli xabarlar (Voice / Audio notes) ni qabul qilish va mavzuga aylantirish
      const voice = message?.voice || message?.audio;
      if (chatId && voice) {
        const channel = await getRequiredChannel();
        if (channel) {
          const isSub = await checkUserSubscription(chatId, channel);
          if (!isSub) {
            await sendSubscriptionRequiredMessage(chatId, firstName, channel);
            sendJSON(res, 200, { ok: true });
            return;
          }
        }

        try {
          const fileId = voice.file_id;
          const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
          const fileData = await fileRes.json();
          const filePath = fileData.result?.file_path;

          if (filePath) {
            const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
            const audioBuffer = Buffer.from(await (await fetch(downloadUrl)).arrayBuffer());
            const transcribedTopic = await transcribeAudio(audioBuffer, voice.mime_type || "audio/ogg");

            if (transcribedTopic) {
              const launchUrl = `${WEBAPP_URL}?topic=${encodeURIComponent(transcribedTopic)}`;
              const replyText =
                `🎙 <b>Ovozingiz eshitildi:</b>\n` +
                `💬 <i>«${transcribedTopic}»</i>\n\n` +
                `🎬 <b>Ushbu mavzuda video yaratish uchun quyidagi tugmani bosing:</b>`;

              const markup = {
                inline_keyboard: [
                  [
                    {
                      text: `✨ «${transcribedTopic.slice(0, 25)}${transcribedTopic.length > 25 ? '...' : ''}» bo'yicha video yasash`,
                      web_app: { url: launchUrl },
                    },
                  ],
                ],
              };

              await sendTelegramMessage(chatId, replyText, markup);
              sendJSON(res, 200, { ok: true });
              return;
            }
          }
        } catch (voiceErr) {
          console.error("Voice transcription error:", voiceErr);
        }

        await sendTelegramMessage(chatId, "⚠️ Ovozingizni to'liq aniqlab bo'lmadi. Iltimos, qaytadan yuboring yoki mavzuni matn ko'rinishida yozing.");
        sendJSON(res, 200, { ok: true });
        return;
      }

      // Foydalanuvchi oddiy matn yuborsa (Mavzu sifatida qabul qilib, tugma chiqarish)
      if (chatId && text && !text.startsWith("/")) {
        const channel = await getRequiredChannel();
        if (channel) {
          const isSub = await checkUserSubscription(chatId, channel);
          if (!isSub) {
            await sendSubscriptionRequiredMessage(chatId, firstName, channel);
            sendJSON(res, 200, { ok: true });
            return;
          }
        }

        const launchUrl = `${WEBAPP_URL}?topic=${encodeURIComponent(text)}`;
        const promptReply =
          `💡 <b>"${text}" mavzusi tanlandi!</b>\n\n` +
          `🎬 Ushbu mavzuda AI savollar va video tayyorlash uchun quyidagi tugmani bosing:`;

        const markup = {
          inline_keyboard: [
            [
              {
                text: `🎬 "${text.slice(0, 25)}${text.length > 25 ? '...' : ''}" bo'yicha video yasash`,
                web_app: { url: launchUrl },
              },
            ],
          ],
        };

        await sendTelegramMessage(chatId, promptReply, markup);
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
