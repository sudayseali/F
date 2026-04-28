import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505] text-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.2, opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center"
      >
        <motion.div
          animate={{ y: [-10, 10, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-40 h-40 mb-8"
        >
          <img 
            src="https://images.unsplash.com/photo-1614064641913-a53b15c80521?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80" 
            alt="3D Crystal shape for Crypto App"
            className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(245,158,11,0.4)]"
          />
        </motion.div>
        
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-black tracking-tighter bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent mb-2"
        >
          Payvora
        </motion.h1>
        
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-gray-500 font-medium tracking-widest text-xs uppercase"
        >
          EARN • COMPLETE • GROW
        </motion.p>
      </motion.div>
    </div>
  );
}
