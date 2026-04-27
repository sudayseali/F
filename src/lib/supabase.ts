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
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key');
