import React, { useEffect } from 'react';
import { motion } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2000 }: SplashScreenProps) {
  useEffect(() => {
    // Automatically maximize Telegram WebApp view to full mobile screen
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#02040b');
        tg.setBackgroundColor?.('#02040b');
      }
    } catch {
      // Safe fallback
    }

    const timer = setTimeout(() => {
      onComplete?.();
    }, minDuration);

    return () => clearTimeout(timer);
  }, [minDuration, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] bg-[#02040b] flex items-center justify-center overflow-hidden select-none touch-none"
    >
      {/* Edge-to-edge full screen container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <img
          src="/assets/loading-screen.png"
          alt="Payvora Loading"
          className="w-full h-full object-cover object-center"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/aistudio/file_00000000f4bc821188268adb62eab2f7_a684b129.png';
          }}
        />

        {/* Subtle breathing ambient neon glow highlight (no overlapping text) */}
        <motion.div
          animate={{
            opacity: [0.15, 0.35, 0.15],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[22%] left-1/2 -translate-x-1/2 w-48 h-12 bg-cyan-500/15 rounded-full blur-xl pointer-events-none"
        />
      </div>
    </motion.div>
  );
}
