import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "gen-lang-client-0398801666";
const DATABASE_ID = "ai-studio-quizvideogenerat-b76222ad-cbef-4099-98d0-287a876f919d";

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

