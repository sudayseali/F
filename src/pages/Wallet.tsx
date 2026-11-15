import {
  ArrowDownLeft, ArrowUpRight, ShieldCheck, Wallet as WalletIcon
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase, invokeEdgeFunction } from "../lib/supabase";
import { tgHaptics } from "../lib/telegram";
import { TelegramModal } from "../components/TelegramModal";
import { PayvoraSpinner, PayvoraLoadingState } from "../components";
import { ASSETS_3D } from "../lib/assets";
import { APP_CONFIG } from "../config/appConfig";
import type { PaymentMethod } from "../types";

const METHODS = APP_CONFIG.payouts.supportedMethods;

function validateClientAddress(method: PaymentMethod, addr: string): string | null {
  const clean = addr.trim();
  if (!clean) return "Please enter your recipient wallet address.";
  if (method === "usdt" || method === "trx") {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(clean)) {
      return "Please enter a valid TRON (TRC20 / TRX) address starting with 'T' (34 characters).";
    }
  } else if (method === "usdt_bep20") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) {
      return "Please enter a valid BNB Smart Chain (BEP20) address starting with '0x' (42 characters).";
    }
  }
  return null;
}

export function Wallet() {
  const { user, refreshUser } = useTelegram();
  const balance = user?.balance || 0;

  const [activeTab, setActiveTab] = useState<"withdraw" | "history">("withdraw");
  const [method, setMethod] = useState<PaymentMethod>("usdt");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  const fetchTransactions = useCallback(async () => {
    if (!user?.uuid) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.uuid)
        .order("created_at", { ascending: false });
      if (data) setTransactions(data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.uuid]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    tgHaptics.impact("medium");

    if (!user?.uuid) {
      setModalState({
        isOpen: true,
        title: "Authentication Required",
        message: `Please launch Payvora from @${APP_CONFIG.telegram.botUsername} to submit a withdrawal.`,
        type: "error"
      });
      return;
    }

    const numAmount = parseFloat(amount);
    if (!method) {
      setModalState({
        isOpen: true,
        title: "Select Method",
        message: "Please choose a payment method to withdraw.",
        type: "error"
      });
      return;
    }

    if (!Number.isFinite(numAmount) || numAmount < APP_CONFIG.payouts.minWithdrawalUsd) {
      setModalState({
        isOpen: true,
        title: "Minimum Amount",
        message: `The minimum withdrawal amount is $${APP_CONFIG.payouts.minWithdrawalUsd.toFixed(2)}.`,
        type: "error"
      });
      return;
    }

    if (numAmount > balance) {
      setModalState({
        isOpen: true,
        title: "Insufficient Balance",
        message: `Your balance is $${balance.toFixed(2)}. Please enter a valid amount.`,
        type: "error"
      });
      return;
    }

    const addressErr = validateClientAddress(method, address);
    if (addressErr) {
      setModalState({
        isOpen: true,
        title: "Invalid Address",
        message: addressErr,
        type: "error"
      });
      return;
    }

    const cleanAddress = address.trim();
    const idempotencyKey =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `wd_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    setIsProcessing(true);
    try {
      await invokeEdgeFunction("withdraw", {
        amount: numAmount,
        method,
        wallet_address: cleanAddress,
        idempotency_key: idempotencyKey,
      });

      await Promise.all([refreshUser(), fetchTransactions()]);
      tgHaptics.notification("success");

      setModalState({
        isOpen: true,
        title: "Withdrawal Submitted!",
        message: `Your withdrawal of $${numAmount.toFixed(2)} via ${method.toUpperCase()} has been submitted and queued for review.`,
        type: "success"
      });

      setAmount("");
      setAddress("");
      setActiveTab("history");
    } catch (err: any) {
      tgHaptics.notification("error");
      setModalState({
        isOpen: true,
        title: "Withdrawal Failed",
        message: err.message || "Unable to submit withdrawal. Please verify your balance and address.",
        type: "error"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Wallet Balance Hero Card */}
      <div className="hero-balance-card p-5 relative overflow-hidden flex items-center justify-between">
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="shrink-0 -ml-2 -my-2 relative">
          <img
            src={ASSETS_3D.telegramWallet}
            alt="3D Telegram Wallet"
            className="w-28 h-28 object-contain drop-shadow-[0_12px_28px_rgba(0,136,204,0.65)] transform -rotate-2 hover:rotate-0 transition-transform duration-300"
          />
        </div>

        <div className="flex-1 pl-3 text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-white/90 mb-1 border border-white/10">
            <WalletIcon className="w-3.5 h-3.5 text-sky-200" />
            <span>Payvora Balance</span>
          </div>

          <div className="text-4xl font-black text-white tracking-tight tabular-nums my-0.5">
            ${balance.toFixed(2)}
          </div>

          <div className="flex items-center justify-end gap-1 text-xs text-emerald-400 font-bold">
            <span>✓</span>
            <span>Verified Payout Account</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-[#0c162e] rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => {
            tgHaptics.selection();
            setActiveTab("withdraw");
          }}
          className={`py-2.5 rounded-xl text-xs font-extrabold transition ${
            activeTab === "withdraw"
              ? "btn-cyan-glow text-white shadow-md shadow-sky-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Withdraw Funds
        </button>
        <button
          type="button"
          onClick={() => {
            tgHaptics.selection();
            setActiveTab("history");
          }}
          className={`py-2.5 rounded-xl text-xs font-bold transition ${
            activeTab === "history"
              ? "btn-cyan-glow text-white shadow-md shadow-sky-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          History
        </button>
      </div>

      {/* Withdraw Tab */}
      {activeTab === "withdraw" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass-dark p-4 space-y-4"
        >
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">Select Payout Method</h3>
            <span className="badge-green-pill text-[10px] font-bold px-2 py-0.5 rounded-full">Min $1.00</span>
          </div>

          <div className="space-y-2.5">
            {/* USDT (TRC20) */}
            <div
              onClick={() => {
                tgHaptics.impact("light");
                setMethod("usdt");
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                method === "usdt"
                  ? "bg-emerald-500/15 border-emerald-400 text-white shadow-lg shadow-emerald-500/10"
                  : "bg-[#0c162e] border-white/5 text-slate-400 hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#059669] via-[#10b981] to-[#26a17b] text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                  ₮
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>USDT (TRC20)</span>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md">
                      Stablecoin
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Direct Tether USD payout to your TRC20 wallet</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="badge-green-pill text-[10px] font-bold px-2 py-0.5 rounded-full">Min $1.00</span>
              </div>
            </div>

            {/* USDT (BEP20) */}
            <div
              onClick={() => {
                tgHaptics.impact("light");
                setMethod("usdt_bep20");
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                method === "usdt_bep20"
                  ? "bg-amber-500/15 border-amber-400 text-white shadow-lg shadow-amber-500/10"
                  : "bg-[#0c162e] border-white/5 text-slate-400 hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#d97706] to-[#f59e0b] text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
                  ₮
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>USDT (BEP20)</span>
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md">
                      BSC
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Direct Tether USD payout on BNB Smart Chain</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="badge-green-pill text-[10px] font-bold px-2 py-0.5 rounded-full">Min $1.00</span>
              </div>
            </div>

            {/* TRON (TRX) */}
            <div
              onClick={() => {
                tgHaptics.impact("light");
                setMethod("trx");
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                method === "trx"
                  ? "bg-sky-500/15 border-sky-400 text-white shadow-lg shadow-sky-500/10"
                  : "bg-[#0c162e] border-white/5 text-slate-400 hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#dc2626] to-[#ef4444] text-white flex items-center justify-center shadow-md shrink-0">
                  <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                    <path d="M12 2L2 19.5L12 17L22 19.5L12 2Z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-white">TRON (TRX)</div>
                  <div className="text-[10px] text-slate-400">Direct crypto payout to your TRON wallet</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="badge-green-pill text-[10px] font-bold px-2 py-0.5 rounded-full">Min $1.00</span>
              </div>
            </div>
          </div>

          {/* Form */}
          {method && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Withdrawal Amount ($)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="1.00"
                    max={balance}
                    placeholder="1.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-[#0c162e] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(balance.toFixed(2))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-sky-500/20 text-[#38bdf8] text-[10px] font-bold hover:bg-sky-500/30 active:scale-95 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {method === "usdt"
                    ? "USDT Address (TRC20)"
                    : method === "usdt_bep20"
                    ? "USDT Address (BEP20 / BSC)"
                    : "TRON (TRX) Wallet Address"}
                </label>
                <input
                  type="text"
                  placeholder={METHODS.find((m) => m.id === method)?.placeholder}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#0c162e] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400 font-mono text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-xl btn-cyan-glow text-white font-extrabold text-xs shadow-lg shadow-sky-500/30 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isProcessing ? (
                  <>
                    <PayvoraSpinner size="sm" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Request Payout</span>
                )}
              </button>
            </form>
          )}
        </motion.div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-glass-dark p-4 space-y-3"
        >
          <h3 className="text-sm font-bold text-white mb-2">Transaction History</h3>

          {loading ? (
            <PayvoraLoadingState message="Loading history..." size="md" className="py-8" />
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No transactions recorded yet. Complete offers to begin earning!
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const rawAmount = Number(tx.amount || 0);
                const isDebit =
                  rawAmount < 0 ||
                  tx.type === "withdrawal_request" ||
                  tx.type === "withdrawal";
                const absAmount = Math.abs(rawAmount).toFixed(2);
                const statusLower = String(tx.status || "completed").toLowerCase();
                const statusStyle =
                  statusLower === "pending" || statusLower === "processing"
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    : statusLower === "rejected" || statusLower === "reversed" || statusLower === "failed"
                    ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                    : "badge-green-pill";

                return (
                  <div
                    key={tx.id}
                    className="p-3 rounded-xl bg-[#0c162e] border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDebit
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {isDebit ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownLeft className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white capitalize truncate">
                          {String(tx.type || "transaction").replace(/_/g, " ")}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold tabular-nums ${
                          isDebit ? "text-amber-400" : "text-emerald-400"
                        }`}
                      >
                        {isDebit ? `-$${absAmount}` : `+$${absAmount}`}
                      </div>
                      <span className={`${statusStyle} text-[9px] font-bold px-2 py-0.5 rounded-full uppercase`}>
                        {tx.status || "Completed"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Payment Security Notice */}
      <div className="card-glass-dark p-3 flex items-center gap-2.5 text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-[11px] leading-tight">
          All payouts are verified automatically within 24 hours. Minimum payout is $1.00.
        </p>
      </div>

      <TelegramModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
}
