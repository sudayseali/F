import React from "react";

export function TelegramWalletGraphic({ className = "w-28 h-28" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      {/* Glow behind wallet */}
      <div className="absolute inset-0 bg-cyan-400/30 rounded-full blur-xl transform -translate-y-1" />

      <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-2xl">
        <defs>
          {/* Wallet Body Gradient */}
          <linearGradient id="walletGrad" x1="20" y1="30" x2="140" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="45%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>

          {/* Wallet Flap Gradient */}
          <linearGradient id="flapGrad" x1="20" y1="20" x2="130" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="60%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          {/* Gold Coin Gradient 1 */}
          <linearGradient id="goldCoin1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Gold Coin Gradient 2 */}
          <linearGradient id="goldCoin2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>

          {/* Clasp Glow */}
          <filter id="claspGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Top Gold Coin 1 (Tilted behind flap) */}
        <g transform="rotate(-15 65 30)">
          <ellipse cx="65" cy="30" rx="20" ry="14" fill="url(#goldCoin1)" stroke="#FDE68A" strokeWidth="1.5" />
          <ellipse cx="65" cy="30" rx="14" ry="9" fill="url(#goldCoin2)" />
          <path d="M63 26 L67 30 L63 34" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        </g>

        {/* Left Falling Gold Coin */}
        <g transform="rotate(25 28 85)">
          <ellipse cx="28" cy="85" rx="18" ry="12" fill="url(#goldCoin1)" stroke="#FDE68A" strokeWidth="1.2" />
          <ellipse cx="28" cy="85" rx="12" ry="7.5" fill="url(#goldCoin2)" />
          <circle cx="28" cy="85" r="2.5" fill="#FFF" opacity="0.7" />
        </g>

        {/* Back of Wallet */}
        <rect x="25" y="38" width="105" height="75" rx="18" fill="#0369A1" opacity="0.85" />

        {/* Main Wallet Base */}
        <rect x="20" y="44" width="112" height="78" rx="20" fill="url(#walletGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

        {/* Wallet Fold / Flap */}
        <path
          d="M20 56 C20 44, 30 40, 44 40 L108 40 C122 40, 132 44, 132 56 L132 75 C132 86, 118 96, 102 96 L50 96 C34 96, 20 86, 20 75 Z"
          fill="url(#flapGrad)"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.2"
        />

        {/* Glossy top edge reflection */}
        <path d="M30 43 L122 43" stroke="#FFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />

        {/* Telegram Paper Airplane Logo on Flap */}
        <g transform="translate(62, 54) scale(0.9)">
          <path
            d="M2.5 14.5 L24 3.5 L19.5 24 L13.5 18 L10 21.5 L10.5 16 Z"
            fill="#FFFFFF"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
          />
          <path d="M13.5 18 L24 3.5 L10.5 16 Z" fill="#E2E8F0" opacity="0.9" />
        </g>

        {/* Wallet Right Clasp Tab */}
        <rect x="122" y="65" width="18" height="22" rx="7" fill="#0284C7" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <circle cx="131" cy="76" r="4" fill="#FFFFFF" filter="url(#claspGlow)" />
        <circle cx="131" cy="76" r="2" fill="#38BDF8" />

        {/* Sparkling Stars */}
        <path d="M142 35 Q145 35 145 32 Q145 35 148 35 Q145 35 145 38 Q145 35 142 35 Z" fill="#FDE68A" />
        <path d="M15 48 Q17 48 17 46 Q17 48 19 48 Q17 48 17 50 Q17 48 15 48 Z" fill="#38BDF8" />
      </svg>
    </div>
  );
}

export function GiftBoxGraphic({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center select-none pointer-events-none ${className}`}>
      <div className="absolute inset-0 bg-pink-500/30 rounded-full blur-md" />
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-lg">
        <defs>
          <linearGradient id="boxGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="50%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#9F1239" />
          </linearGradient>
          <linearGradient id="goldRibbon" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="50%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
        </defs>

        {/* Box Base */}
        <rect x="20" y="44" width="60" height="42" rx="10" fill="url(#boxGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        {/* Box Lid */}
        <rect x="16" y="34" width="68" height="14" rx="6" fill="#F43F5E" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

        {/* Vertical Ribbon */}
        <rect x="44" y="34" width="12" height="52" fill="url(#goldRibbon)" />
        {/* Horizontal Ribbon on Lid */}
        <rect x="16" y="38" width="68" height="6" fill="url(#goldRibbon)" opacity="0.9" />

        {/* Ribbon Bow */}
        <ellipse cx="40" cy="28" rx="12" ry="7" transform="rotate(-20 40 28)" fill="url(#goldRibbon)" />
        <ellipse cx="60" cy="28" rx="12" ry="7" transform="rotate(20 60 28)" fill="url(#goldRibbon)" />
        <circle cx="50" cy="30" r="5" fill="#FEF08A" />

        {/* Sparkles */}
        <circle cx="20" cy="22" r="2" fill="#FEF08A" />
        <circle cx="82" cy="30" r="2.5" fill="#FEF08A" />
      </svg>
    </div>
  );
}
