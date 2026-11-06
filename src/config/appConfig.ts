// ============================================================================
// PAYVORA APP CONFIGURATION
// Waxaad halkan si toos ah uga beddeli kartaa dhammaan xogta guud ee app-ka
// (App details, Telegram links, Offerwalls, Payouts, Daily rewards & Referrals)
// ============================================================================

export const APP_CONFIG = {
  // App Branding
  appName: "Payvora",
  appDescription: "Earn crypto & cash completing simple offers, tasks & surveys",
  currencySymbol: "$",
  pointsRatio: 1000, // 1 USD = 1000 Points

  // Telegram Links & Socials
  telegram: {
    botUsername: "PayvoraBot", // e.g. @PayvoraBot
    botUrl: "https://t.me/PayvoraBot",
    communityUrl: "https://t.me/PayvoraCommunity",
    supportUrl: "https://t.me/PayvoraSupport",
  },

  // Offerwall Provider Configuration
  offerwalls: {
    cpx: {
      appId: import.meta.env.VITE_CPX_APP_ID || "24128",
      baseUrl: "https://offers.cpx-research.com/index.php",
    },
    ayet: {
      appId: "26815",
      baseUrl: "https://www.ayetstudios.com/offers/offerwall_api/26815",
    },
    torox: {
      pubId: "1234",
      baseUrl: "https://torox.io/offerwall",
    },
  },

  // Daily Check-In Rewards
  rewards: {
    dailyCheckInPoints: 50, // +50 PTS every 24 hours
    referralBonusPercent: 10, // 10% lifetime commission on referrals
  },

  // Payout Configuration
  payouts: {
    minWithdrawalUsd: 1.00, // Minimum payout ($1.00)
    defaultMethod: "usdt" as const,
    supportedMethods: [
      {
        id: "usdt" as const,
        name: "USDT (TRC20)",
        min: 1.00,
        network: "TRON (TRC20)",
        placeholder: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        desc: "Direct Tether USD payout to your TRC20 wallet",
      },
      {
        id: "trx" as const,
        name: "TRON (TRX)",
        min: 1.00,
        network: "TRON",
        placeholder: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
        desc: "Direct crypto payout to your TRON wallet",
      },
      {
        id: "payeer" as const,
        name: "Payeer USD",
        min: 1.00,
        network: "Payeer Account",
        placeholder: "P1000000000",
        desc: "Instant USD transfer to your Payeer account",
      },
    ],
  },
};
