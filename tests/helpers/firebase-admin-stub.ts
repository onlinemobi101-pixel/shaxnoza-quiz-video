// api/firebase-admin.ts ning test o'rnini bosuvchisi — xotiradagi Firestore va Auth.
//
// Ishlatilishi (test faylida):
//   vi.mock("../api/firebase-admin.js", () => import("./helpers/firebase-admin-stub"));
//   import { __store, __reset } from "./helpers/firebase-admin-stub";
//
// vi.mock fabrikasi va testning o'zi bir xil modul nusxasini oladi, shuning uchun
// testdan __store ga yozilgan ma'lumotni ishlab turgan kod ko'radi.

export const __store = new Map<string, any>();

let autoId = 0;
let authUser: { uid: string; email?: string } = { uid: "u1", email: "user@example.com" };

function snapshot(path: string) {
  return { exists: __store.has(path), data: () => __store.get(path) };
}

function write(path: string, data: any, merge?: boolean) {
  __store.set(path, merge ? { ...(__store.get(path) || {}), ...data } : { ...data });
}

function collectionRef(path: string): any {
  return { doc: (id?: string) => documentRef(`${path}/${id ?? `auto-${autoId++}`}`) };
}

function documentRef(path: string): any {
  return {
    _path: path,
    collection: (sub: string) => collectionRef(`${path}/${sub}`),
    get: async () => snapshot(path),
    set: async (data: any, options?: any) => write(path, data, options?.merge),
    update: async (data: any) => write(path, data, true),
  };
}

export const adminDb: any = {
  collection: (name: string) => collectionRef(name),
  // recordModelUsage analitikasi — testlar uchun ahamiyatsiz, shunchaki yutamiz.
  batch: () => ({ set: () => {}, commit: async () => {} }),
  runTransaction: async (fn: any) =>
    fn({
      get: async (ref: any) => snapshot(ref._path),
      set: (ref: any, data: any, options?: any) => write(ref._path, data, options?.merge),
      update: (ref: any, data: any) => write(ref._path, data, true),
    }),
};

export const adminAuth: any = {
  verifyIdToken: async () => authUser,
};

export function __setAuthUser(user: { uid: string; email?: string }) {
  authUser = user;
}

export function __setUserDoc(uid: string, data: Record<string, unknown>) {
  __store.set(`users/${uid}`, data);
}

export function __getUserDoc(uid: string): Record<string, any> {
  return __store.get(`users/${uid}`) || {};
}

export function __reset() {
  __store.clear();
  autoId = 0;
  authUser = { uid: "u1", email: "user@example.com" };
}
