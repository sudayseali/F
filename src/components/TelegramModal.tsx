import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { tgHaptics } from "../lib/telegram";

export interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: "info" | "error" | "success";
  actionText?: string;
  onAction?: () => void;
  secondaryText?: string;
  onSecondary?: () => void;
}

export function TelegramModal({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  actionText = "OK",
  onAction,
  secondaryText,
  onSecondary,
}: TelegramModalProps) {
  if (!isOpen) return null;

  const handleAction = () => {
    tgHaptics.impact("medium");
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  const handleSecondary = () => {
    tgHaptics.impact("light");
    if (onSecondary) {
      onSecondary();
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            tgHaptics.impact("light");
            onClose();
          }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Sheet */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm rounded-2xl bg-[#17212b] border border-white/10 p-5 shadow-2xl text-center z-10 overflow-hidden"
        >
          {/* Top drag handle indicator for mobile sheet feel */}
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

          {/* Icon */}
          <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-white/5 border border-white/10">
            {type === "error" && <AlertCircle className="w-6 h-6 text-rose-400" />}
            {type === "success" && <CheckCircle className="w-6 h-6 text-emerald-400" />}
            {type === "info" && <Info className="w-6 h-6 text-[#2481cc]" />}
          </div>

          {/* Title & Message */}
          <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
          <p className="text-xs text-[#7e8c9b] leading-relaxed mb-5 px-2">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex gap-2">
            {secondaryText && (
              <button
                type="button"
                onClick={handleSecondary}
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-semibold transition active:scale-95"
              >
                {secondaryText}
              </button>
            )}
            <button
              type="button"
              onClick={handleAction}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#2481cc] hover:bg-[#1a6cb3] text-white text-xs font-semibold shadow-md shadow-[#2481cc]/25 transition active:scale-95"
            >
              {actionText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
