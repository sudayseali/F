import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Coins, Wallet, Sparkles, Zap } from 'lucide-react';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] text-white overflow-hidden perspective-[1000px]">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand/20 via-[#050505] to-[#050505]" />
      
      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
           key={`particle-${i}`}
           className="absolute w-1.5 h-1.5 bg-amber-400 rounded-full"
           initial={{
             x: (Math.random() - 0.5) * window.innerWidth,
             y: (Math.random() - 0.5) * window.innerHeight,
             scale: Math.random() * 0.5 + 0.5,
             opacity: Math.random() * 0.5 + 0.2
           }}
           animate={{
             y: [null, Math.random() * -300 - 100],
             opacity: [null, 0]
           }}
           transition={{
             duration: Math.random() * 2 + 2,
             repeat: Infinity,
             ease: "linear"
           }}
        />
      ))}

      <motion.div
        initial={{ scale: 0.8, opacity: 0, rotateX: 30 }}
        animate={{ scale: 1, opacity: 1, rotateX: 0 }}
        exit={{ scale: 1.5, opacity: 0, filter: "blur(10px)" }}
        transition={{ duration: 0.8, type: "spring", bounce: 0.5 }}
        className="flex flex-col items-center relative z-10"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* 3D Money Making Machine Composition */}
        <div className="relative w-56 h-56 mb-12 flex items-center justify-center transform-style-[preserve-3d]">
          
          {/* Core Energy Orb */}
          <motion.div 
            animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute w-40 h-40 bg-gradient-to-tr from-brand via-amber-500 to-emerald-500 rounded-full blur-[40px] opacity-60"
          />

          {/* Center 3D Box/Screen */}
          <motion.div
            animate={{ 
              y: [-10, 10, -10], 
              rotateX: [15, -15, 15], 
              rotateY: [-15, 15, -15],
              rotateZ: [-5, 5, -5]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 w-32 h-32 bg-white/10 backdrop-blur-xl border border-white/30 rounded-[2.5rem] shadow-[0_0_50px_rgba(124,58,237,0.3)] flex items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            <TrendingUp className="w-14 h-14 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
          </motion.div>

          {/* Floating Gold Coin */}
          <motion.div
            animate={{ 
              y: [-30, 30, -30], 
              x: [10, -10, 10], 
              rotateY: [0, 360], 
              rotateZ: [10, -10, 10] 
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-4 -right-8 z-20"
          >
            <div className="w-16 h-16 bg-gradient-to-bl from-amber-200 via-amber-400 to-amber-600 rounded-full border-2 border-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.6)] flex items-center justify-center transform hover:scale-110 transition-transform">
              <span className="text-2xl font-black text-white drop-shadow-md">$</span>
            </div>
          </motion.div>

          {/* Floating Crypto/Energy Element */}
          <motion.div
            animate={{ 
              y: [20, -20, 20], 
              x: [-15, 15, -15], 
              rotateX: [0, 360],
              rotateZ: [-20, 20, -20]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -bottom-6 -left-6 z-20"
          >
            <div className="w-14 h-14 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-[1rem] rotate-12 border-2 border-emerald-200 shadow-[0_10px_30px_rgba(16,185,129,0.5)] flex items-center justify-center">
              <Coins className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          </motion.div>

          {/* Orbiting Sparkles */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 z-30 pointer-events-none"
          >
            <Zap className="absolute top-0 right-1/4 w-5 h-5 text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.8)]" />
            <Sparkles className="absolute bottom-4 left-0 w-6 h-6 text-brand-light drop-shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
          </motion.div>
        </div>
        
        {/* Brand Name */}
        <motion.h1
          initial={{ y: 20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8, type: "spring" }}
          className="text-5xl font-display font-black tracking-tighter bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent mb-3"
        >
          Payvora
        </motion.h1>
        
        {/* Tagline */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="flex items-center space-x-3 text-sm font-bold tracking-[0.2em] uppercase"
        >
          <span className="text-amber-400">Earn</span>
          <span className="w-1 h-1 rounded-full bg-gray-500" />
          <span className="text-emerald-400">Complete</span>
          <span className="w-1 h-1 rounded-full bg-gray-500" />
          <span className="text-brand-light">Grow</span>
        </motion.div>

        {/* Loading Bar */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 w-48 h-1.5 bg-white/10 rounded-full overflow-hidden"
        >
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3.2, ease: "easeInOut" }}
            className="h-full bg-gradient-to-r from-amber-400 via-brand to-emerald-400 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.5)]"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
