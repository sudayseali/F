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
let customAccessToken: string | null = null;

export const setSupabaseToken = (token: string) => {
  customAccessToken = token;
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key',
  {
    global: {
      fetch: async (url, options) => {
        const _options = options || {};
        const headers = new Headers(_options.headers);
        if (customAccessToken) {
          headers.set('Authorization', `Bearer ${customAccessToken}`);
        }
        return fetch(url, { ..._options, headers });
      }
    }
  }
);
