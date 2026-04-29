import React from 'react';

export function Logo({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" /> {/* Cyan */}
          <stop offset="100%" stopColor="#8b5cf6" /> {/* Purple */}
        </linearGradient>
      </defs>
      
      {/* Outer loop of the P */}
      <path 
        d="M 30 90 V 20 H 60 C 80 20 85 45 70 60 C 65 65 55 65 45 65" 
        stroke="url(#logo-gradient)" 
        strokeWidth="10" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Inner loop/circle completion */}
      <path 
        d="M 45 65 C 35 65 30 60 30 50" 
        stroke="url(#logo-gradient)" 
        strokeWidth="10" 
        strokeLinecap="round" 
      />
      
      {/* Target/Arrow circle track */}
      <path 
        d="M 55 35 A 15 15 0 1 1 45 45" 
        stroke="url(#logo-gradient)" 
        strokeWidth="4" 
        strokeLinecap="round" 
      />

      {/* Up-Right Arrow inside the P */}
      <path 
        d="M 35 55 C 45 55 50 50 60 40 M 50 40 H 60 V 50" 
        stroke="url(#logo-gradient)" 
        strokeWidth="8" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}
