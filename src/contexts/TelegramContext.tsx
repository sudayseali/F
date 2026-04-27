import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramContextType {
  user: TelegramUser | null;
  isAdmin: boolean;
}

const TelegramContext = createContext<TelegramContextType>({ user: null, isAdmin: false });

export const useTelegram = () => useContext(TelegramContext);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure the script is fully loaded
    const initTelegram = () => {
      const tg = (window as any).Telegram?.WebApp;
      
      // Development/Preview Bypass:
      // If "?debug=1" is in the URL, simulate a user so we can preview the app in AI Studio/Browser.
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('debug') === '1') {
        setUser({ id: 5806129562, username: 'test_user_ai', first_name: 'Test', last_name: 'Admin User' });
        setIsAdmin(true); // Pretend debug user is an admin for preview purposes
        setIsReady(true);
        return;
      }

      if (tg && tg.initDataUnsafe) {
        tg.ready();
        tg.expand();
        const tgUser = tg.initDataUnsafe?.user;
        
        if (tgUser) {
          setUser({
            id: tgUser.id,
            username: tgUser.username,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
          });
          
          // SECURITY NOTE: In a real production deployment, you would call the Supabase Edge Function here:
          // fetch('/functions/v1/auth', { method: 'POST', body: JSON.stringify({ initData: tg.initData }) })
          //   .then(res => res.json())
          //   .then(data => setIsAdmin(data.is_admin))
          // 
          // For immediate app demo functionality without a live backend hooked up yet:
          if (tgUser.id === 5806129562) {
             setIsAdmin(true);
          }
        }
      }
      setIsReady(true);
    };

    if (document.readyState === 'complete') {
        initTelegram();
    } else {
        window.addEventListener('load', initTelegram);
        return () => window.removeEventListener('load', initTelegram);
    }
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 text-center font-sans">
        <div className="w-20 h-20 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
          <svg className="w-10 h-10 ml-[-2px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.84 1.15-5.06 3.28-.47.33-.89.49-1.27.48-.41-.01-1.21-.24-1.8-.43-.49-.16-.88-.24-.85-.51.02-.14.22-.29.62-.46 2.44-1.06 4.07-1.74 4.88-2.07 2.32-.97 2.8-1.14 3.12-1.15.07 0 .22.02.3.09.07.06.09.14.1.23-.01.07-.01.12-.02.21z"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Telegram Only</h1>
        <p className="text-gray-500 max-w-sm mb-6">
          This platform is exclusively designed for Telegram. Please open it via the official Telegram Mini App bot.
        </p>
        <button 
          onClick={() => window.location.href = '?debug=1'} 
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Developer: Preview with Mock User
        </button>
      </div>
    );
  }

  return (
    <TelegramContext.Provider value={{ user, isAdmin }}>
      {children}
    </TelegramContext.Provider>
  );
}
