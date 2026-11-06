import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, setSupabaseToken } from '../lib/supabase';

// We will export a real user context with UUID and data
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

  const fetchUserData = async (telegramId: number) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      
      if (data) {
        setUser(prev => prev ? { ...prev, uuid: data.id, balance: data.wallet_balance } : null);
      } else {
        console.log("User not found, attempting fallback upsert for telegram_id:", telegramId);
        // If user doesn't exist, create it via supbase locally so it works even without edge function
        const { data: newData, error: upsertError } = await supabase.from('users').upsert({
           telegram_id: telegramId,
           username: 'user_' + telegramId,
           first_name: 'User',
           wallet_balance: 0
        }, { onConflict: 'telegram_id' }).select().maybeSingle();
        
        if (upsertError) {
          console.error("Upsert error in TelegramContext:", JSON.stringify(upsertError, null, 2));
        } else if (newData) {
          console.log("Upsert success:", newData);
          setUser(prev => prev ? { ...prev, uuid: newData.id, balance: newData.wallet_balance } : null);
        }
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  const refreshUser = async () => {
    if (user?.id) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    const initTelegram = async () => {
      // VPN Check removed for better reliability
      const tg = (window as any).Telegram?.WebApp;
      
      const urlParams = new URLSearchParams(window.location.search);
      // Removed debug backdoor for security.

      if (tg && tg.initDataUnsafe) {
        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#0e1621');
        tg.setBackgroundColor?.('#0e1621');
        tg.enableClosingConfirmation?.();
        const tgUser = tg.initDataUnsafe?.user;
        
        if (tgUser) {
          const userObj: TelegramUser = {
            id: tgUser.id,
            username: tgUser.username,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
          };
          setUser(userObj);
          
          try {
            const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') || 'https://placeholder.supabase.co';
            const authController = new AbortController();
            const authTimeoutId = setTimeout(() => authController.abort(), 4000);
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
            const authData = await res.json();
            
            if (authData.error === "VPN Blocked" || authData.isVpnBlock) {
              setIsVpnBlock(true);
              setIsReady(true);
              return;
            }

            if (authData.success) {
              if (authData.access_token) {
                setSupabaseToken(authData.access_token);
              }
              userObj.uuid = authData.user_uuid;
              setUser({...userObj});
            }
          } catch(e) {
            console.error("Edge function auth failed", e);
          }
          
          await fetchUserData(tgUser.id);
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
          onClick={() => setUser({ id: 123456789, first_name: "Demo", username: "user" })}
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
