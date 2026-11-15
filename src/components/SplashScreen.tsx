import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ASSETS_3D } from '../lib/assets';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

const LOADING_STAGES = [
  { at: 0, msg: 'Connecting to Telegram' },
  { at: 32, msg: 'Verifying cryptographic session' },
  { at: 68, msg: 'Syncing wallet & rewards' },
  { at: 94, msg: 'Ready to launch' },
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
      // Smooth ease-out progress feel
      const easedPct = Math.min(100, Math.max(8, Math.round((1 - Math.pow(1 - linear, 2.1)) * 100)));

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
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#030712] text-white flex flex-col justify-between items-center overflow-hidden select-none touch-none"
    >
      {/* Layered Atmospheric Background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 34%, rgba(2, 132, 199, 0.24) 0%, rgba(15, 23, 42, 0.18) 38%, rgba(3, 7, 18, 1) 76%)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-sky-500/15 blur-[96px] pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-80px] left-1/2 -translate-x-1/2 w-[360px] h-[220px] rounded-full bg-amber-400/10 blur-[100px] pointer-events-none"
      />

      {/* Main Content Layout */}
      <div className="relative z-10 w-full max-w-md h-full flex flex-col justify-between items-center px-6 pt-8 pb-7">
        {/* Top Wordmark */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center text-center"
        >
          <h1
            className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-none"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <span className="text-white">Pay</span>
            <span className="bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#fbbf24] bg-clip-text text-transparent">
              vora
            </span>
          </h1>
          <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.22em] uppercase text-slate-400">
            <span>Earn</span>
            <span aria-hidden="true" className="text-sky-400/70">·</span>
            <span>Play</span>
            <span aria-hidden="true" className="text-amber-400/70">·</span>
            <span>Withdraw</span>
          </div>
        </motion.div>

        {/* Center Hero: Kinetic 3D Telegram Wallet Showcase */}
        <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72 my-auto">
          {/* Concentric Architectural Orbital Rings */}
          <div
            aria-hidden="true"
            className="absolute inset-4 rounded-full border border-white/[0.06] pointer-events-none"
          />

          <motion.div
            aria-hidden="true"
            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border border-sky-400/15 border-t-sky-400/60 border-r-amber-300/35 pointer-events-none"
          />

          <motion.div
            aria-hidden="true"
            animate={prefersReducedMotion ? undefined : { rotate: -360 }}
            transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-7 rounded-full border border-dashed border-amber-400/20 pointer-events-none"
          />

          {/* Soft Dual-Tone Aura Behind Icon */}
          <motion.div
            aria-hidden="true"
            animate={
              prefersReducedMotion
                ? undefined
                : { scale: [0.95, 1.07, 0.95], opacity: [0.55, 0.85, 0.55] }
            }
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-sky-500/30 via-blue-500/20 to-amber-400/20 blur-2xl pointer-events-none"
          />

          {/* Ground Elevation Shadow */}
          <motion.div
            aria-hidden="true"
            animate={
              prefersReducedMotion
                ? undefined
                : { scaleX: [0.92, 1.06, 0.92], opacity: [0.5, 0.8, 0.5] }
            }
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute bottom-6 w-36 h-4 rounded-full bg-sky-950/90 blur-md pointer-events-none"
          />

          {/* Floating 3D Telegram Wallet Icon */}
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.86, opacity: 0, y: 12 }}
            animate={
              prefersReducedMotion
                ? { scale: 1, opacity: 1 }
                : {
                    scale: 1,
                    opacity: 1,
                    y: [-7, 7, -7],
                    rotate: [-1.5, 1.5, -1.5],
                  }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.35 }
                : {
                    scale: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
                    opacity: { duration: 0.45 },
                    y: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
                    rotate: { duration: 4.8, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
            className="relative z-10 flex items-center justify-center"
          >
            {!imgError ? (
              <img
                src={ASSETS_3D.telegramWallet}
                alt="Payvora 3D Telegram Wallet"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-48 h-48 sm:w-52 sm:h-52 object-contain drop-shadow-[0_22px_38px_rgba(2,132,199,0.52)]"
              />
            ) : (
              <div className="w-36 h-36 rounded-3xl bg-gradient-to-br from-[#0284c7] to-[#1d4ed8] flex items-center justify-center shadow-2xl border border-white/15">
                <svg className="w-16 h-16 text-white fill-current" viewBox="0 0 24 24">
                  <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                </svg>
              </div>
            )}
          </motion.div>

          {/* Subtle Geometric Sparkle Glints Matching Gold Coins */}
          {!prefersReducedMotion && (
            <>
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.15, 0.8] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-6 right-8 w-4 h-4 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.7)] pointer-events-none"
                fill="currentColor"
              >
                <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
              </motion.svg>
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.75, 1.1, 0.75] }}
                transition={{ duration: 2.8, delay: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute bottom-10 left-7 w-3 h-3 text-sky-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)] pointer-events-none"
                fill="currentColor"
              >
                <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z" />
              </motion.svg>
            </>
          )}
        </div>

        {/* Bottom Progress & Status Section */}
        <div className="w-full max-w-[300px] flex flex-col items-center space-y-4">
          {/* Active Stage Indicator */}
          <div className="w-full flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <span className="w-4 h-4 rounded-full border-2 border-sky-400/20 border-t-sky-400 animate-spin" />
              </span>
              <div className="h-4 overflow-hidden flex items-center">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={statusMessage}
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="text-slate-300 font-medium truncate"
                  >
                    {statusMessage}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
            <span className="text-sky-300 font-mono font-semibold tabular-nums shrink-0 ml-2">
              {progress}%
            </span>
          </div>

          {/* Compositor-Only Smooth Progress Bar */}
          <div className="w-full h-2 rounded-full bg-white/[0.06] border border-white/[0.08] p-[1px] overflow-hidden shadow-inner">
            <motion.div
              className="w-full h-full rounded-full origin-left bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#fbbf24] relative overflow-hidden"
              initial={{ scaleX: 0.08 }}
              animate={{ scaleX: progress / 100 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {!prefersReducedMotion && (
                <motion.div
                  aria-hidden="true"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                />
              )}
            </motion.div>
          </div>

          {/* Quiet Brand Footer (Unboxed) */}
          <div className="w-full flex items-center justify-center gap-2.5 pt-1 text-[11px] font-medium text-slate-400">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <svg className="w-3.5 h-3.5 text-[#38bdf8] fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.15-5.06 3.28-.47.33-.89.49-1.27.48-.41-.01-1.21-.24-1.8-.43-.49-.16-.88-.24-.85-.51.02-.14.22-.29.62-.46 2.44-1.06 4.07-1.74 4.88-2.07 2.32-.97 2.8-1.14 3.12-1.15.07 0 .22.02.3.09.07.06.09.14.1.23-.01.07-.01.12-.02.21z" />
              </svg>
              <span>Payvora Official Mini App</span>
            </div>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
