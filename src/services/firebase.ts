import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signOut,
  signInWithPopup
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  deleteDoc,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { Quiz } from "../types";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Logout Helper
export const logoutUser = () => signOut(auth);

// Sign in with Google Pop-up
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

// Firestore Quizzes Helpers
export interface SavedQuiz {
  id: string;
  title: string;
  quizData: Quiz;
  userId: string;
  updatedAt: Timestamp;
}

export async function saveQuizToCloud(userId: string, quiz: Quiz, quizId?: string): Promise<string> {
  const quizzesCol = collection(db, "quizzes");
  
  const docData = {
    title: quiz.title || "Yangi Test",
    quizData: quiz,
    userId,
    updatedAt: Timestamp.now()
  };

  if (quizId) {
    const docRef = doc(db, "quizzes", quizId);
    await setDoc(docRef, docData, { merge: true });
    return quizId;
  } else {
    const docRef = await addDoc(quizzesCol, docData);
    return docRef.id;
  }
}

export async function getUserQuizzes(userId: string): Promise<SavedQuiz[]> {
  const quizzesCol = collection(db, "quizzes");
  const q = query(quizzesCol, where("userId", "==", userId));
  const querySnapshot = await getDocs(q);
  
  const results: SavedQuiz[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    results.push({
      id: docSnap.id,
      title: data.title || "Yozilmagan mavzu",
      quizData: data.quizData as Quiz,
      userId: data.userId,
      updatedAt: data.updatedAt
    });
  });

  // Sort by updatedAt descending
  return results.sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis());
}

export async function deleteQuizFromCloud(quizId: string): Promise<void> {
  const docRef = doc(db, "quizzes", quizId);
  await deleteDoc(docRef);
}

// --- Premium & Usage Tracking ---
export interface UserProfile {
  uid: string;
  usageCount: number;
  isPremium: boolean;
  role?: string;
  email?: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    
    // Auto-update email in Firestore if missing
    if (auth.currentUser && auth.currentUser.email && (!data.email || data.email !== auth.currentUser.email)) {
      await setDoc(docRef, { email: auth.currentUser.email }, { merge: true });
    }

    return {
      uid: userId,
      usageCount: data.usageCount || 0,
      isPremium: data.isPremium || false,
      role: data.role || "user",
      email: data.email || auth.currentUser?.email || "Nomalum"
    };
  } else {
    const defaultProfile = {
      usageCount: 0,
      isPremium: false,
      role: "user",
      email: auth.currentUser?.email || "Nomalum"
    };
    await setDoc(docRef, defaultProfile);
    return {
      uid: userId,
      ...defaultProfile,
    };
  }
}

export async function incrementUserUsage(userId: string): Promise<number> {
  const docRef = doc(db, "users", userId);
  const profile = await getUserProfile(userId);
  const newCount = profile.usageCount + 1;
  await setDoc(docRef, { usageCount: newCount }, { merge: true });
  return newCount;
}

export async function upgradeUserToPremium(userId: string): Promise<void> {
  const docRef = doc(db, "users", userId);
  await setDoc(docRef, { isPremium: true }, { merge: true });
}

// --- Admin Panel Helpers ---
export async function getAllUsersAdmin(): Promise<UserProfile[]> {
  const usersCol = collection(db, "users");
  const querySnapshot = await getDocs(usersCol);
  const results: UserProfile[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    results.push({
      uid: docSnap.id,
      usageCount: data.usageCount || 0,
      isPremium: data.isPremium || false,
      role: data.role || "user",
      email: data.email || "Nomalum email"
    });
  });
  return results;
}

export async function updateUserProfileAdmin(targetUserId: string, updates: Partial<UserProfile & { role?: string }>): Promise<void> {
  const docRef = doc(db, "users", targetUserId);
  await setDoc(docRef, updates, { merge: true });
}

export interface AdminSavedQuiz {
  id: string;
  title: string;
  userId: string;
  updatedAt: Timestamp;
}

export async function getAllSavedQuizzesAdmin(): Promise<AdminSavedQuiz[]> {
  const quizzesCol = collection(db, "quizzes");
  const querySnapshot = await getDocs(quizzesCol);
  const results: AdminSavedQuiz[] = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    results.push({
      id: docSnap.id,
      title: data.title || "Yozilmagan mavzu",
      userId: data.userId,
      updatedAt: data.updatedAt
    });
  });
  return results;
}

