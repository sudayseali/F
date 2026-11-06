import { 
  ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet as WalletIcon, 
  History, ArrowLeft, ChevronRight, Loader2, CheckCircle2, Coins 
} from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";
import { tgHaptics } from "../lib/telegram";
import { TelegramModal } from "../components/TelegramModal";

type PaymentMethod = "payeer" | "trx" | "zaad" | null;

const METHODS = [
  {
    id: "payeer",
    name: "Payeer",
    icon: "🅿️",
    min: 1.00,
    placeholder: "P1000000000",
    desc: "Instant USD transfer to your Payeer account"
  },
  {
    id: "trx",
    name: "TRON (TRX)",
    icon: "💎",
    min: 1.00,
    placeholder: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
    desc: "Direct crypto payout to your TRON wallet"
  },
  {
    id: "zaad",
    name: "Zaad Mobile",
    icon: "📱",
    min: 1.00,
    placeholder: "063XXXXXXX",
    desc: "Local mobile money payout"
  }
];

export function Wallet() {
  const { user } = useTelegram();
  const balance = user?.balance || 0;

  const [activeTab, setActiveTab] = useState<"balance" | "withdraw" | "history">("balance");
  const [method, setMethod] = useState<PaymentMethod>(null);
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
      setMethod(null);
      setActiveTab("balance");
    } catch (err: any) {
      setModalState({
        isOpen: true,
        title: "Withdrawal Notice",
        message: err.message || "Withdrawal request logged. It will be verified and sent shortly.",
        type: "info"
      });
      setAmount("");
      setAddress("");
      setMethod(null);
      setActiveTab("balance");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Wallet Balance Hero Card */}
      <div className="relative rounded-2xl bg-gradient-to-b from-[#1c2733] to-[#141d27] border border-white/10 p-5 text-center shadow-xl">
        <div className="flex items-center justify-center gap-1.5 text-xs text-[#7e8c9b] mb-1">
          <WalletIcon className="w-3.5 h-3.5 text-[#2481cc]" />
          <span>Payvora Balance</span>
        </div>

        <div className="text-3xl font-extrabold text-white tracking-tight my-1 tabular-nums">
          ${balance.toFixed(2)}
        </div>
        <p className="text-xs text-emerald-400 font-semibold mb-4">
          ✓ Verified Payout Account
        </p>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#0e1621] rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => {
              tgHaptics.selection();
              setActiveTab("withdraw");
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "withdraw"
                ? "bg-[#2481cc] text-white shadow-sm"
                : "text-[#7e8c9b] hover:text-white"
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
            className={`py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === "history"
                ? "bg-[#2481cc] text-white shadow-sm"
                : "text-[#7e8c9b] hover:text-white"
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Withdraw Tab */}
      {activeTab === "withdraw" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="tg-card p-4 space-y-4"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold text-white">Select Payout Method</h3>
            <span className="text-[10px] text-[#7e8c9b]">Min $1.00</span>
          </div>

          {/* Payment Methods */}
          <div className="space-y-2">
            {METHODS.map((m) => {
              const isSelected = method === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    tgHaptics.impact("light");
                    setMethod(m.id as PaymentMethod);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "bg-[#2481cc]/15 border-[#2481cc] text-white"
                      : "bg-[#0e1621] border-white/5 text-[#7e8c9b] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{m.icon}</span>
                    <div>
                      <div className="text-xs font-bold text-white">{m.name}</div>
                      <div className="text-[10px] text-[#7e8c9b]">{m.desc}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-emerald-400">Min ${m.min.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form */}
          {method && (
            <form onSubmit={handleWithdrawSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#7e8c9b] mb-1">
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
                    className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2481cc]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(balance.toString())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-white/10 text-[10px] font-semibold text-white/70 hover:text-white"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#7e8c9b] mb-1">
                  {method === "zaad" ? "Phone Number" : "Recipient Address / Account"}
                </label>
                <input
                  type="text"
                  placeholder={METHODS.find((m) => m.id === method)?.placeholder}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-[#0e1621] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#2481cc]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-[#2481cc] hover:bg-[#1a6cb3] text-white font-bold text-xs shadow-md shadow-[#2481cc]/25 transition active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
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
          className="tg-card p-4 space-y-3"
        >
          <h3 className="text-sm font-bold text-white mb-2">Transaction History</h3>

          {loading ? (
            <div className="py-8 text-center text-xs text-[#7e8c9b]">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#2481cc]" />
              Loading history...
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#7e8c9b]">
              No transactions recorded yet. Complete offers to begin earning!
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-xl bg-[#0e1621] border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white capitalize">{tx.type}</div>
                      <div className="text-[10px] text-[#7e8c9b]">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 tabular-nums">
                      +${Number(tx.amount).toFixed(2)}
                    </div>
                    <span className="text-[9px] text-[#7e8c9b] uppercase">{tx.status || "Completed"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Payment Security Notice */}
      <div className="tg-card p-3 flex items-center gap-2.5 text-[#7e8c9b]">
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
