import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] text-white overflow-hidden">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#050505_0%,_#050505_100%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
        transition={{ duration: 0.8 }}
        className="flex flex-col items-center relative z-10"
      >
        {/* Logo */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="mb-6 relative"
        >
          <div className="absolute inset-0 bg-brand/30 blur-[40px] rounded-full" />
          <Logo className="w-28 h-28 relative z-10" />
        </motion.div>
        
        {/* Brand Name */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-display font-black tracking-tighter bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent mb-8"
        >
          Payvora
        </motion.h1>

        {/* Minimal Loading Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full"
              />
            ))}
          </div>
          <span className="text-sm text-gray-400 font-medium tracking-widest uppercase">
            Loading
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
