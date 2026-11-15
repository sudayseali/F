import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ShieldCheck, Check } from 'lucide-react';
import { ASSETS_3D } from '../lib/assets';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

const LOADING_STAGES = [
  { at: 0, step: 0, msg: 'Connecting to Telegram' },
  { at: 34, step: 1, msg: 'Verifying cryptographic session' },
  { at: 70, step: 2, msg: 'Syncing Payvora wallet' },
  { at: 96, step: 3, msg: 'Ready' },
];

const MILESTONES = [
  { label: 'Telegram', threshold: 25 },
  { label: 'Security', threshold: 65 },
  { label: 'Wallet', threshold: 95 },
];

export function SplashScreen({ onComplete, minDuration = 2200 }: SplashScreenProps) {
  const prefersReducedMotion = useReducedMotion();
  const [progress, setProgress] = useState<number>(8);
  const [statusMessage, setStatusMessage] = useState<string>(LOADING_STAGES[0].msg);
  const [imgError, setImgError] = useState<boolean>(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#030712');
        tg.setBackgroundColor?.('#030712');
      }
    } catch {
      // Safe fallback outside Telegram
    }

    const startTime = Date.now();
    let hapticHalfFired = false;
    let hapticDoneFired = false;
    let completionTimeout: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const linear = Math.min(1, elapsed / minDuration);
      const easedPct = Math.min(
        100,
        Math.max(8, Math.round((1 - Math.pow(1 - linear, 2.15)) * 100))
      );

      setProgress(easedPct);
      const stage = [...LOADING_STAGES].reverse().find((s) => easedPct >= s.at);
      if (stage) setStatusMessage(stage.msg);

      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.HapticFeedback) {
          if (!hapticHalfFired && easedPct >= 50) {
            hapticHalfFired = true;
            tg.HapticFeedback.impactOccurred('light');
          }
          if (!hapticDoneFired && easedPct >= 100) {
            hapticDoneFired = true;
            tg.HapticFeedback.notificationOccurred('success');
          }
        }
      } catch {
        // Ignore haptic errors
      }

      if (elapsed >= minDuration) {
        clearInterval(interval);
        setProgress(100);
        setStatusMessage(LOADING_STAGES[LOADING_STAGES.length - 1].msg);
        completionTimeout = setTimeout(() => {
          onCompleteRef.current?.();
        }, 240);
      }
    }, 32);

    return () => {
      clearInterval(interval);
      if (completionTimeout) clearTimeout(completionTimeout);
    };
  }, [minDuration]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.015 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#030712] text-[#f8fafc] flex flex-col items-center justify-center overflow-hidden select-none touch-none"
    >
      {/* Unified Payvora Atmospheric Canvas Glows (matches Layout.tsx) */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[380px] h-[380px] bg-sky-600/18 rounded-full blur-[110px]" />
        <div className="absolute top-[38%] right-[-40px] w-[320px] h-[320px] bg-purple-600/18 rounded-full blur-[115px]" />
        <div className="absolute bottom-[-40px] left-[-30px] w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[100px]" />
      </div>

      {/* Main Mobile-First Container (matches max-w-md shell) */}
      <div className="relative z-10 w-full max-w-md h-full flex flex-col justify-between items-center px-6 pt-9 pb-7">
        {/* 1. BRAND LOCKUP */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center"
        >
          {/* Crisp Vector Brand Monogram + Wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0284c7] via-[#1e40af] to-[#4c1d95] border border-white/15 shadow-[0_8px_20px_rgba(2,132,199,0.4)] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
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

            <h1
              className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="text-white">Pay</span>
              <span className="bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#8b5cf6] bg-clip-text text-transparent">
                vora
              </span>
            </h1>
          </div>

          <p className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-slate-400">
            <span>Earn</span>
            <span aria-hidden="true" className="text-sky-400/70">·</span>
            <span>Play</span>
            <span aria-hidden="true" className="text-purple-400/70">·</span>
            <span>Withdraw</span>
          </p>
        </motion.div>

        {/* 2. FOCAL HERO: Signature Payvora Glass Showcase + 3D Telegram Wallet */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full flex flex-col items-center justify-center my-auto"
        >
          {/* Ambient Glow Halo matching hero-balance-card palette */}
          <motion.div
            aria-hidden="true"
            animate={
              prefersReducedMotion
                ? undefined
                : { scale: [0.96, 1.05, 0.96], opacity: [0.55, 0.85, 0.55] }
            }
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-64 h-64 rounded-full bg-gradient-to-tr from-[#0284c7]/30 via-[#1e40af]/20 to-[#8b5cf6]/30 blur-3xl pointer-events-none"
          />

          {/* Orbital Precision Rings */}
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72">
            <motion.div
              aria-hidden="true"
              animate={prefersReducedMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-full border border-sky-400/15 border-t-[#38bdf8]/65 border-r-[#8b5cf6]/45 pointer-events-none"
            />
            <motion.div
              aria-hidden="true"
              animate={prefersReducedMotion ? undefined : { rotate: -360 }}
              transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-4 rounded-full border border-white/[0.06] border-b-[#38bdf8]/35 pointer-events-none"
            />

            {/* Elevated Signature Gradient Medallion */}
            <div
              className="relative w-52 h-52 sm:w-56 sm:h-56 rounded-[2rem] flex items-center justify-center overflow-visible"
              style={{
                background:
                  'linear-gradient(145deg, rgba(2, 132, 199, 0.20) 0%, rgba(11, 19, 41, 0.88) 52%, rgba(76, 29, 149, 0.28) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow:
                  '0 24px 48px -12px rgba(2, 132, 199, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
              }}
            >
              {/* Soft inner top-right highlight */}
              <div
                aria-hidden="true"
                className="absolute top-3 right-3 w-20 h-20 rounded-full bg-[#38bdf8]/15 blur-xl pointer-events-none"
              />

              {/* Ground reflection under wallet */}
              <motion.div
                aria-hidden="true"
                animate={
                  prefersReducedMotion
                    ? undefined
                    : { scaleX: [0.9, 1.06, 0.9], opacity: [0.45, 0.75, 0.45] }
                }
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-5 w-32 h-3.5 rounded-full bg-[#030712]/90 blur-md pointer-events-none"
              />

              {/* Floating 3D Telegram Wallet Icon */}
              <motion.div
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        y: [-6, 6, -6],
                        rotate: [-1.5, 1.5, -1.5],
                      }
                }
                transition={{
                  y: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
                  rotate: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="relative z-10 flex items-center justify-center"
              >
                {!imgError ? (
                  <img
                    src={ASSETS_3D.telegramWallet}
                    alt="Payvora Telegram Wallet"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                    className="w-44 h-44 sm:w-48 sm:h-48 object-contain drop-shadow-[0_18px_32px_rgba(2,132,199,0.55)]"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] flex items-center justify-center shadow-lg">
                    <svg className="w-14 h-14 text-white fill-current" viewBox="0 0 24 24">
                      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                    </svg>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* 3. BOTTOM LOADING CONSOLE (Matches .card-glass-dark surface) */}
        <div className="w-full space-y-4">
          <div className="card-glass-dark p-4 space-y-3">
            {/* Stage label + Tabular Percentage */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-4 h-4 rounded-full border-2 border-sky-400/20 border-t-[#38bdf8] animate-spin shrink-0"
                />
                <div className="h-4 overflow-hidden flex items-center min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={statusMessage}
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="text-xs font-semibold text-slate-200 truncate"
                    >
                      {statusMessage}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>

              <span className="text-xs font-bold text-[#38bdf8] tabular-nums shrink-0">
                {progress}%
              </span>
            </div>

            {/* Smooth GPU Progress Bar matching brand gradient */}
            <div className="w-full h-2 rounded-full bg-[#030712]/90 border border-white/[0.07] p-[1px] overflow-hidden">
              <motion.div
                className="w-full h-full rounded-full origin-left bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#8b5cf6] relative overflow-hidden"
                initial={{ scaleX: 0.08 }}
                animate={{ scaleX: progress / 100 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                {!prefersReducedMotion && (
                  <motion.div
                    aria-hidden="true"
                    animate={{ x: ['-100%', '220%'] }}
                    transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                  />
                )}
              </motion.div>
            </div>

            {/* Clean Milestone Progress Steps */}
            <div className="flex items-center justify-between pt-0.5 text-[11px] font-medium">
              {MILESTONES.map((item) => {
                const done = progress >= item.threshold;
                return (
                  <div
                    key={item.label}
                    className={`flex items-center gap-1 transition-colors duration-200 ${
                      done ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    <Check
                      className={`w-3 h-3 transition-colors duration-200 ${
                        done ? 'text-[#34d399]' : 'text-slate-600'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quiet Unboxed Footer */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
            <span>Payvora</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Secured Telegram Mini App</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
