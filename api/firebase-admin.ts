import * as fs from "fs";
import * as path from "path";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { OAuth2Client } from "google-auth-library";

// Node 24 va google-auth-library v10 moslashuvi:
// google-auth-library v10 da getRequestHeaders() Web Headers obyektini qaytaradi,
// biroq @grpc/grpc-js uni oddiy JavaScript obyekti (Object.keys) deb kutadi.
// Natijada Authorization sarlavhasi bo'sh qolib "7 PERMISSION_DENIED" xatosi kelib chiqadi.
// Ushbu patch Headers obyektini oddiy obyektga aylantirib beradi.
const origGetRequestHeaders = OAuth2Client.prototype.getRequestHeaders;
OAuth2Client.prototype.getRequestHeaders = async function (...args: any[]) {
  const headers = await origGetRequestHeaders.apply(this, args);
  if (headers && typeof (headers as any).get === "function") {
    const plain: Record<string, string> = {};
    (headers as any).forEach((val: string, key: string) => {
      plain[key] = val;
    });
    // @google/genai (Vertex AI NodeAuth) for..of orqali authHeaders ni aylantiradi:
    Object.defineProperty(plain, Symbol.iterator, {
      enumerable: false,
      value: function* () {
        for (const [k, v] of Object.entries(plain)) {
          yield [k, v];
        }
      },
    });
    // Ehtiyot chorasi sifatida .get va .forEach ham qo'shiladi:
    Object.defineProperty(plain, "get", {
      enumerable: false,
      value: (name: string) => {
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(plain)) {
          if (k.toLowerCase() === lower) return v;
        }
        return null;
      },
    });
    return plain as any;
  }
  return headers;
};

// Lokal dev muhitida .env.local faylini import vaqtida o'qib olish (Vite yuklashidan oldin)
function ensureEnvLoaded() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const envPath = path.resolve(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        for (const line of content.split("\n")) {
          const match = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
          if (match && !process.env[match[1]]) {
            let v = match[2].trim();
            if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) {
              v = v.slice(1, -1);
            }
            process.env[match[1]] = v;
          }
        }
      }
    } catch {}
  }
}
ensureEnvLoaded();

// Standart qiymatlar hozirgi ishlab turgan sozlamani saqlaydi; boshqa Firebase
// loyihasiga ko'chirilganda env orqali almashtiriladi.
// Klient tomondagi mos qiymatlar: src/services/firebase.ts
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0398801666";
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ||
  "ai-studio-quizvideogenerat-b76222ad-cbef-4099-98d0-287a876f919d";

function getAdminApp() {
  ensureEnvLoaded();
  if (getApps().length > 0) return getApps()[0];

  let rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawServiceAccount) {
    if ((rawServiceAccount.startsWith("'") && rawServiceAccount.endsWith("'")) ||
        (rawServiceAccount.startsWith('"') && rawServiceAccount.endsWith('"'))) {
      rawServiceAccount = rawServiceAccount.slice(1, -1);
    }
    const serviceAccount = JSON.parse(rawServiceAccount);
    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    return initializeApp({ credential: cert(serviceAccount), projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID });
  }

  // Google Cloud muhitida Application Default Credentials ishlaydi. Vercel'da esa
  // FIREBASE_SERVICE_ACCOUNT_JSON secretini sozlash kerak.
  return initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || PROJECT_ID });
}

import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";

let _adminApp: any = null;
let _adminAuth: any = null;
let _adminDb: any = null;

export const adminAuth: Auth = new Proxy({} as any, {
  get(_, prop) {
    if (!_adminAuth) {
      if (!_adminApp) _adminApp = getAdminApp();
      _adminAuth = getAuth(_adminApp);
    }
    const val = (_adminAuth as any)[prop];
    return typeof val === "function" ? val.bind(_adminAuth) : val;
  },
});

export const adminDb: Firestore = new Proxy({} as any, {
  get(_, prop) {
    if (!_adminDb) {
      if (!_adminApp) _adminApp = getAdminApp();
      _adminDb = getFirestore(_adminApp, DATABASE_ID);
    }
    const val = (_adminDb as any)[prop];
    return typeof val === "function" ? val.bind(_adminDb) : val;
  },
});

