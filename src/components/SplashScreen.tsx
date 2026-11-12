import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2600 }: SplashScreenProps) {
  const [progress, setProgress] = useState<number>(8);
  const [statusText, setStatusText] = useState<string>('Initializing Payvora...');
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  useEffect(() => {
    // Stage updates to give a realistic, responsive loading feeling
    const stages = [
      { at: 15, text: 'Connecting Telegram WebApp...' },
      { at: 40, text: 'Verifying Security & Session...' },
      { at: 70, text: 'Syncing Wallet & Daily Rewards...' },
      { at: 92, text: 'Get ready for amazing rewards! 🚀' },
      { at: 100, text: 'Welcome to Payvora! ✨' }
    ];

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const rawPct = Math.min(100, Math.floor((elapsed / minDuration) * 100));

      // Natural ease-out progress curve
      setProgress((prev) => {
        const next = Math.max(prev, rawPct);
        const currentStage = [...stages].reverse().find(s => next >= s.at);
        if (currentStage) {
          setStatusText(currentStage.text);
        }
        return next;
      });

      // Provide Telegram Haptic feedback if in TMA
      try {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.HapticFeedback) {
          if (rawPct === 50) tg.HapticFeedback.impactOccurred('light');
          if (rawPct === 100) tg.HapticFeedback.notificationOccurred('success');
        }
      } catch {
        // Safe fallback
      }

      if (elapsed >= minDuration) {
        clearInterval(interval);
        setProgress(100);
        setIsFinishing(true);
        setTimeout(() => {
          onComplete?.();
        }, 350);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [minDuration, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.45, ease: 'easeInOut' }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#02040b] select-none overflow-hidden touch-none"
    >
      {/* Ambient background glow accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[320px] h-[320px] bg-cyan-500/15 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[340px] h-[340px] bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main framed container optimized for Telegram Mini App mobile viewport */}
      <div className="relative w-full max-w-[430px] h-full max-h-[920px] flex flex-col justify-between overflow-hidden shadow-2xl">
        
        {/* The Exact Design Visual Artwork */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/loading-screen.png"
            alt="Payvora Loading"
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              // Fallback to original user asset path if needed
              (e.target as HTMLImageElement).src = '/assets/aistudio/file_00000000f4bc821188268adb62eab2f7_a684b129.png';
            }}
          />

          {/* Subtle animated neon pulses over the artwork */}
          <motion.div
            animate={{
              opacity: [0.15, 0.35, 0.15],
              scale: [1, 1.03, 1]
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none"
          />

          {/* Floating sparkle dots */}
          <div className="absolute inset-0 pointer-events-none">
            {[
              { top: '22%', left: '18%', delay: 0 },
              { top: '34%', right: '16%', delay: 0.8 },
              { top: '46%', left: '12%', delay: 1.4 },
              { top: '52%', right: '14%', delay: 0.4 },
              { top: '62%', left: '22%', delay: 1.1 },
            ].map((sparkle, i) => (
              <motion.div
                key={i}
                style={{ top: sparkle.top, left: sparkle.left, right: sparkle.right }}
                animate={{
                  opacity: [0.2, 1, 0.2],
                  scale: [0.8, 1.3, 0.8]
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: sparkle.delay,
                  ease: 'easeInOut'
                }}
                className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-[0_0_8px_#fde047]"
              />
            ))}
          </div>
        </div>

        {/* Top Spacer to align with artwork header */}
        <div className="relative z-10 pt-6 px-6 flex justify-between items-center opacity-0">
          <span className="text-xs">Payvora</span>
        </div>

        {/* Bottom Interactive Loading Overlay aligned with image UI */}
        <div className="relative z-10 pb-8 px-7 pt-4 flex flex-col items-center">
          
          {/* Active Animated Spinner Overlay */}
          <div className="relative mb-3 flex items-center justify-center">
            {/* Ambient spinner glow */}
            <div className="absolute inset-0 bg-cyan-500/25 blur-md rounded-full" />
            
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="w-11 h-11 rounded-full border-3 border-transparent border-t-cyan-400 border-r-purple-500 border-b-cyan-300/40 relative z-10 shadow-[0_0_12px_rgba(56,189,248,0.5)]"
            />
          </div>

          {/* Loading Label with subtle pulse */}
          <motion.div 
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5 mb-1"
          >
            <h2 className="text-xl font-display font-black text-white tracking-wide">
              Loading
            </h2>
            <span className="text-cyan-400 font-bold text-lg animate-pulse">...</span>
          </motion.div>

          {/* Dynamic Status / Subtitle */}
          <div className="h-6 flex items-center justify-center mb-3">
            <AnimatePresence mode="wait">
              <motion.p
                key={statusText}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-xs font-medium text-slate-300 text-center tracking-normal px-2 truncate"
              >
                {statusText}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Active Live Progress Bar with moving glow */}
          <div className="w-full max-w-[320px] mb-4">
            <div className="relative h-4 bg-[#0a1128]/80 backdrop-blur-md rounded-full p-0.5 border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Animated Progress Fill */}
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#00f2fe] via-[#4facfe] to-[#a855f7] relative overflow-hidden"
                style={{ width: `${progress}%` }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                {/* Moving shimmer light streak inside bar */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent w-full"
                />
              </motion.div>
            </div>

            {/* Progress percentage & status */}
            <div className="flex justify-between items-center px-1 mt-1 text-[10px] text-slate-400 font-semibold tracking-wider">
              <span>SYNCING</span>
              <span className="text-cyan-300 font-mono">{progress}%</span>
            </div>
          </div>

          {/* Telegram Mini App Footer Pill */}
          <div className="w-full max-w-[340px] flex items-center justify-center gap-3 pt-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/15 to-white/5" />
            <div className="flex items-center gap-2 py-1 px-3 rounded-full bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm">
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
