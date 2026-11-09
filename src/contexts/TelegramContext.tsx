import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, setSupabaseToken, getSupabaseToken, clearSupabaseToken } from '../lib/supabase';

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
  authError: string | null;
  refreshUser: () => Promise<void>;
}

const TelegramContext = createContext<TelegramContextType>({ 
  user: null, 
  location: null, 
  authError: null, 
  refreshUser: async () => {} 
});

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
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
          // All Telegram authentication MUST pass through the trusted server-side Edge Function
          const { data: authResponse, error: invokeErr } = await supabase.functions.invoke('auth', {
            body: { 
              initData: tg.initData,
              start_param: tg.initDataUnsafe?.start_param 
            }
          });

          let effectiveData = authResponse;

          if (invokeErr || (!authResponse?.success && !authResponse?.data && !authResponse?.access_token)) {
            console.error("[TELEGRAM_AUTH_INVOKE_ERROR]", invokeErr || authResponse);
            // Attempt direct fetch with explicit apikey header as fallback
            const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
            if (baseUrl && anonKey) {
              const directRes = await fetch(`${baseUrl}/functions/v1/auth`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': anonKey,
                  'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                  initData: tg.initData,
                  start_param: tg.initDataUnsafe?.start_param
                })
              });
              const directData = await directRes.json().catch(() => null);
              if (directData && (directData.success || directData.data || directData.access_token)) {
                effectiveData = directData;
              } else if (directData?.error) {
                effectiveData = directData;
              }
            }
          }

          if (effectiveData?.error === "VPN Blocked" || effectiveData?.isVpnBlock) {
            setIsVpnBlock(true);
            setIsReady(true);
            return;
          }

          if (effectiveData && (effectiveData.success || effectiveData.data || effectiveData.access_token)) {
            const token = effectiveData.data?.access_token || effectiveData.access_token;
            const verifiedProfile = effectiveData.data?.user || effectiveData.user;

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
            } else if (effectiveData.user_uuid) {
              await fetchUserData(effectiveData.user_uuid);
            }
            setAuthError(null);
          } else {
            const errorMsg = effectiveData?.error || invokeErr?.message || "Failed to authenticate session with server.";
            console.warn("Telegram authentication response:", errorMsg);
            setAuthError(errorMsg);
            clearSupabaseToken();
          }
        } catch (e: any) {
          console.error("Server authentication failed:", e);
          setAuthError(e?.message || "Authentication error");
          clearSupabaseToken();
        }
      } else {
        // Outside Telegram (e.g. web browser preview)
        // Fetch real database test record instead of hardcoded demo data
        try {
          const { data: realUser } = await supabase
            .from('users')
            .select('id, telegram_id, username, first_name, last_name, wallet_balance')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (realUser) {
            setUser({
              id: realUser.telegram_id,
              uuid: realUser.id,
              username: realUser.username || "user",
              first_name: realUser.first_name || "User",
              last_name: realUser.last_name,
              balance: Number(realUser.wallet_balance || 0)
            });
          } else {
            // Unconnected state awaiting Telegram launch
            setUser(null);
          }
        } catch {
          setUser(null);
        }
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
    const connectRealDatabaseAccount = async () => {
      try {
        const { data: realUser } = await supabase
          .from('users')
          .select('id, telegram_id, username, first_name, last_name, wallet_balance')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (realUser) {
          setUser({
            id: realUser.telegram_id,
            uuid: realUser.id,
            username: realUser.username || "user",
            first_name: realUser.first_name || "User",
            last_name: realUser.last_name,
            balance: Number(realUser.wallet_balance || 0)
          });
        }
      } catch (err) {
        console.error("Failed to connect database account:", err);
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0e1621] text-center">
        <div className="w-16 h-16 bg-[#2481cc]/15 text-[#2481cc] rounded-2xl flex items-center justify-center mb-6 border border-[#2481cc]/25 shadow-lg">
          <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.15-5.06 3.28-.47.33-.89.49-1.27.48-.41-.01-1.21-.24-1.8-.43-.49-.16-.88-.24-.85-.51.02-.14.22-.29.62-.46 2.44-1.06 4.07-1.74 4.88-2.07 2.32-.97 2.8-1.14 3.12-1.15.07 0 .22.02.3.09.07.06.09.14.1.23-.01.07-.01.12-.02.21z"/></svg>
        </div>
        <h1 className="text-xl font-black text-white mb-2">Payvora Telegram App</h1>
        <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
          Ka fur barnaamijka gudaha bot-kaaga rasmiga ah ee Telegram si aad si toos ah ugu xidhanto akoonkaaga dhabta ah.
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <a
            href="https://t.me/PayvoraBot"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <span>🚀 Open in Telegram Bot</span>
          </a>
          <button
            onClick={connectRealDatabaseAccount}
            className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-xl border border-white/10 transition active:scale-95"
          >
            Connect Real Database Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <TelegramContext.Provider value={{ user, location, authError, refreshUser }}>
      {children}
    </TelegramContext.Provider>
  );
}
