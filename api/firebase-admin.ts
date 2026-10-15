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
    return plain as any;
  }
  return headers;
};

// Standart qiymatlar hozirgi ishlab turgan sozlamani saqlaydi; boshqa Firebase
// loyihasiga ko'chirilganda env orqali almashtiriladi.
// Klient tomondagi mos qiymatlar: src/services/firebase.ts
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0398801666";
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ||
  "ai-studio-quizvideogenerat-b76222ad-cbef-4099-98d0-287a876f919d";

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawServiceAccount) {
    const serviceAccount = JSON.parse(rawServiceAccount);
    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    return initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  }

  // Google Cloud muhitida Application Default Credentials ishlaydi. Vercel'da esa
  // FIREBASE_SERVICE_ACCOUNT_JSON secretini sozlash kerak.
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp, DATABASE_ID);

