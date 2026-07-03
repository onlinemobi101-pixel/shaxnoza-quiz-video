import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Foydalanuvchi talabiga ko'ra Firebase config obyektini hozircha bo'sh qoldiramiz.
// O'z loyihangiz ma'lumotlarini bu yerga joylashtirishingiz mumkin:
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// Agar foydalanuvchi config'ni to'ldirmagan bo'lsa, Studio loyihasi sozlamalaridan xavfsiz foydalanamiz.
// Bu foydalanuvchi o'z kalitlarini kiritmaguncha ham ilova ishlashini ta'minlaydi.
const finalConfig = firebaseConfig.apiKey ? firebaseConfig : {
  apiKey: "AIzaSyDWBgBGukUFeB9TeIan3VN86QwufySwyqY",
  authDomain: "gen-lang-client-0398801666.firebaseapp.com",
  projectId: "gen-lang-client-0398801666",
  storageBucket: "gen-lang-client-0398801666.firebasestorage.app",
  messagingSenderId: "977559101963",
  appId: "1:977559101963:web:0dbd2606ac427adf801d0e",
};

const app = getApps().length === 0 ? initializeApp(finalConfig) : getApp();

export const auth = getAuth(app);
const isFallback = !firebaseConfig.apiKey;
export const db = isFallback
  ? getFirestore(app, "ai-studio-quizvideogenerat-b76222ad-cbef-4099-98d0-287a876f919d")
  : getFirestore(app);
