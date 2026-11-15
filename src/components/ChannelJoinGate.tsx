import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Users,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { ASSETS_3D } from '../lib/assets';
import { openTgLink, tgHaptics } from '../lib/telegram';

interface ChannelJoinGateProps {
  channelUrl: string;
  channelUsername: string;
  verificationError?: string | null;
  isVerifying: boolean;
  onVerify: () => void;
}

export function ChannelJoinGate({
  channelUrl,
  channelUsername,
  verificationError,
  isVerifying,
  onVerify,
}: ChannelJoinGateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [hasOpenedChannel, setHasOpenedChannel] = useState(false);
  const [imgError, setImgError] = useState(false);

  const normalizedHandle = channelUsername.replace(/^@/, '') || 'PayvoraCommunity';
  const safeChannelUrl = channelUrl || `https://t.me/${normalizedHandle}`;

  const handleJoinChannel = () => {
    tgHaptics.impact('light');
    setHasOpenedChannel(true);
    openTgLink(safeChannelUrl);
  };

  const handleVerifyClick = () => {
    if (isVerifying) return;
    tgHaptics.impact('medium');
    onVerify();
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#030712] text-[#f8fafc] flex flex-col items-center justify-center relative overflow-x-hidden px-5 py-8">
      {/* Unified Payvora Atmospheric Canvas Glows */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[380px] h-[380px] bg-sky-600/18 rounded-full blur-[110px]" />
        <div className="absolute top-[42%] right-[-40px] w-[300px] h-[300px] bg-purple-600/18 rounded-full blur-[115px]" />
        <div className="absolute bottom-[-40px] left-[-30px] w-[280px] h-[280px] bg-blue-600/15 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md flex flex-col items-center"
      >
        {/* Brand Header */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0284c7] via-[#1e40af] to-[#4c1d95] border border-white/15 shadow-[0_6px_16px_rgba(2,132,199,0.35)] flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 18V6h6.2a4.3 4.3 0 0 1 0 8.6H7"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M11 10.3h2.2a1.8 1.8 0 0 1 0 3.6H11"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-white">Pay</span>
            <span className="bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#8b5cf6] bg-clip-text text-transparent">
              vora
            </span>
          </span>
        </div>

        {/* Main Glass Gate Card */}
        <div className="w-full card-glass-dark p-6 space-y-5">
          {/* Focal Visual Showcase */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center relative"
              style={{
                background:
                  'linear-gradient(145deg, rgba(2, 132, 199, 0.22) 0%, rgba(11, 19, 41, 0.9) 55%, rgba(139, 92, 246, 0.24) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 16px 32px -10px rgba(2, 132, 199, 0.35)',
              }}
            >
              {!imgError ? (
                <img
                  src={ASSETS_3D.communityUsers}
                  alt="Payvora Official Community"
                  onError={() => setImgError(true)}
                  className="w-16 h-16 object-contain drop-shadow-[0_10px_18px_rgba(56,189,248,0.45)]"
                />
              ) : (
                <Users className="w-10 h-10 text-[#38bdf8]" />
              )}
            </div>

            <div className="space-y-1.5">
              <h1
                className="text-xl font-extrabold text-white tracking-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Join Official Channel
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                To unlock your Payvora wallet, earn rewards, and receive payout updates, join our official Telegram community first.
              </p>
            </div>
          </div>

          {/* 2-Step Clear Verification Guide */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#030712]/70 border border-white/[0.07]">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  hasOpenedChannel
                    ? 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30'
                    : 'bg-[#0284c7]/15 text-[#38bdf8] border border-[#38bdf8]/25'
                }`}
              >
                {hasOpenedChannel ? <CheckCircle2 className="w-4 h-4" /> : '1'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-100 truncate">
                  Join @{normalizedHandle}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  Tap Join below, subscribe, then return here
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#030712]/70 border border-white/[0.07]">
              <div className="w-7 h-7 rounded-lg bg-[#8b5cf6]/15 text-[#a78bfa] border border-[#8b5cf6]/25 flex items-center justify-center shrink-0 text-xs font-bold">
                2
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-100 truncate">
                  Verify Membership
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  Instant server check activates your account
                </p>
              </div>
            </div>
          </div>

          {/* Inline Verification Error Banner */}
          {verificationError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{verificationError}</span>
            </div>
          )}

          {/* Action Buttons (Touch target >= 48px) */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleJoinChannel}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.11] active:scale-[0.98] border border-sky-400/30 text-white text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#38bdf8] shrink-0" />
              <span>Join @{normalizedHandle}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={handleVerifyClick}
              disabled={isVerifying}
              className="btn-cyan-glow w-full min-h-[48px] px-4 py-3 text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Verifying membership...</span>
                </>
              ) : (
                <>
                  <span>Verify &amp; Continue</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quiet Security Footer */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
          <span>Verified server-side via Telegram Bot API</span>
        </div>
      </motion.div>
    </div>
  );
}
