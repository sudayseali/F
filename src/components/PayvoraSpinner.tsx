import React from 'react';
import { motion } from 'motion/react';

interface PayvoraSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

export function PayvoraSpinner({ size = 'md', className = '', glow = true }: PayvoraSpinnerProps) {
  const sizeMap = {
    xs: 'w-3.5 h-3.5 border-[2px]',
    sm: 'w-4 h-4 border-[2px]',
    md: 'w-6 h-6 border-[2.5px]',
    lg: 'w-8 h-8 border-[3px]',
    xl: 'w-12 h-12 border-[3.5px]',
  };

  const glowSizeMap = {
    xs: 'w-3 h-3 blur-xs',
    sm: 'w-4 h-4 blur-xs',
    md: 'w-6 h-6 blur-sm',
    lg: 'w-8 h-8 blur-md',
    xl: 'w-10 h-10 blur-lg',
  };

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {glow && (
        <div 
          className={`absolute rounded-full bg-cyan-400/30 ${glowSizeMap[size]} pointer-events-none animate-pulse`} 
        />
      )}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={`rounded-full border-transparent border-t-cyan-400 border-r-purple-500 border-b-sky-300/40 ${sizeMap[size]} shadow-[0_0_10px_rgba(56,189,248,0.45)]`}
      />
    </div>
  );
}

interface PayvoraLoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PayvoraLoadingState({ 
  message = 'Loading...', 
  size = 'md', 
  className = 'py-10' 
}: PayvoraLoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <PayvoraSpinner size={size} glow={true} />
      {message && (
        <span className="text-xs font-semibold text-slate-300/80 tracking-wide">
          {message}
        </span>
      )}
    </div>
  );
}
