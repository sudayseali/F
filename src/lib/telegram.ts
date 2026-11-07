// Telegram WebApp SDK helper and haptic utilities

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export const getTelegramWebApp = () => {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
};

// Haptic feedback triggers
export const tgHaptics = {
  impact: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.impactOccurred(style);
    } catch {
      // Ignore if not supported
    }
  },
  notification: (type: 'error' | 'success' | 'warning') => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.notificationOccurred(type);
    } catch {
      // Ignore if not supported
    }
  },
  selection: () => {
    try {
      const tg = getTelegramWebApp();
      tg?.HapticFeedback?.selectionChanged();
    } catch {
      // Ignore if not supported
    }
  }
};

// Telegram Back Button management
let activeBackCallback: (() => void) | null = null;

export const tgBackButton = {
  show: (onClick: () => void) => {
    try {
      const tg = getTelegramWebApp();
      if (tg?.BackButton) {
        if (activeBackCallback) {
          tg.BackButton.offClick(activeBackCallback);
        }
        activeBackCallback = onClick;
        tg.BackButton.show();
        tg.BackButton.onClick(onClick);
      }
    } catch {
      // Ignore
    }
  },
  hide: (callbackToRemove?: () => void) => {
    try {
      const tg = getTelegramWebApp();
      if (tg?.BackButton) {
        const toRemove = callbackToRemove || activeBackCallback;
        if (toRemove) {
          tg.BackButton.offClick(toRemove);
        }
        activeBackCallback = null;
        tg.BackButton.hide();
      }
    } catch {
      // Ignore
    }
  }
};

// Open external or telegram link
export const openTgLink = (url: string) => {
  tgHaptics.impact('light');
  const tg = getTelegramWebApp();
  if (tg?.openTelegramLink && url.startsWith('https://t.me/')) {
    tg.openTelegramLink(url);
  } else if (tg?.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
