import React, { useState, useEffect } from "react";
import { 
  Users, 
  Crown, 
  Settings, 
  Database, 
  Trash2, 
  ArrowLeft, 
  Loader2, 
  Search, 
  RefreshCw, 
  Shield, 
  DollarSign, 
  FileText 
} from "lucide-react";
import { motion } from "motion/react";
import { 
  getAllUsersAdmin, 
  updateUserProfileAdmin, 
  getAllSavedQuizzesAdmin, 
  deleteQuizFromCloud, 
  UserProfile, 
  AdminSavedQuiz 
} from "../services/firebase";

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [quizzes, setQuizzes] = useState<AdminSavedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"users" | "quizzes">("users");

  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    totalQuizzes: 0,
    simulatedEarnings: 0
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const allUsers = await getAllUsersAdmin();
      const allQuizzes = await getAllSavedQuizzesAdmin();
      
      setUsers(allUsers);
      setQuizzes(allQuizzes);
      
      const premiumCount = allUsers.filter(u => u.isPremium).length;
      
      setStats({
        totalUsers: allUsers.length,
        premiumUsers: premiumCount,
        totalQuizzes: allQuizzes.length,
        simulatedEarnings: premiumCount * 99000
      });
    } catch (err) {
      console.error("Failed to load admin data:", err);
      alert("Ma'lumotlarni yuklashda xatolik yuz berdi. Firestore rules (qoidalar)ni tekshiring.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTogglePremium = async (userId: string, currentStatus: boolean) => {
    try {
      await updateUserProfileAdmin(userId, { isPremium: !currentStatus });
      
      // Update local state instantly
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isPremium: !currentStatus } : u));
      
      // Update stats
      setStats(prev => {
        const nextPremiumCount = prev.premiumUsers + (currentStatus ? -1 : 1);
        return {
          ...prev,
          premiumUsers: nextPremiumCount,
          simulatedEarnings: nextPremiumCount * 99000
        };
      });
    } catch (err) {
      console.error(err);
      alert("Foydalanuvchi hisobini o'zgartirishda xatolik yuz berdi.");
    }
  };

  const handleResetUsage = async (userId: string) => {
    try {
      await updateUserProfileAdmin(userId, { usageCount: 0 });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, usageCount: 0 } : u));
      alert("Foydalanuvchining bepul urinishlari 0 ga qaytarildi.");
    } catch (err) {
      console.error(err);
      alert("Urinishlar sonini qaytarishda xatolik yuz berdi.");
    }
  };

  const handleToggleAdmin = async (userId: string, currentRole?: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    try {
      await updateUserProfileAdmin(userId, { role: newRole });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error(err);
      alert("Foydalanuvchi huquqini o'zgartirishda xatolik yuz berdi.");
    }
  };

  const handleDeleteQuizAdmin = async (quizId: string) => {
    if (!window.confirm("Haqiqatan ham ushbu test shablonini bulutdan o'chirmoqchisiz?")) return;
    try {
      await deleteQuizFromCloud(quizId);
      setQuizzes(prev => prev.filter(q => q.id !== quizId));
      setStats(prev => ({ ...prev, totalQuizzes: prev.totalQuizzes - 1 }));
    } catch (err) {
      console.error(err);
      alert("Test shablonini o'chirishda xatolik yuz berdi.");
    }
  };

  const filteredUsers = users.filter(u => 
    (u.email?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (u.uid.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredQuizzes = quizzes.filter(q =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto p-6 pb-24 text-white">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-amber-400 to-yellow-300 drop-shadow-sm flex items-center gap-2">
              <Shield className="text-amber-400" /> Admin Boshqaruv Paneli
            </h1>
            <p className="text-neutral-400 text-sm font-medium mt-1">
              Foydalanuvchilar, premium obunalar va saqlangan testlarni nazorat qilish
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Yangilash
        </button>
      </div>

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {/* Total Users */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Jami Foydalanuvchilar</p>
              <h3 className="text-3xl font-display font-black mt-2">{loading ? "..." : stats.totalUsers}</h3>
            </div>
            <div className="bg-cyan-500/10 text-cyan-400 p-3 rounded-xl">
              <Users size={24} />
            </div>
          </div>
        </div>

        {/* Premium Users */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Premium A'zolar</p>
              <h3 className="text-3xl font-display font-black mt-2 text-amber-400">
                {loading ? "..." : stats.premiumUsers}
              </h3>
            </div>
            <div className="bg-amber-500/10 text-amber-400 p-3 rounded-xl">
              <Crown size={24} className="fill-amber-400/20" />
            </div>
          </div>
        </div>

        {/* Saved Templates */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Saqlangan Shabonlar</p>
              <h3 className="text-3xl font-display font-black mt-2">{loading ? "..." : stats.totalQuizzes}</h3>
            </div>
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl">
              <Database size={24} />
            </div>
          </div>
        </div>

        {/* Simulated Revenue */}
        <div className="glass-card rounded-2xl p-5 border border-amber-500/10 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider">Simulyatsiya Daromadi</p>
              <h3 className="text-3xl font-display font-black mt-2 text-emerald-400">
                {loading ? "..." : `${stats.simulatedEarnings.toLocaleString()} UZS`}
              </h3>
            </div>
            <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
        {/* Navigation Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "users" 
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md shadow-amber-500/10" 
                : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
            }`}
          >
            Foydalanuvchilar ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("quizzes")}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "quizzes" 
                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md shadow-amber-500/10" 
                : "bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
            }`}
          >
            Bulutdagi Testlar ({quizzes.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:max-w-xs">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={activeTab === "users" ? "Email yoki ID bo'yicha qidirish..." : "Test mavzusi yoki UID bo'yicha qidirish..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 focus:border-amber-500/40 outline-none rounded-xl pl-10 pr-4 py-2.5 text-sm transition-colors placeholder:text-neutral-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 size={48} className="animate-spin text-amber-400 mb-4" />
          <p className="text-neutral-400 text-sm">Ma'lumotlar yuklanmoqda...</p>
        </div>
      ) : activeTab === "users" ? (
        /* Users Table Dashboard */
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-xs font-bold uppercase tracking-wider text-neutral-400">
                  <th className="py-4 px-6">Email / UID</th>
                  <th className="py-4 px-6 text-center">Foydalanish (Free)</th>
                  <th className="py-4 px-6">Huquqi</th>
                  <th className="py-4 px-6">Premium Status</th>
                  <th className="py-4 px-6 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-neutral-500">
                      Hech qanday foydalanuvchi topilmadi.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex flex-col max-w-[280px]">
                          <span className="font-semibold text-white truncate" title={u.email}>{u.email}</span>
                          <span className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate">{u.uid}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg font-mono">
                          {u.usageCount} ta so'rov
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {u.role === "admin" ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-400/10 px-2.5 py-1 rounded-full border border-red-400/20 max-w-max">
                            <Shield size={12} /> Admin
                          </span>
                        ) : (
                          <span className="text-neutral-400 text-xs">Foydalanuvchi</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {u.isPremium ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/20 max-w-max">
                            <Crown size={12} className="fill-amber-400" /> Premium
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full max-w-max">
                            Bepul Versiya
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleTogglePremium(u.uid, u.isPremium)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                              u.isPremium 
                                ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400" 
                                : "bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400"
                            }`}
                          >
                            {u.isPremium ? "Premium Bekor qilish" : "Premium Berish"}
                          </button>
                          <button
                            onClick={() => handleResetUsage(u.uid)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all active:scale-95"
                            title="Bepul limitni 0 ga qaytarish"
                          >
                            Limitni tozalash
                          </button>
                          <button
                            onClick={() => handleToggleAdmin(u.uid, u.role)}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 p-1.5 rounded-lg cursor-pointer transition-all"
                            title={u.role === "admin" ? "Adminlikni bekor qilish" : "Admin qilish"}
                          >
                            <Shield size={14} className={u.role === "admin" ? "text-red-400" : "text-neutral-400"} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cloud Quizzes List Dashboard */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredQuizzes.length === 0 ? (
            <div className="col-span-2 text-center py-20 text-neutral-500 bg-white/5 rounded-3xl border border-white/5">
              Hech qanday test shablonlari topilmadi.
            </div>
          ) : (
            filteredQuizzes.map((q) => (
              <div 
                key={q.id} 
                className="glass-card rounded-2xl p-5 border border-white/5 flex justify-between items-start gap-4 hover:border-white/10 transition-all duration-300 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className="text-cyan-400" />
                    <span className="text-xs text-neutral-400">ID: {q.id}</span>
                  </div>
                  <h4 className="font-bold text-white text-lg truncate mb-1" title={q.title}>
                    {q.title}
                  </h4>
                  <p className="text-xs text-neutral-400 truncate">
                    Yaratuvchi: <span className="font-mono text-neutral-300">{q.userId}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteQuizAdmin(q.id)}
                  className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 p-2.5 rounded-xl border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                  title="Bulutdan o'chirish"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
