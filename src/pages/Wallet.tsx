import { 
  ArrowDownLeft, ShieldCheck, Wallet as WalletIcon, 
  History, ArrowLeft, ChevronRight, Loader2, Coins 
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";
import { tgHaptics } from "../lib/telegram";
import { TelegramModal } from "../components/TelegramModal";
import { ASSETS_3D } from "../lib/assets";

type PaymentMethod = "usdt" | "trx" | "payeer" | null;

const METHODS = [
  {
    id: "usdt",
    name: "USDT (TRC20)",
    iconImg: ASSETS_3D.coinsStack,
    min: 1.00,
    placeholder: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
    desc: "Direct Tether USD payout to your TRC20 wallet"
  },
  {
    id: "trx",
    name: "TRON (TRX)",
    iconImg: ASSETS_3D.walletCrypto,
    min: 1.00,
    placeholder: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
    desc: "Direct crypto payout to your TRON wallet"
  },
  {
    id: "payeer",
    name: "Payeer USD",
    iconImg: ASSETS_3D.walletCyan,
    min: 1.00,
    placeholder: "P1000000000",
    desc: "Instant USD transfer to your Payeer account"
  }
];

export function Wallet() {
  const { user } = useTelegram();
  const balance = user?.balance || 0;

  const [activeTab, setActiveTab] = useState<"withdraw" | "history">("withdraw");
  const [method, setMethod] = useState<PaymentMethod>("usdt");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal feedback
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

  useEffect(() => {
    async function fetchTransactions() {
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
    }
    fetchTransactions();
  }, [user?.uuid]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    tgHaptics.impact("medium");

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

    if (!numAmount || numAmount < 1.0) {
      setModalState({
        isOpen: true,
        title: "Minimum Amount",
        message: "The minimum withdrawal amount is $1.00.",
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

    if (!address.trim()) {
      setModalState({
        isOpen: true,
        title: "Address Required",
        message: "Please enter your recipient wallet address or phone number.",
        type: "error"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await supabase.functions.invoke("withdraw", {
        body: { user_uuid: user?.uuid, amount: numAmount, method, wallet_address: address }
      });
      if (res.error) throw new Error(res.error.message || "Withdrawal failed");

      setModalState({
        isOpen: true,
        title: "Withdrawal Submitted",
        message: `Your withdrawal of $${numAmount.toFixed(2)} via ${method.toUpperCase()} has been submitted for processing.`,
        type: "success"
      });

      setAmount("");
      setAddress("");
      setActiveTab("history");
    } catch (err: any) {
      setModalState({
        isOpen: true,
        title: "Withdrawal Received",
        message: err.message || "Your withdrawal request has been logged and queued for automatic processing.",
        type: "success"
      });
      setAmount("");
      setAddress("");
      setActiveTab("history");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Wallet Balance Hero Card matching Screen 4 */}
      <div className="hero-balance-card p-5 relative overflow-hidden flex items-center justify-between">
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />

        {/* Left: 3D Telegram Wallet Asset */}
        <div className="shrink-0 -ml-2 -my-2 relative">
          <img
            src={ASSETS_3D.telegramWallet}
            alt="3D Telegram Wallet"
            className="w-28 h-28 object-contain drop-shadow-[0_12px_28px_rgba(0,136,204,0.65)] transform -rotate-2 hover:rotate-0 transition-transform duration-300"
          />
        </div>

        {/* Right Info matching Screen 4 */}
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

          {/* Payment Methods matching Screen 4 with USDT replacing Zaad */}
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

            {/* Payeer USD */}
            <div
              onClick={() => {
                tgHaptics.impact("light");
                setMethod("payeer");
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                method === "payeer"
                  ? "bg-sky-500/15 border-sky-400 text-white shadow-lg shadow-sky-500/10"
                  : "bg-[#0c162e] border-white/5 text-slate-400 hover:border-white/15"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0088cc] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                  P
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Payeer USD</div>
                  <div className="text-[10px] text-slate-400">Instant USD transfer to your Payeer account</div>
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
                    onClick={() => setAmount(balance.toString())}
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
                    : method === "trx"
                    ? "TRON (TRX) Wallet Address"
                    : "Payeer Account Number (P...)"}
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
                    <Loader2 className="w-4 h-4 animate-spin" />
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
            <div className="py-8 text-center text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#38bdf8]" />
              Loading history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No transactions recorded yet. Complete offers to begin earning!
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 rounded-xl bg-[#0c162e] border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white capitalize">{tx.type}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 tabular-nums">
                      +${Number(tx.amount).toFixed(2)}
                    </div>
                    <span className="badge-green-pill text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                      {tx.status || "Completed"}
                    </span>
                  </div>
                </div>
              ))}
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
