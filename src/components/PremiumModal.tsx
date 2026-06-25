import React, { useState } from "react";
import { X, Crown, Check, CreditCard, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { upgradeUserToPremium } from "../services/firebase";
import { User } from "firebase/auth";

interface PremiumModalProps {
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}

export function PremiumModal({ onClose, onSuccess, user }: PremiumModalProps) {
  const [paymentStep, setPaymentStep] = useState<"plans" | "processing" | "success">("plans");
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);

  const handlePayment = async (gateway: string) => {
    if (!user) return;
    setSelectedGateway(gateway);
    setPaymentStep("processing");

    // Simulate payment gateway response delay
    setTimeout(async () => {
      try {
        await upgradeUserToPremium(user.uid);
        setPaymentStep("success");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } catch (err) {
        console.error(err);
        alert("To'lovni tasdiqlashda xatolik yuz berdi. Iltimos qaytadan urining.");
        setPaymentStep("plans");
      }
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={paymentStep !== "processing" ? onClose : undefined}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      {/* Modal Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-lg rounded-3xl p-6 md:p-8 relative z-10 overflow-hidden shadow-2xl border border-amber-500/20"
      >
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

        {paymentStep !== "processing" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        )}

        <AnimatePresence mode="wait">
          {paymentStep === "plans" && (
            <motion.div
              key="plans"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center"
            >
              {/* Header Icon */}
              <div className="bg-gradient-to-r from-amber-500 to-yellow-400 p-4 rounded-2xl text-black shadow-lg shadow-amber-500/20 mb-4 animate-bounce">
                <Crown size={32} />
              </div>

              <h2 className="text-3xl font-display font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300 mb-2">
                Premium versiyaga o'ting
              </h2>
              <p className="text-neutral-400 text-sm text-center mb-6 max-w-xs">
                Cheklovlardan xalos bo'ling va loyihalaringizni professional darajaga olib chiqing
              </p>

              {/* Benefits list */}
              <div className="w-full space-y-3.5 mb-8 bg-white/5 border border-white/5 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 text-emerald-400 p-0.5 rounded-full mt-0.5">
                    <Check size={16} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">Cheksiz AI Test Generation</p>
                    <p className="text-neutral-400 text-xs">Istagan mavzuda AI orqali testlarni cheksiz generatsiya qiling</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 text-emerald-400 p-0.5 rounded-full mt-0.5">
                    <Check size={16} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">Cheksiz Video Eksport</p>
                    <p className="text-neutral-400 text-xs">Hech qanday cheklovlarsiz va suv belgisiz (watermark) yuqori sifatli video yuklang</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-500/20 text-emerald-400 p-0.5 rounded-full mt-0.5">
                    <Check size={16} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">Bulutli Saqlash va Sinxronizatsiya</p>
                    <p className="text-neutral-400 text-xs">Test shablonlaringizni bulutda saqlang va boshqa qurilmalarda yuklang</p>
                  </div>
                </div>
              </div>

              {/* Price and Action */}
              <div className="w-full text-center mb-6 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-2xl py-4 px-6 flex justify-between items-center">
                <span className="text-neutral-300 text-sm font-medium">Bir martalik umrbod to'lov:</span>
                <span className="text-amber-400 font-display font-black text-2xl">99,000 UZS</span>
              </div>

              <p className="text-neutral-400 text-xs mb-3 font-semibold uppercase tracking-wider">To'lov usulini tanlang</p>
              
              {/* Payment Gateways Grid */}
              <div className="grid grid-cols-3 gap-3 w-full">
                <button
                  onClick={() => handlePayment("Click")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <span className="text-cyan-400 font-black tracking-wider text-lg group-hover:scale-105 transition-all">CLICK</span>
                  <span className="text-[10px] text-neutral-400 mt-1">Milliy to'lov</span>
                </button>
                <button
                  onClick={() => handlePayment("Payme")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <span className="text-teal-400 font-bold tracking-tight text-lg group-hover:scale-105 transition-all">payme</span>
                  <span className="text-[10px] text-neutral-400 mt-1">Tezkor to'lov</span>
                </button>
                <button
                  onClick={() => handlePayment("Stripe")}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-1 text-indigo-400 font-bold text-lg group-hover:scale-105 transition-all">
                    <CreditCard size={18} />
                    <span>Card</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1">Visa / Master</span>
                </button>
              </div>
            </motion.div>
          )}

          {paymentStep === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="relative mb-6">
                <Loader2 size={64} className="animate-spin text-amber-500" />
                <Crown size={24} className="text-amber-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h3 className="text-2xl font-bold mb-2">To'lov tekshirilmoqda...</h3>
              <p className="text-neutral-400 text-sm max-w-xs">
                {selectedGateway} orqali yuborilgan tranzaksiya tasdiqlanishini kutyapmiz. Iltimos oynani yopmang.
              </p>
            </motion.div>
          )}

          {paymentStep === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-full border border-emerald-500/20 mb-6 animate-pulse">
                <ShieldCheck size={48} />
              </div>
              <h3 className="text-2xl font-bold text-emerald-400 mb-2">To'lov muvaffaqiyatli amalga oshdi!</h3>
              <p className="text-neutral-300 text-sm max-w-xs mb-4">
                Tabriklaymiz, sizning hisobingiz **Premium** darajasiga ko'tarildi!
              </p>
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                <Sparkles size={14} />
                <span>Barcha cheklovlar olib tashlandi</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
