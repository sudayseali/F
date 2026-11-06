import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, setSupabaseToken } from '../lib/supabase';

// Real user context with UUID and data
interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  uuid?: string;
  balance?: number;
}

export interface LocationData {
  ip: string;
  country: string;
  countryCode: string;
  continent: string;
  continentCode: string;
  isVpn: boolean;
}

interface TelegramContextType {
  user: TelegramUser | null;
  location: LocationData | null;
  refreshUser: () => Promise<void>;
}

const TelegramContext = createContext<TelegramContextType>({ user: null, location: null, refreshUser: async () => {} });

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isVpnBlock, setIsVpnBlock] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Secure user profile refresh using authenticated session
  const fetchUserData = async (userUuid: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, telegram_id, username, first_name, last_name, wallet_balance, status')
        .eq('id', userUuid)
        .maybeSingle();
      
      if (data && !error) {
        setUser(prev => prev ? { 
          ...prev, 
          uuid: data.id, 
          balance: Number(data.wallet_balance || 0),
          username: data.username || prev.username,
          first_name: data.first_name || prev.first_name
        } : null);
      }
    } catch (err) {
      console.error("Error refreshing user profile:", err);
    }
  };

  const refreshUser = async () => {
    if (user?.uuid) {
      await fetchUserData(user.uuid);
    }
  };

  useEffect(() => {
    const initTelegram = async () => {
      const tg = (window as any).Telegram?.WebApp;

      if (tg && tg.initData) {
        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#0e1621');
        tg.setBackgroundColor?.('#0e1621');
        tg.enableClosingConfirmation?.();

        const tgUnsafeUser = tg.initDataUnsafe?.user;
        const initialUserObj: TelegramUser = {
          id: tgUnsafeUser?.id || 0,
          username: tgUnsafeUser?.username,
          first_name: tgUnsafeUser?.first_name,
          last_name: tgUnsafeUser?.last_name,
        };
        setUser(initialUserObj);

        try {
          const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') || 'https://placeholder.supabase.co';
          const authController = new AbortController();
          const authTimeoutId = setTimeout(() => authController.abort(), 6000);

          // All Telegram authentication MUST pass through the trusted server-side Edge Function
          const res = await fetch(`${baseUrl}/functions/v1/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              initData: tg.initData,
              start_param: tg.initDataUnsafe?.start_param 
            }),
            signal: authController.signal
          });
          clearTimeout(authTimeoutId);

          const authResponse = await res.json();

          if (authResponse.error === "VPN Blocked" || authResponse.isVpnBlock) {
            setIsVpnBlock(true);
            setIsReady(true);
            return;
          }

          if (authResponse.success && authResponse.data) {
            const token = authResponse.data.access_token;
            const verifiedProfile = authResponse.data.user;

            if (token) {
              setSupabaseToken(token);
            }

            if (verifiedProfile) {
              setUser({
                id: verifiedProfile.telegram_id,
                uuid: verifiedProfile.id,
                username: verifiedProfile.username,
                first_name: verifiedProfile.first_name,
                last_name: verifiedProfile.last_name,
                balance: Number(verifiedProfile.wallet_balance || 0)
              });
            }
          } else if (authResponse.success && authResponse.access_token) {
            // Support flat response structure
            setSupabaseToken(authResponse.access_token);
            if (authResponse.user_uuid) {
              await fetchUserData(authResponse.user_uuid);
            }
          } else {
            console.warn("Telegram authentication response:", authResponse.error || "Unauthenticated");
          }
        } catch (e) {
          console.error("Server authentication failed:", e);
        }
      } else {
        // In browser development / preview mode outside Telegram
        const demoUser: TelegramUser = {
          id: 789456123,
          first_name: "Demo",
          last_name: "User",
          username: "telegram_user",
          balance: 14.50
        };
        setUser(demoUser);
      }
      setIsReady(true);
    };

    initTelegram();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e1621] text-slate-200">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-brand border-t-transparent"></div>
          <span className="text-xs text-white/50 font-medium">Loading Telegram WebApp...</span>
        </div>
      </div>
    );
  }

  if (isVpnBlock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0e1621] text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Security Restriction</h1>
        <p className="text-slate-400 text-sm max-w-xs">
          Access denied due to VPN or Proxy detection. Please turn off VPN and re-open.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0e1621] text-center">
        <div className="w-16 h-16 bg-[#2481cc]/15 text-[#2481cc] rounded-2xl flex items-center justify-center mb-6 border border-[#2481cc]/25 shadow-lg">
          <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.15-5.06 3.28-.47.33-.89.49-1.27.48-.41-.01-1.21-.24-1.8-.43-.49-.16-.88-.24-.85-.51.02-.14.22-.29.62-.46 2.44-1.06 4.07-1.74 4.88-2.07 2.32-.97 2.8-1.14 3.12-1.15.07 0 .22.02.3.09.07.06.09.14.1.23-.01.07-.01.12-.02.21z"/></svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Telegram Mini App</h1>
        <p className="text-slate-400 text-sm max-w-xs mb-6">
          Open this app through your Telegram bot or click below to launch preview.
        </p>
        <button
          onClick={() => setUser({ id: 123456789, first_name: "Demo", username: "user", balance: 14.50 })}
          className="px-6 py-2.5 bg-brand text-white text-sm font-semibold rounded-xl shadow-md"
        >
          Open Preview Mode
        </button>
      </div>
    );
  }

  return (
    <TelegramContext.Provider value={{ user, location, refreshUser }}>
      {children}
    </TelegramContext.Provider>
  );
}
