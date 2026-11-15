import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import {
  supabase,
  setSupabaseToken,
  getSupabaseToken,
  clearSupabaseToken,
  decodeJwtPayload,
  isTokenExpired,
} from '../lib/supabase';
import { SplashScreen } from '../components/SplashScreen';
import { APP_CONFIG } from '../config/appConfig';

// Real user context with server-verified UUID and data
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [location] = useState<LocationData | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVpnBlock, setIsVpnBlock] = useState(false);
  const [isTelegramInitDone, setIsTelegramInitDone] = useState(false);
  const [isSplashMinDone, setIsSplashMinDone] = useState(false);
  const [isInsideTelegram, setIsInsideTelegram] = useState(false);

  // Secure user profile refresh using authenticated session (RLS enforces auth.uid() = id)
  const fetchUserData = useCallback(async (userUuid: string): Promise<TelegramUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, telegram_id, username, first_name, last_name, wallet_balance, status')
        .eq('id', userUuid)
        .maybeSingle();

      if (data && !error && data.status !== 'suspended') {
        const mapped: TelegramUser = {
          id: data.telegram_id,
          uuid: data.id,
          username: data.username || undefined,
          first_name: data.first_name || undefined,
          last_name: data.last_name || undefined,
          balance: Number(data.wallet_balance || 0),
        };
        setUser(mapped);
        return mapped;
      }
    } catch (err) {
      console.error("Error refreshing user profile:", err);
    }
    return null;
  }, []);

  const refreshUser = useCallback(async () => {
    if (user?.uuid) {
      await fetchUserData(user.uuid);
    }
  }, [user?.uuid, fetchUserData]);

  const initTelegram = useCallback(async () => {
    const tg = (window as any).Telegram?.WebApp;

    // Discard expired local token before attempting authentication or restoration
    const existingToken = getSupabaseToken();
    if (existingToken && isTokenExpired(existingToken)) {
      clearSupabaseToken();
    }

    if (tg && tg.initData) {
      setIsInsideTelegram(true);
      tg.ready?.();
      tg.expand?.();
      tg.setHeaderColor?.('#0e1621');
      tg.setBackgroundColor?.('#0e1621');
      tg.enableClosingConfirmation?.();

      try {
        // All Telegram authentication MUST pass through the trusted server-side Edge Function.
        // Never trust tg.initDataUnsafe before server cryptographic verification completes.
        const { data: authResponse, error: invokeErr } = await supabase.functions.invoke('auth', {
          body: {
            initData: tg.initData,
            start_param: tg.initDataUnsafe?.start_param
          }
        });

        let effectiveData = authResponse;

        if (invokeErr || (!authResponse?.success && !authResponse?.data && !authResponse?.access_token)) {
          // Try extracting structured error from SDK FunctionsHttpError first
          const ctx = (invokeErr as any)?.context;
          if (ctx && typeof ctx.clone === 'function') {
            const ctxJson = await ctx.clone().json().catch(() => null);
            if (ctxJson) effectiveData = ctxJson;
          }

          if (!effectiveData?.error && !effectiveData?.success) {
            // Fallback direct fetch with explicit anon apikey header
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
              if (directData) {
                effectiveData = directData;
              }
            }
          }
        }

        if (effectiveData?.error === "VPN Blocked" || effectiveData?.isVpnBlock) {
          clearSupabaseToken();
          setUser(null);
          setIsVpnBlock(true);
          setIsTelegramInitDone(true);
          return;
        }

        if (effectiveData && (effectiveData.success || effectiveData.data || effectiveData.access_token)) {
          const token = effectiveData.data?.access_token || effectiveData.access_token;
          const verifiedProfile = effectiveData.data?.user || effectiveData.user;
          const verifiedUuid = effectiveData.data?.user_uuid || effectiveData.user_uuid;

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
          } else if (verifiedUuid) {
            await fetchUserData(verifiedUuid);
          }
          setAuthError(null);
        } else {
          const errorMsg = effectiveData?.error || invokeErr?.message || "Failed to authenticate session with server.";
          console.warn("Telegram authentication failed:", errorMsg);
          clearSupabaseToken();
          setUser(null);
          setAuthError(errorMsg);
        }
      } catch (e: any) {
        console.error("Server authentication failed:", e);
        clearSupabaseToken();
        setUser(null);
        setAuthError(e?.message || "Authentication error");
      }
    } else {
      setIsInsideTelegram(false);
      // Outside Telegram WebApp: ONLY restore if a valid non-expired signed JWT exists for the owner.
      // Never query arbitrary user rows anonymously.
      const validToken = getSupabaseToken();
      const payload = validToken && !isTokenExpired(validToken) ? decodeJwtPayload(validToken) : null;
      if (payload?.sub && UUID_REGEX.test(payload.sub)) {
        const restored = await fetchUserData(payload.sub);
        if (!restored) {
          clearSupabaseToken();
          setUser(null);
        }
      } else {
        clearSupabaseToken();
        setUser(null);
      }
    }

    setIsTelegramInitDone(true);
  }, [fetchUserData]);

  useEffect(() => {
    initTelegram();
  }, [initTelegram]);

  if (!isTelegramInitDone || !isSplashMinDone) {
    return <SplashScreen minDuration={1800} onComplete={() => setIsSplashMinDone(true)} />;
  }

  if (isVpnBlock) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0e1621] text-center">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
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
          <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.15-5.06 3.28-.47.33-.89.49-1.27.48-.41-.01-1.21-.24-1.8-.43-.49-.16-.88-.24-.85-.51.02-.14.22-.29.62-.46 2.44-1.06 4.07-1.74 4.88-2.07 2.32-.97 2.8-1.14 3.12-1.15.07 0 .22.02.3.09.07.06.09.14.1.23-.01.07-.01.12-.02.21z" />
          </svg>
        </div>

        <h1 className="text-xl font-black text-white mb-2">
          {isInsideTelegram && authError ? "Authentication Failed" : "Payvora Telegram App"}
        </h1>

        <p className="text-slate-400 text-xs max-w-xs mb-6 leading-relaxed">
          {isInsideTelegram && authError
            ? authError
            : "Ka fur barnaamijka gudaha bot-kaaga rasmiga ah ee Telegram si aad si ammaan ah ugu xidhanto akoonkaaga."}
        </p>

        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          {isInsideTelegram && (
            <button
              onClick={() => {
                setAuthError(null);
                setIsTelegramInitDone(false);
                initTelegram();
              }}
              className="w-full py-3 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95"
            >
              Retry Verification
            </button>
          )}

          <a
            href={APP_CONFIG.telegram.botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
          >
            <span>Open in @{APP_CONFIG.telegram.botUsername}</span>
          </a>
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
