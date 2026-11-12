import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2400 }: SplashScreenProps) {
  const [progress, setProgress] = useState<number>(12);
  const [statusMessage, setStatusMessage] = useState<string>('Get ready for amazing rewards! 🚀');

  useEffect(() => {
    // Expand Telegram Mini App immediately to full screen
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#030712');
        tg.setBackgroundColor?.('#030712');
      }
    } catch {
      // Safe fallback
    }

    const stages = [
      { at: 15, msg: 'Connecting Telegram WebApp...' },
      { at: 42, msg: 'Securing Cryptographic Session...' },
      { at: 75, msg: 'Syncing Wallet & Streaks...' },
      { at: 92, msg: 'Get ready for amazing rewards! 🚀' },
      { at: 100, msg: 'Welcome to Payvora! ✨' }
    ];

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.floor((elapsed / minDuration) * 100));

      setProgress((prev) => {
        const next = Math.max(prev, pct);
        const stage = [...stages].reverse().find(s => next >= s.at);
        if (stage) setStatusMessage(stage.msg);
        return next;
      });

      // Telegram Haptic feedback
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.HapticFeedback) {
          if (pct === 50) tg.HapticFeedback.impactOccurred('light');
          if (pct === 100) tg.HapticFeedback.notificationOccurred('success');
        }
      } catch {
        // Safe fallback
      }

      if (elapsed >= minDuration) {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
          onComplete?.();
        }, 300);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [minDuration, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#030712] text-white flex flex-col justify-between items-center overflow-hidden select-none touch-none"
      style={{ width: '100vw', height: '100dvh' }}
    >
      {/* Dynamic Background Corner Ribbons & Radial Neon Glows */}
      {/* Top Left Glowing Wave */}
      <div className="absolute -top-16 -left-16 w-64 h-64 bg-gradient-to-br from-cyan-400/25 via-blue-600/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-400/15 rounded-br-[100px] blur-xl pointer-events-none" />

      {/* Bottom Right Glowing Wave */}
      <div className="absolute -bottom-16 -right-16 w-72 h-72 bg-gradient-to-tl from-purple-600/30 via-fuchsia-500/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-36 h-36 bg-purple-500/15 rounded-tl-[110px] blur-xl pointer-events-none" />

      {/* Subtle Floating Starfield Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { top: '14%', left: '20%', delay: 0 },
          { top: '22%', right: '18%', delay: 0.7 },
          { top: '38%', left: '12%', delay: 1.2 },
          { top: '44%', right: '14%', delay: 0.4 },
          { top: '65%', left: '18%', delay: 1.5 },
          { top: '72%', right: '22%', delay: 0.9 },
        ].map((star, i) => (
          <motion.div
            key={i}
            style={{ top: star.top, left: star.left, right: star.right }}
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.8, 1.4, 0.8],
            }}
            transition={{
              duration: 2.2,
              repeat: Infinity,
              delay: star.delay,
              ease: 'easeInOut',
            }}
            className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-[0_0_8px_#fef08a]"
          />
        ))}
      </div>

      {/* Main Container constrained for mobile elegance */}
      <div className="relative w-full max-w-sm h-full flex flex-col justify-between items-center px-6 py-5 z-10">

        {/* 1. TOP HERO: Neon Logo & Payvora Brand Typography */}
        <div className="flex flex-col items-center pt-2">
          {/* Animated Neon "P" Emblem */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative w-36 h-36 flex items-center justify-center mb-1"
          >
            {/* Ambient breathing neon halo glow behind logo */}
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                opacity: [0.35, 0.6, 0.35],
              }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-purple-600/30 rounded-full blur-2xl pointer-events-none"
            />

            <img
              src="/assets/payvora-emblem.png"
              alt="Payvora Emblem"
              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(56,189,248,0.45)]"
            />
          </motion.div>

          {/* Brand Name Typography */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="flex items-center text-4xl sm:text-5xl font-black tracking-tight"
          >
            <span className="text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.2)]">Pay</span>
            <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_2px_16px_rgba(168,85,247,0.4)]">
              vora
            </span>
          </motion.div>

          {/* Subtitle Slogan */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-xs sm:text-sm font-semibold text-slate-300/90 tracking-[0.22em] uppercase mt-1"
          >
            Earn • Play • Withdraw
          </motion.p>
        </div>

        {/* 2. CENTER HERO: Floating 3D Wallet & Bursting Gold Star Coins */}
        <motion.div
          animate={{
            y: [-6, 6, -6],
          }}
          transition={{
            duration: 3.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative w-full flex items-center justify-center my-auto py-2"
        >
          {/* Neon circular pedestal glow aura */}
          <div className="absolute bottom-2 w-52 h-14 bg-gradient-to-r from-cyan-500/25 via-blue-600/20 to-purple-600/25 rounded-full blur-xl pointer-events-none" />

          {/* 3D Blue Leather Wallet with Embossed Logo and Gold Star Coins */}
          <img
            src="/assets/wallet-3d-clean.png"
            alt="Payvora 3D Wallet & Coins"
            className="w-full max-w-[340px] max-h-[220px] object-contain relative z-10 drop-shadow-[0_12px_32px_rgba(0,0,0,0.7)]"
          />

          {/* Rotating orbital light streak around wallet */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          >
            <div className="w-full h-full rounded-full border border-transparent border-t-cyan-400/40 border-b-purple-500/30 blur-[0.5px]" />
          </motion.div>
        </motion.div>

        {/* 3. BOTTOM HERO: Real Interactive Animated Loading Section */}
        <div className="w-full flex flex-col items-center pb-2">
          
          {/* Animated Glowing Gradient Spinner Ring */}
          <div className="relative mb-2.5 flex items-center justify-center">
            {/* Ambient center pulse */}
            <motion.div
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-8 h-8 bg-cyan-400/30 rounded-full blur-md"
            />
            
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-[3px] border-transparent border-t-cyan-400 border-r-purple-500 border-b-sky-300/40 shadow-[0_0_14px_rgba(56,189,248,0.5)]"
            />
          </div>

          {/* Bold "Loading..." text with animated dots */}
          <div className="flex items-center gap-0.5 mb-1">
            <span className="text-xl font-black text-white tracking-wide">
              Loading
            </span>
            <span className="text-cyan-400 font-extrabold text-xl animate-pulse">...</span>
          </div>

          {/* Dynamic Stage Message */}
          <div className="h-5 flex items-center justify-center mb-3">
            <AnimatePresence mode="wait">
              <motion.p
                key={statusMessage}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.18 }}
                className="text-xs font-medium text-slate-300/90 text-center tracking-normal truncate max-w-[280px]"
              >
                {statusMessage}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* REAL Live Animated Gradient Progress Bar */}
          <div className="w-full max-w-[300px] mb-4">
            <div className="relative h-3.5 bg-[#0a1329]/90 backdrop-blur-md rounded-full p-0.5 border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Dynamic Fill Bar */}
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#00f2fe] via-[#38bdf8] to-[#a855f7] relative overflow-hidden shadow-[0_0_12px_rgba(56,189,248,0.6)]"
                style={{ width: `${progress}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              >
                {/* Moving Specular Highlight Beam */}
                <motion.div
                  animate={{ x: ['-100%', '220%'] }}
                  transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/55 to-transparent w-full"
                />
              </motion.div>
            </div>

            {/* Percentage & Status indicator */}
            <div className="flex justify-between items-center px-1 mt-1 text-[10px] text-slate-400 font-semibold tracking-wider">
              <span>SYNCING</span>
              <span className="text-cyan-300 font-mono font-bold">{progress}%</span>
            </div>
          </div>

          {/* Footer: Official Telegram Mini App Badge */}
          <div className="w-full max-w-[310px] flex items-center justify-center gap-2.5 pt-1">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-white/5" />
            <div className="flex items-center gap-2 py-1 px-3 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="w-4 h-4 rounded-full bg-[#2481cc] flex items-center justify-center shadow-[0_0_8px_rgba(36,129,204,0.6)]">
                <svg className="w-2.5 h-2.5 text-white fill-current ml-[-0.5px]" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.15-5.06 3.28-.47.33-.89.49-1.27.48-.41-.01-1.21-.24-1.8-.43-.49-.16-.88-.24-.85-.51.02-.14.22-.29.62-.46 2.44-1.06 4.07-1.74 4.88-2.07 2.32-.97 2.8-1.14 3.12-1.15.07 0 .22.02.3.09.07.06.09.14.1.23-.01.07-.01.12-.02.21z" />
                </svg>
              </div>
              <span className="text-[11px] font-medium text-slate-300/90 tracking-wide">
                Payvora Telegram Mini App
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-white/15 to-white/5" />
          </div>

        </div>

      </div>
    </motion.div>
  );
}
