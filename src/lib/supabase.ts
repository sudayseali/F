import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing! Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.'
  );
}

// Sameynta isku-xirka (Database Client)
// We provide fallback dummy valid strings so it doesn't crash the entire app if env vars are missing during build/testing
// Persistent token storage with fallback
const STORAGE_KEY = 'payvora_auth_token';

let customAccessToken: string | null = (() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
})();

export const setSupabaseToken = (token: string) => {
  customAccessToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        localStorage.setItem(STORAGE_KEY, token);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage write errors
  }
};

export const getSupabaseToken = (): string | null => {
  if (customAccessToken) return customAccessToken;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      customAccessToken = localStorage.getItem(STORAGE_KEY);
      return customAccessToken;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
};

export const clearSupabaseToken = () => {
  customAccessToken = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage removal errors
  }
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    global: {
      fetch: async (url, options) => {
        const _options = options || {};
        const headers = new Headers(_options.headers);
        const token = getSupabaseToken();
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return fetch(url, { ..._options, headers });
      }
    }
  }
);
