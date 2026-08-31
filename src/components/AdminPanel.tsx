import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { UserProfile } from "../types";
import { AdminUsageSummary, getAdminUsageSummary } from "../services/access";
import {
  getPlanCycle,
  isCurrentPlanCycle,
  PLAN_EXPORT_LIMITS,
} from "../services/plans";
import {
  ArrowLeft,
  Shield,
  Search,
  User as UserIcon,
  Video,
  Calendar,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Send,
  Radio,
} from "lucide-react";

interface AdminPanelProps {
  onBack: () => void;
  currentUserId: string;
}

export function AdminPanel({ onBack, currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [usageSummary, setUsageSummary] = useState<AdminUsageSummary | null>(null);

  // Temporary edit states per user ID
  const [editStates, setEditStates] = useState<{
    [userId: string]: {
      role: 'free' | 'premium' | 'pack10' | 'admin';
      videosCreated: number;
      quotaUsed: number;
      premiumUntil: string;
    };
  }>({});

  // Broadcast State
  const [broadcastText, setBroadcastText] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);

  const handleSendBroadcast = async () => {
    if (!broadcastText.trim()) {
      setStatusMessage({ type: "error", text: "Xabar matnini kiriting!" });
      return;
    }
    if (!confirm("Rostdan ham barcha bot foydalanuvchilariga ushbu xabarni yubormoqchimisiz?")) {
      return;
    }

    setIsBroadcasting(true);
    setBroadcastResult(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Avtorizatsiya talab qilinadi");
      const token = await user.getIdToken();

      const res = await fetch("/api/telegram?action=broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: broadcastText.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik yuz berdi");

      setBroadcastResult({ total: data.total, sent: data.sent, failed: data.failed });
      setStatusMessage({
        type: "success",
        text: `Xabar muvaffaqiyatli tarqatildi! (${data.sent}/${data.total} ta yetkazildi)`,
      });
      setBroadcastText("");
    } catch (err: any) {
      console.error("Broadcast error:", err);
      setStatusMessage({ type: "error", text: err.message || "Xabar tarqatishda xatolik yuz berdi" });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const fetchedUsers: UserProfile[] = [];
      const initialEditStates: typeof editStates = {};

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const role = (data.role || "free") as UserProfile["role"];
        const videosCreated = Number(data.videosCreated) || 0;
        const quotaCycle = typeof data.quotaCycle === "string" ? data.quotaCycle : null;
        const quotaLimit = role === "admin" ? null : PLAN_EXPORT_LIMITS[role];
        const legacyQuotaUsed = role === "premium" || role === "admin"
          ? 0
          : Math.min(videosCreated, quotaLimit || 0);
        const user: UserProfile = {
          uid: docSnap.id,
          email: data.email || null,
          role,
          videosCreated,
          premiumUntil: data.premiumUntil || null,
          quotaCycle,
          quotaUsed: isCurrentPlanCycle(role, quotaCycle) && Number.isFinite(data.quotaUsed)
            ? data.quotaUsed
            : legacyQuotaUsed,
          quotaLimit,
        };
        fetchedUsers.push(user);

        // Format premiumUntil to YYYY-MM-DD for date input
        let dateStr = "";
        if (data.premiumUntil) {
          try {
            dateStr = new Date(data.premiumUntil).toISOString().split("T")[0];
          } catch (e) {
            console.error("Invalid date:", data.premiumUntil);
          }
        }

        initialEditStates[docSnap.id] = {
          role: user.role,
          videosCreated: user.videosCreated,
          quotaUsed: user.quotaUsed,
          premiumUntil: dateStr,
        };
      });

      setUsers(fetchedUsers);
      setEditStates(initialEditStates);
      getAdminUsageSummary()
        .then(setUsageSummary)
        .catch((summaryError) => console.error("Usage summary yuklanmadi:", summaryError));
    } catch (err) {
      console.error("Foydalanuvchilarni yuklashda xatolik:", err);
      showStatus("error", "Foydalanuvchilar ro'yxatini yuklab bo'lmadi. Firestore qoidalarini tekshiring.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showStatus = (type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleFieldChange = (userId: string, field: string, value: any) => {
    setEditStates((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const handleSaveUser = async (userId: string) => {
    const state = editStates[userId];
    if (!state) return;

    setUpdatingUserId(userId);
    try {
      const userRef = doc(db, "users", userId);
      const original = users.find((user) => user.uid === userId);
      const roleChanged = original?.role !== state.role;
      const updateData: any = {
        role: state.role,
        videosCreated: Number(state.videosCreated),
        quotaUsed: Math.max(0, Number(state.quotaUsed) || 0),
        quotaLimit: state.role === "admin" ? null : PLAN_EXPORT_LIMITS[state.role],
      };

      if (state.role === "premium") {
        // If premium is selected, save the date. Default to 30 days from now if empty.
        if (state.premiumUntil) {
          updateData.premiumUntil = new Date(state.premiumUntil).toISOString();
        } else {
          const defaultDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          updateData.premiumUntil = defaultDate;
          handleFieldChange(userId, "premiumUntil", defaultDate.split("T")[0]);
        }
      } else {
        // Clear premium until date for other roles
        updateData.premiumUntil = null;
        handleFieldChange(userId, "premiumUntil", "");
      }

      const monthlyCycleChanged = state.role === "premium" &&
        !isCurrentPlanCycle(state.role, original?.quotaCycle);
      if (roleChanged || monthlyCycleChanged) {
        updateData.quotaUsed = 0;
        updateData.quotaCycle = state.role === "pack10"
          ? `pack10:${Date.now()}`
          : getPlanCycle(state.role);
        handleFieldChange(userId, "quotaUsed", 0);
      } else if (!original?.quotaCycle) {
        updateData.quotaCycle = getPlanCycle(state.role);
      } else {
        updateData.quotaCycle = original.quotaCycle;
      }

      await updateDoc(userRef, updateData);
      
      // Update local state users list
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === userId
            ? {
                ...u,
                role: state.role,
                videosCreated: Number(state.videosCreated),
                premiumUntil: updateData.premiumUntil,
                quotaCycle: updateData.quotaCycle,
                quotaUsed: updateData.quotaUsed,
                quotaLimit: updateData.quotaLimit,
              }
            : u
        )
      );

      showStatus("success", "Foydalanuvchi ma'lumotlari muvaffaqiyatli saqlandi!");
    } catch (err) {
      console.error("Foydalanuvchini yangilashda xatolik:", err);
      showStatus("error", "Ma'lumotni saqlab bo'lmadi.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const setShortcut30Days = (userId: string) => {
    const date30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setEditStates((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        role: "premium",
        premiumUntil: date30Days,
      },
    }));
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const emailMatch = u.email ? u.email.toLowerCase().includes(query) : false;
    const uidMatch = u.uid.toLowerCase().includes(query);
    const roleMatch = u.role.toLowerCase().includes(query);
    return emailMatch || uidMatch || roleMatch;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 pb-24 text-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 drop-shadow-sm flex items-center gap-3">
              <Shield className="text-amber-400" size={32} />
              Admin Boshqaruv Paneli
            </h1>
            <p className="text-neutral-400 text-sm font-medium mt-1">
              To'lov qilgan foydalanuvchilarning tariflari va ruxsatlarini boshqarish oynasi
            </p>
          </div>
        </div>
        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white px-5 py-3 rounded-2xl font-semibold transition-all hover:scale-102 cursor-pointer shadow-sm text-sm animate-pulse"
        >
          Yangilash
        </button>
      </div>

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          {statusMessage.type === "success" ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-semibold">{statusMessage.text}</span>
        </div>
      )}

      {usageSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Oylik eksport</p>
            <p className="mt-1 text-2xl font-black text-white">{usageSummary.successfulExports}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">O'rtacha / foydalanuvchi</p>
            <p className="mt-1 text-2xl font-black text-cyan-400">
              {usageSummary.averageExportsPerUser.toFixed(1)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Savol AI</p>
            <p className="mt-1 text-2xl font-black text-violet-400">
              ${usageSummary.questionAiCostUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-neutral-500">{usageSummary.generatedQuestions} savol</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Ovoz AI</p>
            <p className="mt-1 text-2xl font-black text-cyan-400">
              ${usageSummary.voiceAiCostUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-neutral-500">{usageSummary.ttsCharacters} belgi</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Rasm</p>
            <p className="mt-1 text-2xl font-black text-emerald-400">
              ${usageSummary.imageAiCostUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-neutral-500">{usageSummary.imageLookups} rasm</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Brauzer render</p>
            <p className="mt-1 text-2xl font-black text-white">
              ${usageSummary.browserRenderCostUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-neutral-500">Server ishlatilmaydi</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Server storage</p>
            <p className="mt-1 text-2xl font-black text-white">
              ${usageSummary.serverStorageCostUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-neutral-500">Video saqlanmaydi</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">Jami / eksport</p>
            <p className="mt-1 text-2xl font-black text-amber-400">
              ${usageSummary.estimatedTotalCostPerExportUsd.toFixed(4)}
            </p>
            <p className="text-[10px] text-neutral-500">
              Xatolar: {usageSummary.failedExports}
            </p>
          </div>
        </div>
      )}

      {/* 📢 Telegram Broadcast (Ommaviy Xabar Tarqatish) Card */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 mb-8 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                Telegram Ommaviy Xabar Tarqatish (Broadcast)
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold uppercase">
                  Admin Tool
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Barcha bot foydalanuvchilariga bir vaqtning o'zida e'lon, aksiya yoki yangilik yuborish
              </p>
            </div>
          </div>

          <div className="text-xs text-slate-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl font-mono">
            Bot orqali: <code className="text-amber-300">/send &lt;xabar&gt;</code>
          </div>
        </div>

        <div className="space-y-3">
          <textarea
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            disabled={isBroadcasting}
            rows={3}
            placeholder="Xabar matnini yozing... (HTML teglarini qo'llab-quvvatlaydi: <b>qalin</b>, <i>kursiv</i>, <code>kod</code>)"
            className="w-full bg-slate-950/80 border border-white/10 focus:border-indigo-500/60 rounded-2xl p-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans leading-relaxed"
          />

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-400">
              {broadcastResult && (
                <span className="text-emerald-400 font-semibold">
                  Oxirgi natija: {broadcastResult.sent}/{broadcastResult.total} ta yetkazildi ({broadcastResult.failed} ta bloklagan).
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleSendBroadcast}
              disabled={isBroadcasting || !broadcastText.trim()}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/30 flex items-center gap-2 cursor-pointer active:scale-98"
            >
              {isBroadcasting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Yuborilmoqda...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Barchaga Yuborish
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-8 shadow-xl flex items-center gap-4">
        <Search className="text-neutral-400 shrink-0" size={22} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Email, UID yoki tarif bo'yicha qidirish..."
          className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder:text-neutral-500 font-medium"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="text-neutral-500 hover:text-white text-xs font-bold underline transition-colors"
          >
            Tozalash
          </button>
        )}
      </div>

      {/* Users List Container */}
      <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-4">
            <Loader2 className="animate-spin text-amber-500" size={48} />
            <span className="font-semibold text-lg animate-pulse">Ma'lumotlar yuklanmoqda...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-neutral-500">
            <UserIcon className="mx-auto text-neutral-600 mb-4" size={48} />
            <span className="font-semibold text-lg">Hech qanday foydalanuvchi topilmadi</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold text-neutral-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Foydalanuvchi</th>
                  <th className="py-4 px-6">Tarif (Rol)</th>
                  <th className="py-4 px-6 text-center">Sikl / jami eksport</th>
                  <th className="py-4 px-6">Premium Muddati</th>
                  <th className="py-4 px-6 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => {
                  const state = editStates[u.uid] || {
                    role: u.role,
                    videosCreated: u.videosCreated,
                    quotaUsed: u.quotaUsed,
                    premiumUntil: "",
                  };
                  const isCurrent = u.uid === currentUserId;

                  return (
                    <tr
                      key={u.uid}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isCurrent ? "bg-amber-500/[0.03]" : ""
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <span className="text-white font-semibold flex items-center gap-1.5">
                            {u.email || "Anonim (Mehmon)"}
                            {isCurrent && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase font-black tracking-widest">
                                Siz
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono mt-1 select-all">{u.uid}</span>
                        </div>
                      </td>

                      {/* Role selection dropdown */}
                      <td className="py-4 px-6">
                        <select
                          value={state.role}
                          onChange={(e) => handleFieldChange(u.uid, "role", e.target.value as any)}
                          className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50 cursor-pointer"
                        >
                          <option value="free">Bepul (free)</option>
                          <option value="premium">Premium (premium)</option>
                          <option value="pack10">Paket (pack10)</option>
                          <option value="admin">Admin (admin)</option>
                        </select>
                      </td>

                      {/* Videos Created input */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-2">
                            <Video size={14} className="text-neutral-500" />
                            <input
                              type="number"
                              min="0"
                              value={state.quotaUsed}
                              onChange={(e) => handleFieldChange(u.uid, "quotaUsed", parseInt(e.target.value) || 0)}
                              className="w-16 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-center text-sm font-mono text-white focus:outline-none focus:border-amber-500/50"
                              title="Joriy tarif siklida ishlatilgan eksportlar"
                            />
                            <span className="text-xs text-neutral-500">
                              / {state.role === "admin" ? "∞" : PLAN_EXPORT_LIMITS[state.role]}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                            <span>Jami:</span>
                            <input
                              type="number"
                              min="0"
                              value={state.videosCreated}
                              onChange={(e) => handleFieldChange(u.uid, "videosCreated", parseInt(e.target.value) || 0)}
                              className="w-12 bg-transparent text-center font-mono text-neutral-400 focus:outline-none"
                              title="Muvaffaqiyatli eksportlarning jami soni"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Premium Until date picker */}
                      <td className="py-4 px-6">
                        {state.role === "premium" ? (
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-neutral-500" />
                            <input
                              type="date"
                              value={state.premiumUntil}
                              onChange={(e) => handleFieldChange(u.uid, "premiumUntil", e.target.value)}
                              className="bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 cursor-pointer font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => setShortcut30Days(u.uid)}
                              className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-2 py-1 rounded text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                            >
                              +30 Kun
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-500 italic">Mavjud emas</span>
                        )}
                      </td>

                      {/* Save Action */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleSaveUser(u.uid)}
                          disabled={updatingUserId === u.uid}
                          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          {updatingUserId === u.uid ? (
                            <Loader2 className="animate-spin" size={14} />
                          ) : (
                            <Save size={14} />
                          )}
                          Saqlash
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
